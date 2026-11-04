-- ============================================================================
-- Migration: 20261104200003_db02_review_fixes.sql
-- Module: BUILD-01 / Phase A — تصحيحات مراجعة DB-02-SCHEMA
--
-- additive fix layer: لا تُعدّل ملفات migrations الثلاثة السابقة، حفاظًا على تاريخها.
-- لم تُطبَّق أي migration على أي بيئة (لا Docker/CLI/PostgreSQL/مشروع سحابي)،
-- وهو ما جعل التصحيح بطبقة جديدة آمنًا ومسجّلًا.
--
-- المراجع: docs/BUILD_01_REPORT.md (قسم العيوب)،
--          docs/DATA_MODEL.md §2، §5، و AGENTS.md «قواعد لا تُكسر».
--
-- اصطلاح أكواد الأخطاء: كل رفض أمني يستخدم 42501 (insufficient_privilege).
-- الكود P0001 محجوز حصريًا لإخفاق الاختبارات، حتى لا يبتلعها catch عام.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ١. دالة المالك: قيمة منطقية صريحة (false بدل NULL) + فحص وجود المستخدم
--    + قفل استشاري يمنع سباق التهيئة المتزامنة بشكل صريح.
-- ---------------------------------------------------------------------------

create or replace function public.app_is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
    select coalesce(
        auth.uid() is not null
        and auth.uid() = (select owner_user_id from public.app_owner where id = 1),
        false
    );
$$;

comment on function public.app_is_owner() is
    'True only for the configured owner. Always boolean (never NULL) so RLS stays fail-closed.';

revoke execute on function public.app_is_owner() from public, anon;
grant execute on function public.app_is_owner() to authenticated;

-- app_get_owner_id يكشف معرف المالك لأي مستخدم مسجل؛ لا تحتاجه سياسات RLS
-- ولا تحتاجه دوال RPC (تعمل بصلاحية definer). تُسحب من العميل بالكامل.
revoke execute on function public.app_get_owner_id() from public, anon, authenticated;

