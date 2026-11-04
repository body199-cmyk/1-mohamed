-- ============================================================================
-- Test Suite: 01_db_02_schema_verification.sql  (أُعيدت كتابتها في BUILD-01 / A)
-- Module: DB-02-SCHEMA — Acceptance Verification, Phase A review fixes.
--
-- النسخة كما استُلمت محفوظة في:
--   supabase/tests/archive/01_db_02_schema_verification_as_received.sql
--
-- سبب إعادة الكتابة: اختبارات الرفض في النسخة الأصلية كانت
--   exception when others then null
-- فكانت تبتلع عبارة raise exception 'FAIL: ...' نفسها. أي أن الاختبار كان
-- ينجح سواء رُفض الإجراء المحظور أو سُمح به. كما أن TEST 3.3 لم يكن يفحص
-- تطبيع اللوحات، وSET LOCAL كان خارج معاملة، وapp_is_owner قد تعيد NULL.
--
-- قواعد هذه النسخة:
--  * SQL خالص بلا أوامر psql (\set / \echo) — يعمل بـ psql -f وبقاعدة معزولة.
--  * كل رفض أمني في القاعدة يستخدم 42501؛ P0001 محجوز لإخفاق الاختبار.
--  * أداة التوقع «تسجّل» حالة الخطأ ثم تُقيّمها خارج معالج الاستثناء،
--    فلا يمكن لأي catch عام ابتلاع إخفاق متعمد.
--  * اختباران meta يثبتان أن الأداة تفشل فعلًا لو نجح إجراء محظور.
--  * الاختبارات تعمل تحت أدوار anon / authenticated غير المالك / المالك.
--
-- ترتيب التنفيذ: 00_isolated_harness.sql ← migrations الأربع ← هذا الملف.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- أدوات التحقق. SECURITY INVOKER (افتراضي) عن قصد: EXECUTE الداخلي يجب أن
-- يعمل بصلاحيات الدور الحالي وإلا لالتفّ على RLS وبطَل الاختبار.
-- ---------------------------------------------------------------------------

create or replace function public.app_test_assert(p_condition boolean, p_label text)
returns void
language plpgsql
as $fn$
begin
    if p_condition is not true then
        raise exception 'TEST FAILED [%]: assertion is not true (got %)', p_label, p_condition
            using errcode = 'P0001';
    end if;
end;
$fn$;

create or replace function public.app_test_expect_error(
    p_sql text,
    p_label text,
    p_allowed_states text[]
)
returns void
language plpgsql
as $fn$
declare
    v_succeeded boolean := false;
    v_state text := null;
    v_message text := null;
begin
    begin
        execute p_sql;
        v_succeeded := true;
    exception when others then
        -- نسجّل فقط. لا نبتلع ولا نُصدر حكمًا داخل المعالج.
        v_state := sqlstate;
        v_message := sqlerrm;
    end;

    if v_succeeded then
        raise exception 'TEST FAILED [%]: forbidden statement SUCCEEDED', p_label
            using errcode = 'P0001';
    end if;

    if not (v_state = any (p_allowed_states)) then
        raise exception 'TEST FAILED [%]: unexpected sqlstate % (%)',
                        p_label, v_state, v_message
            using errcode = 'P0001';
    end if;
end;
$fn$;

create or replace function public.app_test_expect_ok(p_sql text, p_label text)
returns void
language plpgsql
as $fn$
declare
    v_state text := null;
    v_message text := null;
begin
    begin
        execute p_sql;
    exception when others then
        v_state := sqlstate;
        v_message := sqlerrm;
    end;

    if v_state is not null then
        raise exception 'TEST FAILED [%]: expected success but got % (%)',
                        p_label, v_state, v_message
            using errcode = 'P0001';
    end if;
end;
$fn$;

