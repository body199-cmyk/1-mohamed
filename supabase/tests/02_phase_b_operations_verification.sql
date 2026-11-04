-- ============================================================================
-- Test Suite: 02_phase_b_operations_verification.sql
-- BUILD-01 / Phase B — قبول عمليات البيانات الأساسية على قاعدة معزولة.
--
-- يُشغّل بعد 01_db_02_schema_verification.sql على نفس القاعدة، وي reuse
-- أدوات app_test_assert / app_test_expect_error / app_test_expect_ok المصنوعة فيه.
-- الأدوات فيها اختبارات meta تمنع ابتلاع الإخفاق داخل catch عام (عيب المرحلة A).
--
-- ترتيب التنفيذ: harness ← migrations A الأربع ← tests A ← migrations B ← هذا الملف.
-- الأدوار: anon، مستخدم مسجل غير مالك، ثم المالك. لا postgres-only testing.
--
-- ملاحظة أمانة: PGlite قاعدة PostgreSQL حقيقية لكنها اتصال واحد في الذاكرة؛
-- التزامن الحقيقي بين طلبين متزامنين غير مُختبر هنا ويحتاج Supabase محلي/سحابي.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- B00 — بنية المرحلة B
-- ---------------------------------------------------------------------------

select public.app_test_assert(true, 'B00 test helpers from Phase A are available');

select public.app_test_assert(
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'contractors'
        and column_name = 'version') = 1
    and (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'vehicles'
        and column_name = 'version') = 1,
    'B00 optimistic-concurrency version columns exist'
);

select public.app_test_assert(
    (select count(*) from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname like 'app_op_%'
        and (p.proname like '%delete%' or p.proname like '%remove%')) = 0,
    'B00 no hard-delete RPC exists for records that may have movements'
);

select public.app_test_assert(
    (select bool_and(prosecdef and proconfig::text like '%search_path=%')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('app_op_contractor_create','app_op_vehicle_create',
                          'app_op_opening_balance_create','app_ensure_vehicle_account',
                          'app_idempotency_begin','app_write_audit')),
    'B00 every write helper is SECURITY DEFINER with a pinned search_path'
);

-- ---------------------------------------------------------------------------
-- B01 — الصلاحيات: anon ومستخدم مسجل غير مالك
-- ---------------------------------------------------------------------------

set role anon;
set "request.jwt.claim.role" = 'anon';
set "request.jwt.claim.sub" = '';

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-ANON', '{"id":"K_ANON","name":"x"}'::jsonb)$q$,
    'B01 anon cannot execute a write RPC',
    array['42501']
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-NONOWNER', '{"id":"K_NONOWNER","name":"x"}'::jsonb)$q$,
    'B01 authenticated non-owner is rejected by the owner gate',
    array['42501']
);

select public.app_test_assert(
    (select count(*) from public.idempotency_keys where key in ('B-ANON','B-NONOWNER')) = 0,
    'B01 rejected calls left no idempotency rows'
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- B02 — مدخلات ناقصة / غير صالحة
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('', '{"id":"K_E","name":"x"}'::jsonb)$q$,
    'B02 empty request key rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-EMPTY', '{}'::jsonb)$q$,
    'B02 empty payload rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-BLANK', '{"id":"K_BLANK","name":"   "}'::jsonb)$q$,
    'B02 blank name rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-PRIMARY', '{"id":"K_PRIMARY","name":"x","is_primary":true}'::jsonb)$q$,
    'B02 client cannot create the primary contractor',
    array['42501']
);

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-DETAILS',
        '{"id":"K_DET","name":"x","start_mode":"DETAILS","opening":{"start_date":"2026-11-01","signed_piastres":100}}'::jsonb)$q$,
    'B02 starting with details must not add a comprehensive opening',
    array['22023']
);

-- ---------------------------------------------------------------------------
-- B03 — إضافة مقاول + افتتاحيته عملية واحدة ذرية، مع التدقيق
-- ---------------------------------------------------------------------------

