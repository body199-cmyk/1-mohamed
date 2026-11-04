-- ============================================================================
-- Migration: 20261104200010_phase_b_foundation.sql
-- Module: BUILD-01 / Phase B — أساس العمليات المحمية (بدون عمليات بعد)
--
-- additive: لا يُعدّل أي migration سابق. يُطبّق بعد A فقط بعد نجاح اختباراتها.
-- الغرض: أرضية مشتركة لكل عمليات الكتابة: هوية المالك، بصمة الطلب،
--         منع التكرار، التدقيق، التحقق الصارم من المدخلات، تطبيع اللوحات.
--
-- اصطلاح أكواد الأخطاء (مكمّل لاصطلاح المرحلة A):
--   42501 رفض أمني / غير مالك      22023 مدخل ناقص أو غير صالح
--   23503 علاقة مفقودة              23505 تكرار فريد
--   P0001 محجوز لإخفاق الاختبارات  P2001 نفس المفتاح بمحتوى مختلف
--   P2002 مفتاح قيد التنفيذ/فاشل   P2003 تعارض إصدار
--   P2004 محجوز لمحاكاة فشل التدقيق في الاختبارات
--
-- لماذا لا نستخدم P0004؟ لأنه في PostgreSQL هو assert_failure،
-- ومعالج PL/pgSQL «WHEN OTHERS» لا يصطاده، فيفلت الاستثناء من أداة
-- الاختبار ويبدو كأن الاختبار نفسه فشل. نطاق P2xxx لا يتعارض مع
-- أسماء الحالات الخاصة داخل PL/pgSQL.
--
-- كل دالة SECURITY DEFINER تُثبّت search_path وتُسحب صلاحية تنفيذها من العميل.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ١. أرقام إصدارات للكيانات القابلة للتعديل (تحقق التعارض المتفائل / تعارض النسخ).
--    الإضافة بأعمدة جديدة فقط؛ لا تغيير في عقود الجداول القائمة.
-- ---------------------------------------------------------------------------

alter table public.contractors
    add column if not exists version integer not null default 1
        check (version >= 1);

alter table public.vehicles
    add column if not exists version integer not null default 1
        check (version >= 1);

comment on column public.contractors.version is
    'Optimistic-concurrency version. Every protected update requires expected_version and increments it.';
comment on column public.vehicles.version is
    'Optimistic-concurrency version. Every protected update requires expected_version and increments it.';

-- ---------------------------------------------------------------------------
-- ٢. بوابة المالك: أي عملية كتابة تبدأ بها. تُعيد معرف المستخدم للتدقيق.
-- ---------------------------------------------------------------------------

create or replace function public.app_require_owner()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null or public.app_is_owner() is not true then
        raise exception 'Only the owner may perform this operation'
            using errcode = '42501';
    end if;
    return v_uid;
end;
$$;

comment on function public.app_require_owner() is
    'Fail-closed gate for every write RPC. Returns the authenticated owner UUID for the audit trail.';

-- ---------------------------------------------------------------------------
-- ٣. تحقق صارم من المدخلات: نصوص غير فارغة، وأعداد صحيحة دون كسور.
--    الفحص على النص قبل أي تحويل رقمي يمنع التقريب الصامت (D01 / A05).
-- ---------------------------------------------------------------------------

create or replace function public.app_require_text(p_value text, p_label text)
returns text
language plpgsql
immutable
as $$
begin
    if p_value is null or btrim(p_value) = '' then
        raise exception 'Missing or empty value: %', p_label
            using errcode = '22023';
    end if;
    return btrim(p_value);
end;
$$;

create or replace function public.app_exact_bigint(p_value jsonb, p_label text)
returns bigint
language plpgsql
immutable
as $$
declare
    v_text text;
begin
    if p_value is null or jsonb_typeof(p_value) <> 'number' then
        raise exception 'Expected a numeric value for %', p_label
            using errcode = '22023';
    end if;

    -- jsonb رقمي مفرد: ::text يعيد نصه الأصلي كما ورد دون تقريب.
    -- (jsonb_typeof = number يضمن عدم وجود علامات تنصيص).
    v_text := p_value::text;

    if v_text !~ '^-?[0-9]+$' then
        raise exception '% must be a whole number of piastres; fractional or extra precision is rejected',
                        p_label
            using errcode = '22023';
    end if;

    begin
        return v_text::bigint;
    exception when numeric_value_out_of_range then
        raise exception '% exceeds the bigint storage limit; correct the amount', p_label
            using errcode = '22003';
    end;
end;
$$;

comment on function public.app_exact_bigint(jsonb, text) is
    'Rejects fractions/extra precision BEFORE casting, and reports bigint overflow clearly. Never rounds.';