-- META-1: لو نجح إجراء «مفترض رفضه»، يجب أن تفشل الأداة نفسها.
select public.app_test_expect_error(
    $q$select public.app_test_expect_error('select 1', 'meta-inner', array['42501'])$q$,
    'META-1 helper fails when a forbidden statement succeeds',
    array['P0001']
);

-- META-2: حالة خطأ غير متوقعة تُرفض ولا تُعتبر رفضًا أمنيًا مقبولًا.
select public.app_test_expect_error(
    $q$select public.app_test_expect_error('select 1/0', 'meta-inner', array['42501'])$q$,
    'META-2 helper rejects an unrelated sqlstate',
    array['P0001']
);

-- META-3: الأداة لا تخفي استثناءً حقيقيًا داخل catch عام.
select public.app_test_expect_ok(
    $q$select public.app_test_expect_error('select 1/0', 'meta-inner', array['22012'])$q$,
    'META-3 helper accepts only the declared sqlstate'
);

-- ---------------------------------------------------------------------------
-- T01 — تطبيق migrations وتهيئة المالك مرة واحدة (بلا سباق)
-- ---------------------------------------------------------------------------

-- إجراء إداري محمي: يُنفّذ بصفته مدير القاعدة، لا من العميل.
-- المستخدم موجود في auth.users الذي جهّزه 00_isolated_harness.sql.
select public.app_set_initial_owner('00000000-0000-0000-0000-000000000001'::uuid);

select public.app_test_assert(
    (select public.app_get_owner_id()) = '00000000-0000-0000-0000-000000000001'::uuid,
    'T01 owner initialized once'
);

select public.app_test_assert(
    (select initialized_at is not null from public.app_owner where id = 1),
    'T01 initialization timestamp recorded'
);

-- محاولة ثانية بمستخدم موجود: تُرفض لأن المالك ضُبط بالفعل.
select public.app_test_expect_error(
    $q$select public.app_set_initial_owner('00000000-0000-0000-0000-000000000002'::uuid)$q$,
    'T01 second initialization rejected',
    array['42501']
);

-- معرف غير موجود في auth.users: يُرفض قبل أي تحديث (تحقق conditional FK).
select public.app_test_expect_error(
    $q$select public.app_set_initial_owner('00000000-0000-0000-0000-000000000099'::uuid)$q$,
    'T01 unknown auth user rejected',
    array['23503']
);

select public.app_test_assert(
    public.app_is_owner() is false,
    'T01 app_is_owner returns strict false with no JWT (never NULL)'
);

-- ---------------------------------------------------------------------------
-- T02 — بيانات أساسية للتجربة (كمدير، قبل تبديل الأدوار)
-- ---------------------------------------------------------------------------

insert into public.contractors (id, name, is_primary, is_archived)
values ('K_AHMED', 'مكتب أحمد أبو علي', true, false);

insert into public.contractors (id, name, is_primary, is_archived)
values ('K_MOHAMED', 'محمد عبد الله', false, false);

insert into public.vehicles (id, plate_number, driver_name)
values ('V1', 'ط ر س 1234', 'محمود حسن');

insert into public.vehicle_accounts (vehicle_id, contractor_id)
values ('V1', 'K_AHMED');

-- ---------------------------------------------------------------------------
-- T03 — القيود والعلاقات المركبة والدقة
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$insert into public.contractors (id, name, is_primary) values ('K_IMPOSTER', 'وهمي', true)$q$,
    'T03 only one primary contractor',
    array['23505', '42501']
);

select public.app_test_expect_error(
    $q$update public.contractors set is_archived = true where id = 'K_AHMED'$q$,
    'T03 primary contractor cannot be archived',
    array['23514', '42501']
);

select public.app_test_expect_error(
    $q$delete from public.contractors where id = 'K_AHMED'$q$,
    'T03 primary contractor cannot be deleted',
    array['42501']
);

select public.app_test_expect_error(
    $q$update public.contractors set is_primary = false where id = 'K_AHMED'$q$,
    'T03 primary contractor cannot lose its identity',
    array['42501']
);