do $$
declare
    v_payload jsonb := '{"id":"K_B03","name":"شركة النصر","opening":{"start_date":"2026-11-01","signed_piastres":-125000,"notes":"رصيد افتتاحي"}}'::jsonb;
    v_r1 jsonb;
    v_r2 jsonb;
begin
    v_r1 := public.app_op_contractor_create('B-CREATE', v_payload);
    perform public.app_test_assert(
        v_r1->>'status' = 'OK' and v_r1->>'opening_balance_id' = 'K_B03:OPENING',
        'B03 create returned the contractor and its opening id'
    );
    perform public.app_test_assert(
        (select count(*) from public.contractors where id = 'K_B03') = 1
        and (select count(*) from public.opening_balances where id = 'K_B03:OPENING') = 1,
        'B03 contractor and opening were both persisted'
    );
    perform public.app_test_assert(
        (select signed_piastres::text from public.opening_balances where id = 'K_B03:OPENING') = '-125000',
        'B03 negative signed opening preserved exactly (compared as text)'
    );
    perform public.app_test_assert(
        (select count(*) from public.audit_log where entity_id = 'K_B03') = 1
        and (select count(*) from public.audit_log where entity_id = 'K_B03:OPENING') = 1,
        'B03 both writes produced audit rows'
    );

    -- B04: نفس المفتاح ونفس المحتوى ⇒ نفس الرد بلا تكرار.
    v_r2 := public.app_op_contractor_create('B-CREATE', v_payload);
    perform public.app_test_assert(
        v_r1 is not distinct from v_r2,
        'B04 replay with same key returned the identical stored response'
    );
    perform public.app_test_assert(
        (select count(*) from public.contractors where id = 'K_B03') = 1
        and (select count(*) from public.audit_log where entity_id = 'K_B03') = 1
        and (select count(*) from public.idempotency_keys where key = 'B-CREATE') = 1,
        'B04 replay created no duplicate rows'
    );
end;
$$;

-- B05: نفس المفتاح بمحتوى مختلف يُرفض، ولا يغيّر الرد المحفوظ.
select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-CREATE', '{"id":"K_B03","name":"اسم مختلف"}'::jsonb)$q$,
    'B05 same key with different payload rejected',
    array['P2001']
);

select public.app_test_assert(
    (select name from public.contractors where id = 'K_B03') = 'شركة النصر',
    'B05 conflicting retry did not alter the saved record'
);

-- الاسم وحده ليس هوية فريدة: اسمان متطابقان بمعرّفين مختلفين مقبولان.
select public.app_test_expect_ok(
    $q$select public.app_op_contractor_create('B-SAME-NAME', '{"id":"K_B03B","name":"شركة النصر"}'::jsonb)$q$,
    'B05 an identical name with a different id is allowed'
);

-- ---------------------------------------------------------------------------
-- B06 — تعارض الإصدار، التعديل، الأرشفة وإعادة التفعيل
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_contractor_update('B-STALE', '{"id":"K_B03","name":"x","expected_version":9}'::jsonb)$q$,
    'B06 stale expected_version rejected',
    array['P2003']
);

select public.app_test_expect_error(
    $q$select public.app_op_contractor_update('B-NOVER', '{"id":"K_B03","name":"x"}'::jsonb)$q$,
    'B06 update without expected_version rejected',
    array['22023']
);

do $$
declare v_r jsonb;
begin
    v_r := public.app_op_contractor_update(
        'B-UPDATE',
        '{"id":"K_B03","name":"شركة النصر للنقل","expected_version":1,"reason":"تصحيح الاسم"}'::jsonb
    );
    perform public.app_test_assert(
        v_r->>'version' = '2'
        and (select name from public.contractors where id = 'K_B03') = 'شركة النصر للنقل',
        'B06 update succeeded and incremented the version'
    );
    perform public.app_test_assert(
        (select count(*) from public.audit_log
          where entity_id = 'K_B03' and action = 'UPDATE' and reason = 'تصحيح الاسم') = 1,
        'B06 update wrote an audit row with the reason'
    );
    perform public.app_test_assert(
        (select old_data->>'name' from public.audit_log
          where entity_id = 'K_B03' and action = 'UPDATE' limit 1) = 'شركة النصر',
        'B06 audit preserved the previous value'
    );
