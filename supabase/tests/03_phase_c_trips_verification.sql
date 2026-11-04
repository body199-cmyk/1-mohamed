-- ============================================================================
-- Test Suite: 03_phase_c_trips_verification.sql
-- BUILD-01 / Phase C (DB-03-TRIPS) — قبول النقلات والحفظ الذري على قاعدة معزولة.
--
-- يُشغّل بعد 02_phase_b_operations_verification.sql على نفس القاعدة، ويعيد استخدام
-- أدوات app_test_* من المرحلة A. مقارنة الحساب حرفية مقابل حالات اختبار
-- packages/accounting/tests/trip-amounts.test.ts (نفس الأرقام المتوقعة).
--
-- ملاحظة أمانة: PGlite اتصال واحد؛ التزامن الحقيقي بين طلبين متزامنين
-- (قفل الحسابات وترتيبه الثابت) منطقٌ مُختبر بالبناء والمراجعة لا بالتنفيذ المتزامن.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- C00 — البنية والصلاحيات (هذه الفحوص يكسرها التحكم السلبي C)
-- ---------------------------------------------------------------------------

select public.app_test_assert(true, 'C00 test helpers available');

select public.app_test_assert(
    (select relrowsecurity from pg_class where oid = 'public.trips'::regclass),
    'C00 trips table exists with RLS enabled'
);

select public.app_test_assert(
    not has_table_privilege('authenticated', 'public.trips', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.trips', 'TRUNCATE'),
    'C00 trips: TRUNCATE revoked for client roles (RLS never covers TRUNCATE)'
);

-- امتلاك صلاحية الجدول الافتراضية (INSERT/UPDATE) أمر طبيعي في Supabase؛
-- الحماية الفعلية هي RLS، ويثبتها C14 برفض الكتابة المباشرة فعليًا.
select public.app_test_assert(
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'trips'
        and policyname in ('Disallow direct insert on trips',
                           'Disallow direct update on trips',
                           'Disallow direct delete on trips')) = 3,
    'C00 trips: all three direct-write denial policies exist'
);

select public.app_test_assert(
    not has_function_privilege('anon', 'public.app_op_trip_create(text,jsonb)', 'EXECUTE')
    and not has_function_privilege('public', 'public.app_op_trip_create(text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.app_op_trip_create(text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.app_op_trips_read(jsonb)', 'EXECUTE'),
    'C00 trip RPCs are executable by authenticated only'
);

select public.app_test_assert(
    not has_function_privilege('authenticated', 'public.app_trip_totals(bigint,bigint,bigint,bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_resolve_trip_responsible(text,text,text,date)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_lock_trip_accounts(text[])', 'EXECUTE'),
    'C00 internal trip helpers are not callable from client roles'
);

-- ---------------------------------------------------------------------------
-- C01 — الصلاحيات: anon ومستخدم مسجل غير مالك
-- ---------------------------------------------------------------------------

set role anon;
set "request.jwt.claim.role" = 'anon';
set "request.jwt.claim.sub" = '';

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-ANON', '{"id":"TR_ANON"}'::jsonb)$q$,
    'C01 anon cannot execute a trip write RPC',
    array['42501']
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-NONOWNER', '{"id":"TR_NO"}'::jsonb)$q$,
    'C01 authenticated non-owner is rejected by the owner gate',
    array['42501']
);