select public.app_test_expect_error(
    $q$update public.contractors set id = 'K_AHMED_NEW' where id = 'K_AHMED'$q$,
    'T03 primary contractor id is immutable',
    array['42501']
);

select public.app_test_expect_error(
    $q$update public.contractors set is_primary = true where id = 'K_MOHAMED'$q$,
    'T03 no promotion to primary',
    array['42501']
);

-- تطبيع حقيقي: مسافات مكررة مختلفة عن الأصل، ويجب أن تُرفض.
select public.app_test_expect_error(
    $q$insert into public.vehicles (id, plate_number) values ('V_DUP', 'ط  ر   س  1234')$q$,
    'T03 plate normalization detects a duplicate',
    array['23505']
);

-- لوحة مختلفة فعلًا تُقبل: التطبيع لا يدمج لوحات مختلفة.
select public.app_test_expect_ok(
    $q$insert into public.vehicles (id, plate_number) values ('V2', 'س ص 9876')$q$,
    'T03 a genuinely different plate is accepted'
);

select public.app_test_expect_error(
    $q$insert into public.opening_balances (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres)
       values ('OB_INVALID', 'VEHICLE_CASH', 'K_MOHAMED', 'V1', '2026-11-01', 50000)$q$,
    'T03 composite FK rejects a missing vehicle account',
    array['23503']
);

select public.app_test_expect_error(
    $q$insert into public.opening_balances (id, balance_type, contractor_id, start_date, signed_piastres)
       values ('OB_BAD_TYPE', 'VEHICLE_CASH', 'K_MOHAMED', '2026-11-01', 50000)$q$,
    'T03 VEHICLE_CASH requires a vehicle_id',
    array['23514']
);

select public.app_test_expect_ok(
    $q$insert into public.opening_balances (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres)
       values ('OB_V1_AHMED', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 50000)$q$,
    'T03 valid vehicle opening balance accepted'
);

select public.app_test_expect_error(
    $q$insert into public.opening_balances (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres)
       values ('OB_V1_AHMED_2', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 20000)$q$,
    'T03 one active opening balance per account',
    array['23505']
);

-- إلغاء محفوظ بسبب، ثم بديل مصحح لنفس الحساب.
select public.app_test_expect_error(
    $q$update public.opening_balances set is_cancelled = true where id = 'OB_V1_AHMED'$q$,
    'T03 cancellation requires a reason',
    array['23514']
);

update public.opening_balances
   set is_cancelled = true,
       cancel_reason = 'خطأ إدخال وتم التصحيح',
       cancelled_at = now()
 where id = 'OB_V1_AHMED';

select public.app_test_expect_ok(
    $q$insert into public.opening_balances (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres)
       values ('OB_V1_AHMED_CORRECTED', 'VEHICLE_CASH', 'K_AHMED', 'V1', '2026-11-01', 45000)$q$,
    'T03 corrected opening balance accepted after cancellation'
);

insert into public.opening_balances (id, balance_type, contractor_id, start_date, signed_piastres)
values ('OB_LARGE_INT', 'CONTRACTOR_WORK', 'K_MOHAMED', '2026-11-01', 100000000000000000);

select public.app_test_assert(
    (select signed_piastres::text from public.opening_balances where id = 'OB_LARGE_INT')
        = '100000000000000000',
    'T03 bigint above Number.MAX_SAFE_INTEGER preserved exactly (compared as text)'
);

-- ---------------------------------------------------------------------------
-- T04 — ضبط دوال SECURITY DEFINER وصلاحيات التنفيذ ودورة RLS
-- ---------------------------------------------------------------------------

select public.app_test_assert(
    (select bool_and(prosecdef) from pg_proc
      where oid in ('public.app_is_owner()'::regprocedure,
                    'public.app_get_owner_id()'::regprocedure,
                    'public.app_set_initial_owner(uuid)'::regprocedure)),
    'T04 owner helpers are SECURITY DEFINER'
);