end;
$$;

select public.app_test_expect_error(
    $q$select public.app_op_contractor_update('B-STALE2', '{"id":"K_B03","name":"y","expected_version":1}'::jsonb)$q$,
    'B06 reusing the old version after a successful update is rejected',
    array['P2003']
);

do $$
declare v_r jsonb;
begin
    v_r := public.app_op_contractor_set_archived(
        'B-ARCHIVE',
        '{"id":"K_B03","archived":true,"expected_version":2,"reason":"توقف التعامل"}'::jsonb
    );
    perform public.app_test_assert(
        (select is_archived from public.contractors where id = 'K_B03') is true
        and v_r->>'version' = '3',
        'B06 archive succeeded with an audit reason'
    );
    v_r := public.app_op_contractor_set_archived(
        'B-REACTIVATE',
        '{"id":"K_B03","archived":false,"expected_version":3,"reason":"عودة التعامل"}'::jsonb
    );
    perform public.app_test_assert(
        (select is_archived from public.contractors where id = 'K_B03') is false
        and v_r->>'version' = '4',
        'B06 reactivation succeeded'
    );
end;
$$;

select public.app_test_expect_error(
    $q$select public.app_op_contractor_set_archived('B-PRIMARY-ARCHIVE',
        '{"id":"K_AHMED","archived":true,"expected_version":1}'::jsonb)$q$,
    'B06 primary contractor cannot be archived through an RPC',
    array['42501']
);

-- ---------------------------------------------------------------------------
-- B07 — العربيات: تطبيع اللوحات، العربية المؤرشفة، حساب العربية
-- ---------------------------------------------------------------------------

select public.app_test_expect_ok(
    $q$select public.app_op_vehicle_create('B-V-ARCH',
        '{"id":"V_BARCH","plate_number":"ط ر س 7777","driver_name":"سائق"}'::jsonb)$q$,
    'B07 a vehicle with a new plate is created'
);

select public.app_test_expect_error(
    $q$select public.app_op_vehicle_create('B-V-DUP-ACTIVE',
        '{"id":"V_DUP2","plate_number":"ط  ر   س  1234"}'::jsonb)$q$,
    'B07 normalized duplicate of an ACTIVE plate is rejected',
    array['23505']
);

select public.app_test_expect_ok(
    $q$select public.app_op_vehicle_set_archived('B-V-ARCH-SET',
        '{"id":"V_BARCH","archived":true,"expected_version":1,"reason":"خروج من الخدمة"}'::jsonb)$q$,
    'B07 archiving a vehicle succeeds'
);

-- إنشاء عربية جديدة بلوحة مؤرشفة مطابقة ⇒ «قرار مطلوب» لا إنشاء صامت.
do $$
declare v_r jsonb;
begin
    v_r := public.app_op_vehicle_create(
        'B-V-ARCHIVED-CONFLICT',
        '{"id":"V_SHOULD_NOT_EXIST","plate_number":"ط  ر   س   7777"}'::jsonb
    );
    perform public.app_test_assert(
        v_r->>'status' = 'NEEDS_DECISION'
        and v_r->>'code' = 'ARCHIVED_PLATE_EXISTS'
        and v_r->>'archived_vehicle_id' = 'V_BARCH',
        'B07 archived matching plate returns an explicit decision notice'
    );
    perform public.app_test_assert(
        (select count(*) from public.vehicles where id = 'V_SHOULD_NOT_EXIST') = 0,
        'B07 no duplicate vehicle was silently created'
    );
end;
$$;

select public.app_test_expect_ok(
    $q$select public.app_op_vehicle_set_archived('B-V-ARCH-REACT',
        '{"id":"V_BARCH","archived":false,"expected_version":2,"reason":"عودة للخدمة"}'::jsonb)$q$,
    'B07 reactivating an archived vehicle succeeds'
);