create or replace function public.app_set_initial_owner(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_exists boolean;
begin
    if p_owner_user_id is null then
        raise exception 'Owner user ID cannot be null' using errcode = '22004';
    end if;

    -- تسلسل صريح لأي محاولتي تهيئة متزامنتين (فضلاً عن قفل الصف في UPDATE).
    perform pg_advisory_xact_lock(727301, 1);

    -- في Supabase يوجد auth.users؛ في قاعدة معزولة قد لا يوجد. الفحص مشروط
    -- حتى لا ينكسر تطبيق الـ migration على PostgreSQL عادي، ومع ذلك يمنع
    -- تعيين مالك غير موجود فور توفر جدول المصادقة.
    if to_regclass('auth.users') is not null then
        execute 'select exists (select 1 from auth.users where id = $1)'
            into v_exists
            using p_owner_user_id;
        if not v_exists then
            raise exception 'Owner user does not exist in auth.users'
                using errcode = '23503';
        end if;
    end if;

    update public.app_owner
       set owner_user_id = p_owner_user_id,
           initialized_at = now()
     where id = 1 and owner_user_id is null;

    if not found then
        raise exception 'Owner already initialized or configuration record missing'
            using errcode = '42501';
    end if;
end;
$$;

comment on function public.app_set_initial_owner(uuid) is
    'One-time administrative bootstrap. Serialized, validated against auth.users, never client-callable.';

revoke execute on function public.app_set_initial_owner(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ٢. سحب TRUNCATE: RLS لا يغطي TRUNCATE إطلاقًا، وSupabase يمنح افتراضيًا
--    صلاحيات واسعة لـ anon/authenticated. بدون هذا السحب يستطيع أي مستخدم
--    مسجل إفراغ جدول كامل رغم سياسات with check (false).
-- ---------------------------------------------------------------------------

revoke truncate on public.app_owner,
                   public.contractors,
                   public.vehicles,
                   public.vehicle_accounts,
                   public.opening_balances,
                   public.business_settings,
                   public.audit_log,
                   public.idempotency_keys
    from anon, authenticated;

-- حماية الجداول التي ستنشأ في المراحل B و C من نفس الثغرة.
alter default privileges in schema public
    revoke truncate on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ٣. حماية هوية المقاول الأساسي على مستوى الجدول (لا على مستوى RPC فقط).
--    القيد الأصلي كان يمنع الأرشفة وتعدد الأساسي فقط، ولا يمنع الحذف أو
--    قلب is_primary أو تغيير المعرف أو ترقية مقاول آخر.
-- ---------------------------------------------------------------------------

create or replace function public.app_protect_primary_contractor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'DELETE' then
        if old.is_primary then
            raise exception 'Primary contractor cannot be deleted'
                using errcode = '42501';
        end if;
        return old;
    end if;

    if tg_op = 'INSERT' then
        if new.is_primary and exists (
            select 1 from public.contractors c
             where c.is_primary and c.id is distinct from new.id
        ) then
            raise exception 'A primary contractor already exists'
                using errcode = '42501';
        end if;
        return new;
    end if;

    -- UPDATE
    if old.is_primary then
        if new.is_primary is distinct from old.is_primary
           or new.id is distinct from old.id
           or new.is_archived is distinct from old.is_archived
        then
            raise exception 'Primary contractor identity cannot be changed'
                using errcode = '42501';
        end if;
    end if;

    if (not old.is_primary) and new.is_primary then
        raise exception 'Promoting a contractor to primary is forbidden'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_primary_contractor on public.contractors;
create trigger trg_protect_primary_contractor
before insert or update or delete on public.contractors
for each row execute function public.app_protect_primary_contractor();

revoke execute on function public.app_protect_primary_contractor()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ٤. سجل التدقيق Append-Only حتى عبر دوال SECURITY DEFINER.
--    سياسات RLS تحمي العميل فقط؛ دالة خادم تعمل بصلاحية مالك الجدول تتجاوزها.
-- ---------------------------------------------------------------------------

create or replace function public.app_block_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    raise exception 'audit_log is append-only'
        using errcode = '42501';
    return null;
end;
$$;

drop trigger if exists trg_audit_log_append_only on public.audit_log;
create trigger trg_audit_log_append_only
before update or delete on public.audit_log
for each row execute function public.app_block_audit_mutation();

-- TRUNCATE لا يكون إلا AFTER و FOR EACH STATEMENT في PostgreSQL.
drop trigger if exists trg_audit_log_no_truncate on public.audit_log;
create trigger trg_audit_log_no_truncate
after truncate on public.audit_log
for each statement execute function public.app_block_audit_mutation();

revoke execute on function public.app_block_audit_mutation()
    from public, anon, authenticated;

comment on table public.audit_log is
    'Append-only audit ledger. Protected by RLS for clients AND by a trigger for server procedures.';

-- ---------------------------------------------------------------------------
-- ٥. ثبات مفاتيح منع التكرار: لا تغيير للبصمة أو المالك أو نوع العملية
--    بعد التسجيل، ولا رجوع من COMPLETED. يمنع إعادة استخدام مفتاح بمحتوى مختلف.
-- ---------------------------------------------------------------------------

create or replace function public.app_block_idempotency_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'idempotency keys are retained permanently'
            using errcode = '42501';
    end if;

    if new.key is distinct from old.key
       or new.user_id is distinct from old.user_id
       or new.operation is distinct from old.operation
       or new.payload_hash is distinct from old.payload_hash
       or (old.status = 'COMPLETED' and new.status is distinct from 'COMPLETED')
    then
        raise exception 'completed idempotency record is immutable'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_idempotency_immutable on public.idempotency_keys;
create trigger trg_idempotency_immutable
before update or delete on public.idempotency_keys
for each row execute function public.app_block_idempotency_mutation();

revoke execute on function public.app_block_idempotency_mutation()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ٦. ملاحظة معمارية (دورة RLS):
--    سياسة SELECT على app_owner تستدعي app_is_owner()، وهي SECURITY DEFINER
--    يملكها منشئ الجدول فيتجاوز RLS. لو طُبّق FORCE ROW LEVEL SECURITY على
--    app_owner لاحقًا لنشأت دورة متكررة. يُمنع ذلك صراحةً ويُفحص في الاختبارات.
-- ---------------------------------------------------------------------------

alter table public.app_owner no force row level security;

comment on table public.app_owner is
    'Single-row owner config. Must NOT use FORCE ROW LEVEL SECURITY: app_is_owner() reads this table as SECURITY DEFINER and forcing RLS would recurse. RLS is enabled; owner bypass is intentional and tested.';