select public.app_test_expect_error(
    $q$select public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30"}'::jsonb)$q$,
    'C01 authenticated non-owner cannot read trips either',
    array['42501']
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- C02 — تحقق المدخلات: الرفض قبل أي تحويل رقمي، والفيض برسالة واضحة
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-EMPTY', '{}'::jsonb)$q$,
    'C02 empty payload rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-NUM', '{"id":"TR_N","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":20.5,"contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 a JSON number (not string) for weight is rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-BAD', '{"id":"TR_BAD","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"12.5.1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 malformed decimal rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-NEG', '{"id":"TR_NEG","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"-5","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 negative weight rejected by format',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-PREC-W', '{"id":"TR_PW","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1.2500","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 weight with 4 decimals rejected before any cast',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-PREC-R', '{"id":"TR_PR","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1.250","contractor_rate_egp":"10.005","vehicle_rate_egp":"10.005","expense_egp":"0"}'::jsonb)$q$,
    'C02 rate with 3 decimals rejected before any cast',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-ZERO', '{"id":"TR_Z","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"0","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 zero weight rejected: weight must be positive',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-BIG-W', '{"id":"TR_BW","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"9999999999999999999","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C02 weight beyond bigint reported clearly',
    array['22003']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-BIG-T', '{"id":"TR_BT","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1000000","contractor_rate_egp":"90071992547409.93","vehicle_rate_egp":"90071992547409.93","expense_egp":"0"}'::jsonb)$q$,
    'C02 trip total beyond bigint reported clearly',
    array['22003']
);

select public.app_test_assert(
    (select count(*) from public.trips where id like 'TR\_B%' escape '\') = 0
    and (select count(*) from public.idempotency_keys where key like 'C-%' and key <> 'C-ANON') = 0,
    'C02 all rejected calls left no trip rows and no idempotency rows'
);

-- ---------------------------------------------------------------------------
-- C03 — الاتجاه والعلاقات والتواريخ
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-DIR', '{"id":"TR_DIR","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"SIDEWAYS","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C03 unknown direction rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-CP', '{"id":"TR_CP","vehicle_id":"V1","counterparty_contractor_id":"K_AHMED","direction":"OTHER_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C03 the primary contractor cannot be the counterparty',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-ACC', '{"id":"TR_ACC","vehicle_id":"V_BNEW","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C03 missing vehicle account with the responsible contractor rejected',
    array['23503']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-DATE', '{"id":"TR_DATE","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-10-31","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C03 trip date before the affected accounts start date rejected',
    array['22023']
);

-- عربية مؤرشفة تُرفض حتى لو وُجد لها حساب
select public.app_test_expect_ok(
    $q$select public.app_op_vehicle_set_archived('C-ARCH-V', '{"id":"V_BNEW","archived":true,"expected_version":1,"reason":"خارج الخدمة مؤقتًا"}'::jsonb)$q$,
    'C03 archive an unused vehicle for the next check'
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-ARCH', '{"id":"TR_ARCH","vehicle_id":"V_BNEW","counterparty_contractor_id":"K_MOHAMED","direction":"OTHER_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C03 archived vehicle rejected',
    array['23503']
);

-- ---------------------------------------------------------------------------
-- C04 + C05 — السعران، ثم مقارنة حرفية مع @ledger/accounting
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-SAME', '{"id":"TR_SAME","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"20","contractor_rate_egp":"100","vehicle_rate_egp":"90","expense_egp":"100","same_rate":true}'::jsonb)$q$,
    'C04 same_rate enabled with two different rates rejected',
    array['22023']
);

do $$
declare
    v_r jsonb;
begin
    -- (a) سعران متساويان ومصاريف غير صفر — نفس أرقام اختبار الحزمة حرفيًا.
    v_r := public.app_op_trip_create('C-A', '{
        "id":"TR_A","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '100000'
        and v_r->>'vehicle_total_piastres' = '100000',
        'C05a equal rates: totals match @ledger/accounting exactly (100000/100000)'
    );
    perform public.app_test_assert(
        jsonb_typeof(v_r->'contractor_total_piastres') = 'string'
        and jsonb_typeof(v_r->'vehicle_total_piastres') = 'string',
        'C05a totals returned as JSON text, never JS numbers'
    );
    perform public.app_test_assert(
        v_r->>'responsible_contractor_id' = 'K_AHMED',
        'C05a AHMED_SUPPLIES derives the primary contractor as responsible'
    );

    -- إعادة نفس الطلب بنفس المفتاح والمحتوى: نفس الرد بلا تكرار.
    declare
        v_r2 jsonb := public.app_op_trip_create('C-A', '{
            "id":"TR_A","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
            "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
            "weight_tonnes":"20","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100"
        }'::jsonb);
    begin
        perform public.app_test_assert(
            v_r is not distinct from v_r2,
            'C08 replay with the same key returns the identical stored response'
        );
    end;

    perform public.app_test_assert(
        (select count(*) from public.trips where id = 'TR_A') = 1
        and (select count(*) from public.audit_log where entity_id = 'TR_A' and action = 'INSERT') = 1
        and (select count(*) from public.idempotency_keys where key = 'C-A') = 1,
        'C08 replay created no duplicate trip, audit, or idempotency rows'
    );

    -- (b) سعران مستقلان
    v_r := public.app_op_trip_create('C-B', '{
        "id":"TR_B","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"100","vehicle_rate_egp":"90",
        "expense_egp":"100","same_rate":false
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '210000'
        and v_r->>'vehicle_total_piastres' = '190000',
        'C05b independent rates: 210000/190000 matches the package'
    );

    -- (c) تقريب هابط 14.5125 ⇒ 1451 قرشًا
    v_r := public.app_op_trip_create('C-C', '{
        "id":"TR_C","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"1.250","contractor_rate_egp":"10.01","vehicle_rate_egp":"10.01","expense_egp":"2"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '1451' and v_r->>'vehicle_total_piastres' = '1451',
        'C05c 1.250 x 10.01 + 2 rounds down to 1451'
    );

    -- (d) نصف القرش لأعلى
    v_r := public.app_op_trip_create('C-D', '{
        "id":"TR_D","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"0.500","contractor_rate_egp":"0.01","vehicle_rate_egp":"0.01","expense_egp":"0"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '1' and v_r->>'vehicle_total_piastres' = '1',
        'C05d exact half piastre rounds up to 1'
    );

    -- (e) 0.499 قرش يهبط إلى صفر
    v_r := public.app_op_trip_create('C-E', '{
        "id":"TR_E","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"0.499","contractor_rate_egp":"0.01","vehicle_rate_egp":"0.01","expense_egp":"0"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '0' and v_r->>'vehicle_total_piastres' = '0',
        'C05e 0.499 piastre rounds down to 0'
    );

    -- (f) 0.501 قرش يصعد إلى 1
    v_r := public.app_op_trip_create('C-F', '{
        "id":"TR_F","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"0.501","contractor_rate_egp":"0.01","vehicle_rate_egp":"0.01","expense_egp":"0"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '1' and v_r->>'vehicle_total_piastres' = '1',
        'C05f 0.501 piastre rounds up to 1'
    );

    -- (g) دقة كاملة فوق Number.MAX_SAFE_INTEGER
    v_r := public.app_op_trip_create('C-G', '{
        "id":"TR_G","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"1","contractor_rate_egp":"90071992547409.93","vehicle_rate_egp":"90071992547409.93","expense_egp":"0"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '9007199254740993'
        and v_r->>'vehicle_total_piastres' = '9007199254740993',
        'C05g precision above Number.MAX_SAFE_INTEGER preserved exactly as text'
    );
    perform public.app_test_assert(
        (select contractor_total_piastres::text from public.trips where id = 'TR_G') = '9007199254740993',
        'C05g the stored column preserves the exact value too'
    );

    -- (i) أصفار بادئة مقبولة والناتج مجرد من الأصفار
    v_r := public.app_op_trip_create('C-I', '{
        "id":"TR_I","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"00020.500","contractor_rate_egp":"0040.00","vehicle_rate_egp":"0030.00",
        "expense_egp":"0000.50","same_rate":false
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '82050'
        and v_r->>'vehicle_total_piastres' = '61550',
        'C05i leading zeros accepted; totals 82050/61550 match the package'
    );

    -- الاتجاه الثاني: المسؤول هو الطرف نفسه
    v_r := public.app_op_trip_create('C-O', '{
        "id":"TR_O","vehicle_id":"V2","counterparty_contractor_id":"K_MOHAMED",
        "direction":"OTHER_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'responsible_contractor_id' = 'K_MOHAMED'
        and v_r->>'contractor_total_piastres' = '100000',
        'C06 OTHER_SUPPLIES derives the counterparty as responsible'
    );
    perform public.app_test_assert(
        (select count(*) from public.trips
          where responsible_contractor_id = 'K_MOHAMED' and id = 'TR_O') = 1
        and (select count(*) from public.trips
          where responsible_contractor_id = 'K_AHMED' and id = 'TR_A') = 1,
        'C06 both directions recorded under their own responsible accounts'
    );

    -- لا إجماليات يفرضها العميل: الحقول الدخيلة تُتجاهل والخادم يحسب
    v_r := public.app_op_trip_create('C-X', '{
        "id":"TR_X","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100",
        "contractor_total_piastres":"999999","vehicle_total_piastres":"1"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'contractor_total_piastres' = '100000'
        and v_r->>'vehicle_total_piastres' = '100000'
        and (select contractor_total_piastres::text from public.trips where id = 'TR_X') = '100000',
        'C07 client-forced totals are ignored; the server computes both values'
    );

    -- نقلتان صحيحتان بنفس التاريخ والمبلغ لا تُمنعان
    v_r := public.app_op_trip_create('C-DUP', '{
        "id":"TR_DUP","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100"
    }'::jsonb);
    perform public.app_test_assert(
        (select count(*) from public.trips where id in ('TR_A','TR_DUP')) = 2,
        'C09 two valid trips with identical date and amount are both accepted'
    );

    -- السجل يحتفظ بأسعار نقطته
    perform public.app_test_assert(
        (select contractor_rate_piastres::text from public.trips where id = 'TR_I') = '4000'
        and (select vehicle_rate_piastres::text from public.trips where id = 'TR_I') = '3000',
        'C09 the trip record keeps its own rates'
    );
end;
$$;

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('C-A', '{"id":"TR_A","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"21","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"100"}'::jsonb)$q$,
    'C08 same key with different payload rejected',
    array['P2001']
);

-- ---------------------------------------------------------------------------
-- C10 — تعديل نقلة بسبب وأثر وذريّة تغيير الحساب
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trip_update('C-U-NOVER', '{"id":"TR_C","reason":"x"}'::jsonb)$q$,
    'C10 update without expected_version rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_update('C-U-NOREASON', '{"id":"TR_C","expected_version":1}'::jsonb)$q$,
    'C10 update without a reason rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_update('C-U-STALE', '{"id":"TR_C","reason":"تصحيح","expected_version":9,"vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"2.500","contractor_rate_egp":"10.01","vehicle_rate_egp":"10.01","expense_egp":"2"}'::jsonb)$q$,
    'C10 stale expected_version rejected',
    array['P2003']
);

do $$
declare v_r jsonb;
begin
    v_r := public.app_op_trip_update('C-U-OK', '{
        "id":"TR_C","reason":"تصحيح الوزن بعد مراجعة الوزنة",
        "expected_version":1,
        "vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"2.500","contractor_rate_egp":"10.01","vehicle_rate_egp":"10.01","expense_egp":"2"
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'version' = '2'
        and v_r->>'contractor_total_piastres' = '2703',
        'C10 successful edit recomputes totals (2.500 x 10.01 + 2 = 2703) and bumps version'
    );
    perform public.app_test_assert(
        (select count(*) from public.audit_log
          where entity_id = 'TR_C' and action = 'UPDATE'
            and reason = 'تصحيح الوزن بعد مراجعة الوزنة') = 1,
        'C10 the edit wrote an audit row with the reason'
    );
    perform public.app_test_assert(
        (select (old_data->>'contractor_total_piastres') is null
           from public.audit_log where entity_id = 'TR_C' and action = 'UPDATE' limit 1)
        or (select old_data->>'weight_milli_tonnes' from public.audit_log
             where entity_id = 'TR_C' and action = 'UPDATE' limit 1) = '1250',
        'C10 the audit row preserves the previous trip snapshot'
    );
    perform public.app_test_assert(
        (select (financial_impact->'old'->>'contractor_total_piastres') from public.audit_log
          where entity_id = 'TR_C' and action = 'UPDATE' limit 1) = '1451'
        and (select (financial_impact->'new'->>'contractor_total_piastres') from public.audit_log
          where entity_id = 'TR_C' and action = 'UPDATE' limit 1) = '2703',
        'C10 the audit row records old and new financial impact as text'
    );

    -- تغيير العربية والاتجاه معًا: الحساب القديم والجديد في عملية ذرية واحدة.
    v_r := public.app_op_trip_update('C-U-MOVE', '{
        "id":"TR_B","reason":"تصحيح العربية والاتجاه",
        "expected_version":1,
        "vehicle_id":"V2","counterparty_contractor_id":"K_MOHAMED",
        "direction":"OTHER_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"100","vehicle_rate_egp":"90",
        "expense_egp":"100","same_rate":false
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'responsible_contractor_id' = 'K_MOHAMED'
        and (select count(*) from public.trips
              where id = 'TR_B' and vehicle_id = 'V2'
                and responsible_contractor_id = 'K_MOHAMED') = 1,
        'C10 moving vehicle and direction re-derived the responsible account atomically'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- C11 — إلغاء محفوظ بسبب، واستبعاده المالي مع بقائه في التدقيق
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trip_cancel('C-C-NOREASON', '{"id":"TR_E","expected_version":1}'::jsonb)$q$,
    'C11 cancellation without a reason rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_cancel('C-C-STALE', '{"id":"TR_E","reason":"x","expected_version":9}'::jsonb)$q$,
    'C11 cancellation with stale version rejected',
    array['P2003']
);

do $$
declare v_r jsonb;
begin
    v_r := public.app_op_trip_cancel('C-C-OK', '{
        "id":"TR_E","reason":"نقلة مسجلة بالخطأ","expected_version":1
    }'::jsonb);
    perform public.app_test_assert(
        v_r->>'is_cancelled' = 'true' and v_r->>'version' = '2',
        'C11 cancellation succeeded with version bump'
    );
    perform public.app_test_assert(
        (select is_cancelled and cancel_reason = 'نقلة مسجلة بالخطأ'
           from public.trips where id = 'TR_E'),
        'C11 the cancelled trip keeps its reason in the table'
    );
    perform public.app_test_assert(
        (select count(*) from public.audit_log where entity_id = 'TR_E' and action = 'CANCEL') = 1,
        'C11 cancellation wrote a CANCEL audit row'
    );
end;
$$;

select public.app_test_expect_error(
    $q$select public.app_op_trip_cancel('C-C-AGAIN', '{"id":"TR_E","reason":"x","expected_version":2}'::jsonb)$q$,
    'C11 double cancellation rejected',
    array['22023']
);

select public.app_test_expect_error(
    $q$select public.app_op_trip_update('C-C-EDIT', '{"id":"TR_E","reason":"x","expected_version":2,"vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C11 a cancelled trip cannot be edited',
    array['22023']
);

-- ---------------------------------------------------------------------------
-- C12 — القراءة بالفترة والفلاتر والترقيم، والمجاميع نصوصًا
-- ---------------------------------------------------------------------------

select public.app_test_expect_error(
    $q$select public.app_op_trips_read('{"date_from":"2026-11-30","date_to":"2026-11-01"}'::jsonb)$q$,
    'C12 inverted period rejected',
    array['22023']
);

do $$
declare
    v_res jsonb;
    v_row record;
    v_ids text[] := '{}';
    v_cursor jsonb := null;
    v_pages integer := 0;
    v_expected bigint;
begin
    -- الملغى مستبعد افتراضيًا
    v_res := public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30"}'::jsonb);
    select count(*) into v_expected from public.trips
     where trip_date between '2026-11-01' and '2026-11-30' and not is_cancelled;
    perform public.app_test_assert(
        (v_res->>'total_count')::bigint = v_expected
        and (v_res->>'total_count')::bigint > 0,
        'C12 default read excludes cancelled trips and matches the SQL count'
    );
    perform public.app_test_assert(
        not exists (select 1 from jsonb_array_elements(v_res->'rows') r
                     where r->>'id' = 'TR_E'),
        'C12 the cancelled trip id does not appear in the default read'
    );

    -- مع include_cancelled يظهر
    v_res := public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30","include_cancelled":true}'::jsonb);
    perform public.app_test_assert(
        exists (select 1 from jsonb_array_elements(v_res->'rows') r where r->>'id' = 'TR_E'),
        'C12 include_cancelled returns the cancelled trip for audit'
    );

    -- فلتر العربية
    v_res := public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30","vehicle_id":"V1"}'::jsonb);
    select count(*) into v_expected from public.trips
     where trip_date between '2026-11-01' and '2026-11-30'
       and vehicle_id = 'V1' and not is_cancelled;
    perform public.app_test_assert(
        (v_res->>'total_count')::bigint = v_expected,
        'C12 vehicle filter matches the SQL count'
    );

    -- كل المبالغ نصوص داخل الصفوف
    perform public.app_test_assert(
        (select bool_and(jsonb_typeof(r->'contractor_total_piastres') = 'string'
                     and jsonb_typeof(r->'vehicle_total_piastres') = 'string')
           from jsonb_array_elements(v_res->'rows') r),
        'C12 every row returns money amounts as JSON text'
    );

    -- ترقيم keyset: اجتياز كامل بلا تكرار وبلا فقد
    loop
        v_res := public.app_op_trips_read(jsonb_build_object(
            'date_from','2026-11-01','date_to','2026-11-30','limit',3,'cursor',v_cursor));
        for v_row in select value from jsonb_array_elements(v_res->'rows') loop
            v_ids := v_ids || (v_row.value->>'id');
        end loop;
        v_pages := v_pages + 1;
        exit when v_res->>'next_cursor' is null;
        v_cursor := v_res->'next_cursor';
        if v_pages > 50 then
            raise exception 'TEST FAILED [C12 pagination did not terminate]' using errcode = 'P0001';
        end if;
    end loop;

    perform public.app_test_assert(
        v_pages > 1,
        'C12 pagination produced more than one page (rows exceed page size)'
    );
    perform public.app_test_assert(
        (select count(*) from unnest(v_ids) u(i)) = (select count(distinct i) from unnest(v_ids) u(i)),
        'C12 no trip id appears twice across pages'
    );
    perform public.app_test_assert(
        array_length(v_ids, 1)::bigint = (v_res->>'total_count')::bigint,
        'C12 the full traversal returned exactly total_count rows'
    );
    perform public.app_test_assert(
        (select count(*) from public.trips t
          where trip_date between '2026-11-01' and '2026-11-30'
            and not is_cancelled and t.id = any(v_ids)) = (v_res->>'total_count')::bigint,
        'C12 every non-cancelled trip in the period was returned exactly once'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- C13 — التراجع الكامل عند فشل التدقيق (محاكاة داخل الاختبار فقط)
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
    $q$select public.app_op_trip_create('C-ROLLBACK', '{"id":"TR_ROLLBACK","vehicle_id":"V1","counterparty_contractor_id":"K_MOHAMED","direction":"AHMED_SUPPLIES","trip_date":"2026-11-02","weight_tonnes":"1","contractor_rate_egp":"45","vehicle_rate_egp":"45","expense_egp":"0"}'::jsonb)$q$,
    'C13 the trip RPC fails when the audit insert fails',
    array['P2004']
);

select public.app_test_assert(
    (select count(*) from public.trips where id = 'TR_ROLLBACK') = 0,
    'C13 the trip insert was rolled back'
);
select public.app_test_assert(
    (select count(*) from public.idempotency_keys where key = 'C-ROLLBACK') = 0,
    'C13 the idempotency row was rolled back (one atomic unit)'
);

reset role;
drop trigger trg_test_force_audit_failure on public.audit_log;
drop function public.app_test_force_audit_failure();

-- ---------------------------------------------------------------------------
-- C14 — الكتابة المباشرة محظورة حتى على المالك (RLS + TRUNCATE)
-- ---------------------------------------------------------------------------

set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

select public.app_test_expect_error(
    $q$insert into public.trips (id, vehicle_id, counterparty_contractor_id, responsible_contractor_id, direction, trip_date, weight_milli_tonnes, contractor_rate_piastres, vehicle_rate_piastres, expense_piastres, contractor_total_piastres, vehicle_total_piastres)
       values ('TR_DIRECT','V1','K_MOHAMED','K_AHMED','AHMED_SUPPLIES','2026-11-02',1000,4500,4500,0,45000,45000)$q$,
    'C14 owner cannot insert a trip directly',
    array['42501']
);

update public.trips set weight_milli_tonnes = 999 where id = 'TR_A';

select public.app_test_assert(
    (select weight_milli_tonnes from public.trips where id = 'TR_A') = 20000,
    'C14 owner direct UPDATE changed no row'
);

delete from public.trips where id = 'TR_A';

select public.app_test_assert(
    (select count(*) from public.trips where id = 'TR_A') = 1,
    'C14 owner direct DELETE removed no row'
);

select public.app_test_expect_error(
    $q$truncate public.trips$q$,
    'C14 owner TRUNCATE rejected (RLS never covers TRUNCATE)',
    array['42501']
);

reset role;
set "request.jwt.claim.sub" = '';

do $done$
begin
    raise notice 'BUILD-01 Phase C: all DB-03-TRIPS tests PASSED on isolated PostgreSQL.';
end;
$done$;