-- لوحة مختلفة فعلًا تُقبل: التطبيع لا يدمج لوحات مختلفة.
select public.app_test_expect_ok(
    $q$select public.app_op_vehicle_create('B-V-DIFFERENT',
        '{"id":"V_BNEW","plate_number":"ط ر س 7778"}'::jsonb)$q$,
    'B07 a genuinely different plate is accepted'
);

-- حساب العربية لدى المقاول المسؤول: آمن عند التكرار.
do $$
declare v_r1 jsonb; v_r2 jsonb;
begin
    v_r1 := public.app_op_vehicle_account_ensure(
        'B-ACCOUNT-1', '{"vehicle_id":"V2","contractor_id":"K_MOHAMED"}'::jsonb);
    v_r2 := public.app_op_vehicle_account_ensure(
        'B-ACCOUNT-2', '{"vehicle_id":"V2","contractor_id":"K_MOHAMED"}'::jsonb);
    perform public.app_test_assert(
        (v_r1->>'created')::boolean is true and (v_r2->>'created')::boolean is false,
        'B07 ensure is idempotent: created once, then reported as existing'
    );
    perform public.app_test_assert(
        (select count(*) from public.vehicle_accounts
          where vehicle_id = 'V2' and contractor_id = 'K_MOHAMED') = 1,
        'B07 no duplicate vehicle account row'
    );
end;
$$;

select public.app_test_expect_error(
    $q$select public.app_op_vehicle_account_ensure('B-ACCOUNT-BAD',
        '{"vehicle_id":"V_MISSING","contractor_id":"K_MOHAMED"}'::jsonb)$q$,
    'B07 vehicle account for a missing vehicle is rejected',
    array['23503']
);

-- ---------------------------------------------------------------------------
-- B08 — الافتتاحيات: الفصل بين الحسابين، الدقة، منع البدء بالتفاصيل
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_opening_balance_create('B-OB-DETAILS',
        '{"id":"OB_DET","balance_type":"CONTRACTOR_WORK","contractor_id":"K_B03B","start_date":"2026-11-01","signed_piastres":100,"start_mode":"DETAILS"}'::jsonb)$q$,
    'B08 starting with details must not add a comprehensive opening',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_opening_balance_create('B-OB-FRACTION',
        '{"id":"OB_FRAC","balance_type":"CONTRACTOR_WORK","contractor_id":"K_B03B","start_date":"2026-11-01","signed_piastres":100.5}'::jsonb)$q$,
    'B08 fractional piastres rejected before any numeric cast',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_opening_balance_create('B-OB-OVERFLOW',
        '{"id":"OB_OVER","balance_type":"CONTRACTOR_WORK","contractor_id":"K_B03B","start_date":"2026-11-01","signed_piastres":999999999999999999999999}'::jsonb)$q$,
    'B08 bigint overflow reported clearly',
    array['22003']
);

select public.app_test_expect_error(
    $q$select public.app_op_opening_balance_create('B-OB-DUPLICATE',
        '{"id":"OB_DUP","balance_type":"CONTRACTOR_WORK","contractor_id":"K_B03","start_date":"2026-11-01","signed_piastres":100}'::jsonb)$q$,
    'B08 one active CONTRACTOR_WORK opening per contractor',
    array['23505']
);

select public.app_test_expect_error(
    $q$select public.app_op_opening_balance_create('B-OB-NOACCOUNT',
        '{"id":"OB_NOACC","balance_type":"VEHICLE_CASH","contractor_id":"K_B03B","vehicle_id":"V1","start_date":"2026-11-01","signed_piastres":100}'::jsonb)$q$,
    'B08 VEHICLE_CASH opening requires the composite vehicle account',
    array['23503']
);

