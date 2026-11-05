-- H038 / independent adversarial review suite (second pass).
-- Runs AFTER migration 23 and metadata suite 04; never against production.
-- Prove that replacing three SECURITY DEFINER RPCs did not open a permission
-- bypass; preserve metadata through cancellation and reject replay mutations.

-- Restricted roles may not call internal parsers directly.
select public.app_test_assert(
    not has_function_privilege('anon', 'public.app_trip_optional_text(jsonb,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.app_trip_optional_text(jsonb,text)', 'EXECUTE'),
    'REVIEW01 internal JSON parser remains private after replacement'
);

set role anon;
set "request.jwt.claim.role" = 'anon';
set "request.jwt.claim.sub" = '';

select public.app_test_expect_error(
    $q$select public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30"}'::jsonb)$q$,
    'REVIEW02 anonymous client cannot read after migration 23',
    array['42501']
);
select public.app_test_expect_error(
    $q$select public.app_op_trip_create('REVIEW-ANON', '{}'::jsonb)$q$,
    'REVIEW03 anonymous client cannot create after migration 23',
    array['42501']
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

select public.app_test_expect_error(
    $q$select public.app_op_trips_read('{"date_from":"2026-11-01","date_to":"2026-11-30"}'::jsonb)$q$,
    'REVIEW04 authenticated non-owner cannot read after migration 23',
    array['42501']
);
select public.app_test_expect_error(
    $q$select public.app_op_trip_update('REVIEW-NONOWNER', '{"id":"TR_DETAILS","expected_version":2}'::jsonb)$q$,
    'REVIEW05 authenticated non-owner cannot update after migration 23',
    array['42501']
);
select public.app_test_expect_error(
    $q$select public.app_trip_optional_text('{"receipt_number":"0007"}'::jsonb, 'receipt_number')$q$,
    'REVIEW06 client cannot execute internal parser',
    array['42501']
);

reset role;
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

-- Idempotency must include metadata, not merely monetary inputs.
select public.app_test_expect_error(
    $q$select public.app_op_trip_create('DETAIL-CREATE', '{
        "id":"TR_DETAILS","vehicle_id":"V1",
        "counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES","trip_date":"2026-11-02",
        "weight_tonnes":"20","contractor_rate_egp":"45",
        "vehicle_rate_egp":"45","expense_egp":"100",
        "origin":"طنطا","destination":"القاهرة",
        "receipt_number":"000042","notes":"إيصال ورقي"
    }'::jsonb)$q$,
    'REVIEW07 same idempotency key with different route is rejected',
    array['P2001']
);
select public.app_test_assert(
    (select origin = 'السويس' and destination = 'الجيزة'
          and receipt_number = '000043'
      from public.trips where id = 'TR_DETAILS'),
    'REVIEW08 failed replay left stored metadata untouched'
);

-- Cancellation must keep route, receipt and notes in the audit history.
do $review$
declare
    v_response jsonb;
    v_read jsonb;
    v_row jsonb;
begin
    v_response := public.app_op_trip_cancel('REVIEW-CANCEL', '{
        "id":"TR_DETAILS", "expected_version":2, "reason":"اختبار إلغاء محفوظ"
    }'::jsonb);
    perform public.app_test_assert(
        v_response->>'is_cancelled' = 'true'
        and v_response->>'version' = '3',
        'REVIEW09 cancellation preserves versioning'
    );
    perform public.app_test_assert(
        (select is_cancelled and origin = 'السويس'
            and destination = 'الجيزة' and receipt_number = '000043'
            and notes = 'تم تعديل الإيصال'
            from public.trips where id = 'TR_DETAILS'),
        'REVIEW10 cancellation does not erase receipt/route/notes'
    );
    perform public.app_test_assert(
        (select old_data->>'receipt_number' = '000043'
            and old_data->>'destination' = 'الجيزة'
            from public.audit_log where entity_id='TR_DETAILS' and action='CANCEL'),
        'REVIEW11 cancelled audit retains original metadata'
    );
    v_read := public.app_op_trips_read('{
        "date_from":"2026-11-02", "date_to":"2026-11-02",
        "include_cancelled":true, "vehicle_id":"V1", "limit":200
    }'::jsonb);
    select value into v_row from jsonb_array_elements(v_read->'rows') as x(value)
      where value->>'id' = 'TR_DETAILS';
    perform public.app_test_assert(
        v_row->>'receipt_number' = '000043'
        and v_row->>'is_cancelled' = 'true',
        'REVIEW12 include_cancelled returns the retained metadata'
    );
end;
$review$;

reset role;
set "request.jwt.claim.sub" = '';