select public.app_test_assert(
    (select bool_and(proconfig::text like '%search_path=%') from pg_proc
      where oid in ('public.app_is_owner()'::regprocedure,
                    'public.app_get_owner_id()'::regprocedure,
                    'public.app_set_initial_owner(uuid)'::regprocedure)),
    'T04 every SECURITY DEFINER function pins search_path'
);

select public.app_test_assert(
    not has_function_privilege('anon', 'public.app_set_initial_owner(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_set_initial_owner(uuid)', 'EXECUTE')
    and not has_function_privilege('public', 'public.app_set_initial_owner(uuid)', 'EXECUTE'),
    'T04 administrative bootstrap not executable by any client role'
);

select public.app_test_assert(
    not has_function_privilege('authenticated', 'public.app_get_owner_id()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.app_get_owner_id()', 'EXECUTE'),
    'T04 owner UUID is not disclosed to client roles'
);

select public.app_test_assert(
    (select relrowsecurity and not relforcerowsecurity
       from pg_class where oid = 'public.app_owner'::regclass),
    'T04 app_owner: RLS enabled, FORCE RLS disabled (no recursive policy)'
);

select public.app_test_assert(
    not has_table_privilege('authenticated', 'public.contractors', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.opening_balances', 'TRUNCATE'),
    'T04 TRUNCATE revoked: RLS never covers TRUNCATE'
);

-- ---------------------------------------------------------------------------
-- T05 — سجل التدقيق ومفاتيح منع التكرار: حماية حتى من دوال الخادم
-- ---------------------------------------------------------------------------

insert into public.audit_log (entity_type, entity_id, action, performed_by)
values ('CONTRACTOR', 'K_MOHAMED', 'INSERT', '00000000-0000-0000-0000-000000000001'::uuid);

select public.app_test_expect_error(
    $q$update public.audit_log set reason = 'tampered' where entity_id = 'K_MOHAMED'$q$,
    'T05 audit_log UPDATE blocked even for table owner',
    array['42501']
);

select public.app_test_expect_error(
    $q$delete from public.audit_log where entity_id = 'K_MOHAMED'$q$,
    'T05 audit_log DELETE blocked even for table owner',
    array['42501']
);

select public.app_test_expect_error(
    $q$truncate public.audit_log$q$,
    'T05 audit_log TRUNCATE blocked even for table owner',
    array['42501']
);

insert into public.idempotency_keys (key, user_id, operation, payload_hash, status)
values ('KEY1', '00000000-0000-0000-0000-000000000001'::uuid, 'OP', 'HASH', 'COMPLETED');

select public.app_test_expect_error(
    $q$update public.idempotency_keys set payload_hash = 'OTHER' where key = 'KEY1'$q$,
    'T05 completed idempotency payload is immutable',
    array['42501']
);

select public.app_test_expect_error(
    $q$delete from public.idempotency_keys where key = 'KEY1'$q$,
    'T05 idempotency keys are retained permanently',
    array['42501']
);

-- ---------------------------------------------------------------------------
-- T06 — دور anon: صفر وصول
-- ---------------------------------------------------------------------------

set role anon;
set "request.jwt.claim.role" = 'anon';
set "request.jwt.claim.sub" = '';

select public.app_test_assert(
    (select count(*) from public.contractors) = 0
    and (select count(*) from public.opening_balances) = 0
    and (select count(*) from public.audit_log) = 0,
    'T06 anon reads zero rows from protected tables'
);

select public.app_test_expect_error(
    $q$insert into public.contractors (id, name) values ('K_HACK', 'اختراق')$q$,
    'T06 anon direct INSERT rejected',
    array['42501']
);

select public.app_test_expect_error(
    $q$truncate public.contractors$q$,
    'T06 anon TRUNCATE rejected',
    array['42501']
);

reset role;
set "request.jwt.claim.sub" = '';

-- ---------------------------------------------------------------------------
-- T07 — مستخدم مسجل غير المالك: صفر وصول، ولا يستطيع تعيين نفسه مالكًا
-- ---------------------------------------------------------------------------

set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select public.app_test_assert(
    (select count(*) from public.contractors) = 0
    and (select count(*) from public.opening_balances) = 0
    and (select count(*) from public.audit_log) = 0,
    'T07 authenticated non-owner reads zero rows'
);

-- النسخة الأصلية كانت تستخدم «is true» فكانت تمرّ حتى لو أعادت الدالة NULL.
select public.app_test_assert(
    public.app_is_owner() is false,
    'T07 app_is_owner is exactly false for a non-owner (not NULL)'
);

select public.app_test_expect_error(
    $q$select public.app_set_initial_owner('00000000-0000-0000-0000-000000000002'::uuid)$q$,
    'T07 non-owner cannot claim ownership',
    array['42501']
);

select public.app_test_expect_error(
    $q$insert into public.contractors (id, name) values ('K_HACK2', 'اختراق2')$q$,
    'T07 non-owner direct INSERT rejected',
    array['42501']
);

select public.app_test_expect_error(
    $q$insert into public.audit_log (entity_type, entity_id, action, performed_by)
       values ('CONTRACTOR', 'X', 'INSERT', '00000000-0000-0000-0000-000000000002'::uuid)$q$,
    'T07 non-owner cannot write audit_log',
    array['42501']
);

reset role;

-- ---------------------------------------------------------------------------
-- T08 — المالك المعتمد: قراءة فقط، والكتابة المباشرة محظورة
--       فحص UPDATE/DELETE بعدد الصفوف والقيمة، لا بـ FOUND داخل catch.
-- ---------------------------------------------------------------------------

set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select public.app_test_assert(
    public.app_is_owner() is true
    and (select count(*) from public.contractors) >= 2
    and (select count(*) from public.opening_balances) >= 2,
    'T08 owner can read the data'
);

select public.app_test_expect_error(
    $q$insert into public.contractors (id, name) values ('K_DIRECT', 'إدخال مباشر')$q$,
    'T08 owner direct INSERT rejected',
    array['42501']
);

-- UPDATE بـ USING (false) لا يُصدر خطأ: يُحدّث صفر صفوف. نتحقق من الأثر.
update public.contractors set name = 'اسم معدل' where id = 'K_MOHAMED';

select public.app_test_assert(
    (select name from public.contractors where id = 'K_MOHAMED') = 'محمد عبد الله',
    'T08 owner direct UPDATE changed no row'
);

delete from public.contractors where id = 'K_MOHAMED';

select public.app_test_assert(
    (select count(*) from public.contractors where id = 'K_MOHAMED') = 1,
    'T08 owner direct DELETE removed no row'
);

select public.app_test_expect_error(
    $q$insert into public.audit_log (entity_type, entity_id, action, performed_by)
       values ('CONTRACTOR', 'X', 'INSERT', '00000000-0000-0000-0000-000000000001'::uuid)$q$,
    'T08 owner cannot write audit_log directly',
    array['42501']
);

select public.app_test_expect_error(
    $q$insert into public.idempotency_keys (key, user_id, operation, payload_hash, status)
       values ('KEY2', '00000000-0000-0000-0000-000000000001'::uuid, 'OP', 'H', 'COMPLETED')$q$,
    'T08 owner cannot write idempotency_keys directly',
    array['42501']
);

select public.app_test_expect_error(
    $q$truncate public.contractors$q$,
    'T08 owner TRUNCATE rejected',
    array['42501']
);

reset role;
set "request.jwt.claim.sub" = '';

-- ---------------------------------------------------------------------------
-- ختام: يُرفع إشعار فقط عند وصول التنفيذ لهذا السطر دون استثناء.
-- ---------------------------------------------------------------------------

do $done$
begin
    raise notice 'BUILD-01 Phase A: all DB-02 verification tests PASSED on isolated PostgreSQL.';
end;
$done$;