-- افتتاحي فرق الشغل وافتتاحي النقد حسابان منفصلان لنفس المقاول.
do $$
declare v_r jsonb;
begin
    v_r := public.app_op_opening_balance_create(
        'B-OB-CASH',
        '{"id":"OB_V2_MOHAMED","balance_type":"VEHICLE_CASH","contractor_id":"K_MOHAMED","vehicle_id":"V2","start_date":"2026-11-01","signed_piastres":300000,"notes":"نقدة افتتاحية"}'::jsonb
    );
    perform public.app_test_assert(
        v_r->>'signed_piastres' = '300000'
        and jsonb_typeof(v_r->'signed_piastres') = 'string',
        'B08 precise amount returned as JSON text, not a JS number'
    );
    perform public.app_test_assert(
        (select count(*) from public.opening_balances
          where contractor_id = 'K_MOHAMED' and not is_cancelled) = 2
        and (select count(*) from public.opening_balances
          where contractor_id = 'K_MOHAMED' and balance_type = 'CONTRACTOR_WORK' and not is_cancelled) = 1
        and (select count(*) from public.opening_balances
          where contractor_id = 'K_MOHAMED' and balance_type = 'VEHICLE_CASH' and not is_cancelled) = 1,
        'B08 contractor-work opening and vehicle-cash opening stay separate'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- B09 — التراجع الكامل عند فشل التدقيق (لا نجاح جزئي)
--    نُركّب مؤقتًا فشلًا في إدراج سجل التدقيق، ثم نتحقق أن المقاول
--    ومفتاح الطلب لم يُحفظا. المُحاكاة داخل الاختبار فقط وتُزال بعده.
-- ---------------------------------------------------------------------------

reset role;
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

create or replace function public.app_test_force_audit_failure()
returns trigger
language plpgsql
as $fn$
begin
    raise exception 'simulated audit failure' using errcode = 'P2004';
end;
$fn$;

create trigger trg_test_force_audit_failure
before insert on public.audit_log
for each row execute function public.app_test_force_audit_failure();

set role authenticated;

select public.app_test_expect_error(
    $q$select public.app_op_contractor_create('B-ROLLBACK', '{"id":"K_ROLLBACK","name":"للتراجع"}'::jsonb)$q$,
    'B09 the RPC fails when the audit insert fails',
    array['P2004']
);

select public.app_test_assert(
    (select count(*) from public.contractors where id = 'K_ROLLBACK') = 0,
    'B09 contractor insert was rolled back'
);
select public.app_test_assert(
    (select count(*) from public.idempotency_keys where key = 'B-ROLLBACK') = 0,
    'B09 idempotency row was rolled back (atomic unit)'
);
select public.app_test_assert(
    (select count(*) from public.audit_log where entity_id = 'K_ROLLBACK') = 0,
    'B09 no partial audit row remained'
);

reset role;
drop trigger trg_test_force_audit_failure on public.audit_log;
drop function public.app_test_force_audit_failure();

-- ---------------------------------------------------------------------------
-- B10 — صلاحيات ما بعد المرحلة B، وحماية الجداول من الكتابة المباشرة
-- ---------------------------------------------------------------------------

select public.app_test_assert(
    not has_function_privilege('anon', 'public.app_op_contractor_create(text,jsonb)', 'EXECUTE')
    and not has_function_privilege('public', 'public.app_op_contractor_create(text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.app_op_contractor_create(text,jsonb)', 'EXECUTE'),
    'B10 write RPCs are executable by authenticated only'
);

select public.app_test_assert(
    not has_function_privilege('authenticated', 'public.app_idempotency_begin(text,text,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_write_audit(text,text,text,text,jsonb,jsonb,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_ensure_vehicle_account(text,text,uuid)', 'EXECUTE'),
    'B10 internal helpers are not callable from client roles'
);

set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select public.app_test_expect_error(
    $q$insert into public.contractors (id, name) values ('K_DIRECT_B', 'مباشر')$q$,
    'B10 owner still cannot write a protected table directly',
    array['42501']
);

select public.app_test_expect_error(
    $q$truncate public.contractors$q$,
    'B10 owner TRUNCATE still rejected (RLS never covers TRUNCATE)',
    array['42501']
);

reset role;
set "request.jwt.claim.sub" = '';

do $done$
begin
    raise notice 'BUILD-01 Phase B: all operations tests PASSED on isolated PostgreSQL.';
end;
$done$;