-- تطبيع اللوحة: نفس تعبير الفهرس الفريد في M01.2، حتى لا يُفلت تكرار بصياغة مسافات.
create or replace function public.app_normalize_plate(p_plate text)
returns text
language sql
immutable
as $$
    select lower(regexp_replace(btrim(p_plate), '\s+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- ٤. منع إعادة الطلب: البصمة + العملية + المستخدم، والاستجابة المحفوظة.
--    INSERT ... ON CONFLICT DO NOTHING + returning يميّز «أنا صاحب المفتاح»
--    من «طلب وصل قبلي». عند التزامن الحقيقي ينتظر الثاني ثم يعيد نفس الرد.
--    أي استثناء لاحق يتراجع بالعملية كلها (بما فيها صف PROCESSING).
-- ---------------------------------------------------------------------------

create or replace function public.app_idempotency_begin(
    p_key text,
    p_operation text,
    p_payload jsonb,
    p_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_hash text;
    v_inserted integer := 0;
    v_rec public.idempotency_keys%rowtype;
begin
    if p_key is null or btrim(p_key) = '' then
        raise exception 'Request key is required' using errcode = '22023';
    end if;
    if p_operation is null or btrim(p_operation) = '' then
        raise exception 'Operation name is required' using errcode = '22023';
    end if;
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
        raise exception 'Request payload must be a JSON object' using errcode = '22023';
    end if;

    -- jsonb::text تمثيل قياسي (مفاتيح مرتبة) ⇒ البصمة مستقرة عند إعادة المحاولة.
    v_hash := md5(p_operation || '|' || p_payload::text);

    insert into public.idempotency_keys (key, user_id, operation, payload_hash, status)
    values (p_key, p_user, p_operation, v_hash, 'PROCESSING')
    on conflict (key) do nothing
    returning 1 into v_inserted;

    if coalesce(v_inserted, 0) = 1 then
        return jsonb_build_object('__replay', false);
    end if;

    select * into v_rec from public.idempotency_keys where key = p_key;

    if v_rec.payload_hash is distinct from v_hash
       or v_rec.user_id is distinct from p_user then
        raise exception 'Request key reused with a different payload'
            using errcode = 'P2001';
    end if;

    if v_rec.status = 'COMPLETED' then
        return jsonb_build_object('__replay', true, 'response', v_rec.response_body);
    end if;

    raise exception 'Request key is still processing or previously failed; use a new key'
        using errcode = 'P2002';
end;
$$;

create or replace function public.app_idempotency_complete(p_key text, p_response jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    update public.idempotency_keys
       set status = 'COMPLETED',
           response_status = 200,
           response_body = p_response,
           updated_at = now()
     where key = p_key
       and status = 'PROCESSING';
end;
$$;

comment on function public.app_idempotency_begin(text, text, jsonb, uuid) is
    'Atomic request gate: same key + same payload replays the saved response; content mismatch is rejected.';

-- ---------------------------------------------------------------------------
-- ٥. التدقيق: INSERT فقط. الحماية من التعديل/الحذف قائمة على مستوى الجدول
--    (المرحلة A)، فلا يمكن لدالة خادم أن تطمس أثرها حتى بصلاحية المالك.
-- ---------------------------------------------------------------------------

create or replace function public.app_write_audit(
    p_entity_type text,
    p_entity_id text,
    p_action text,
    p_reason text,
    p_old jsonb,
    p_new jsonb,
    p_diff jsonb,
    p_user uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    insert into public.audit_log
        (entity_type, entity_id, action, reason, old_data, new_data, diff, performed_by)
    values
        (p_entity_type, p_entity_id, p_action, p_reason, p_old, p_new, p_diff, p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- ٦. إنشاء حساب العربية لدى المقاول المسؤول بأمان عند التزامن.
--    قفل استشاري مفتاحه (العربية|المقاول) ثم ON CONFLICT DO NOTHING:
--    طلبان متزامنان لا ينتجان صفين ولا صفّي تدقيق.
-- ---------------------------------------------------------------------------

create or replace function public.app_ensure_vehicle_account(
    p_vehicle_id text,
    p_contractor_id text,
    p_user uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
    perform pg_advisory_xact_lock(727302, hashtext(p_vehicle_id || '|' || p_contractor_id));

    if not exists (select 1 from public.contractors
                    where id = p_contractor_id and not is_archived) then
        raise exception 'Contractor does not exist or is archived' using errcode = '23503';
    end if;
    if not exists (select 1 from public.vehicles
                    where id = p_vehicle_id and not is_archived) then
        raise exception 'Vehicle does not exist or is archived' using errcode = '23503';
    end if;

    insert into public.vehicle_accounts (vehicle_id, contractor_id)
    values (p_vehicle_id, p_contractor_id)
    on conflict (vehicle_id, contractor_id) do nothing;

    if found then
        perform public.app_write_audit(
            'VEHICLE_ACCOUNT', p_vehicle_id || '|' || p_contractor_id, 'INSERT', null,
            null,
            jsonb_build_object('vehicle_id', p_vehicle_id, 'contractor_id', p_contractor_id),
            null, p_user
        );
        return true;
    end if;

    return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٧. الأدوات داخلية بالكامل: لا EXECUTE لأي دور عميل.
-- ---------------------------------------------------------------------------

revoke execute on function
    public.app_require_owner(),
    public.app_require_text(text, text),
    public.app_exact_bigint(jsonb, text),
    public.app_normalize_plate(text),
    public.app_idempotency_begin(text, text, jsonb, uuid),
    public.app_idempotency_complete(text, jsonb),
    public.app_write_audit(text, text, text, text, jsonb, jsonb, jsonb, uuid),
    public.app_ensure_vehicle_account(text, text, uuid)
    from public, anon, authenticated;
