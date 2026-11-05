-- DB-03-TRIPS / H038: verify route and receipt survive create, update,
-- replay and paginated read; no hidden change to accounting or authorization.
-- Runs after the existing Phase C suite on isolated PostgreSQL only.
set role authenticated;
set "request.jwt.claim.role" = 'authenticated';
set "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

do $detail$
declare
    v_initial jsonb := '{
        "id":"TR_DETAILS", "vehicle_id":"V1",
        "counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES", "trip_date":"2026-11-02",
        "weight_tonnes":"20", "contractor_rate_egp":"45",
        "vehicle_rate_egp":"45", "expense_egp":"100",
        "origin":"السويس", "destination":"القاهرة",
        "receipt_number":"000042", "notes":"إيصال ورقي"
    }'::jsonb;
    v_updated jsonb := '{
        "id":"TR_DETAILS", "expected_version":1, "reason":"تصحيح خط السير",
        "vehicle_id":"V1", "counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES", "trip_date":"2026-11-02",
        "weight_tonnes":"20", "contractor_rate_egp":"45",
        "vehicle_rate_egp":"45", "expense_egp":"100",
        "origin":"السويس", "destination":"الجيزة",
        "receipt_number":"000043", "notes":"تم تعديل الإيصال"
    }'::jsonb;
    v_result jsonb;
    v_replay jsonb;
    v_page jsonb;
    v_row jsonb;
begin
    v_result := public.app_op_trip_create('DETAIL-CREATE', v_initial);
    perform public.app_test_assert(
        v_result->>'contractor_total_piastres' = '100000'
        and v_result->>'vehicle_total_piastres' = '100000',
        'DETAIL01 metadata does not change the original accounting totals'
    );
    perform public.app_test_assert(
        (select origin = 'السويس' and destination = 'القاهرة'
                and receipt_number = '000042' and notes = 'إيصال ورقي'
         from public.trips where id = 'TR_DETAILS'),
        'DETAIL02 create persists route, leading-zero receipt and notes'
    );
    v_replay := public.app_op_trip_create('DETAIL-CREATE', v_initial);
    perform public.app_test_assert(
        v_result is not distinct from v_replay
        and (select count(*) from public.trips where id = 'TR_DETAILS') = 1
        and (select count(*) from public.audit_log
               where entity_id = 'TR_DETAILS' and action = 'INSERT') = 1,
        'DETAIL03 create replay is idempotent with no duplicate audit'
    );
    perform public.app_test_assert(
        (select new_data->>'receipt_number' = '000042'
                and new_data->>'origin' = 'السويس'
         from public.audit_log
         where entity_id = 'TR_DETAILS' and action = 'INSERT'),
        'DETAIL04 creation audit includes descriptive fields'
    );

    v_result := public.app_op_trip_update('DETAIL-UPDATE', v_updated);
    perform public.app_test_assert(
        v_result->>'version' = '2'
        and (select destination = 'الجيزة'
                and receipt_number = '000043'
                and notes = 'تم تعديل الإيصال'
                and version = 2
         from public.trips where id = 'TR_DETAILS'),
        'DETAIL05 update persists changed descriptive fields and increments version'
    );
    perform public.app_test_assert(
        (select old_data->>'receipt_number' = '000042'
                and new_data->>'receipt_number' = '000043'
                and diff->'destination'->>1 = 'الجيزة'
         from public.audit_log
         where entity_id = 'TR_DETAILS' and action = 'UPDATE'),
        'DETAIL06 update audit has previous and current receipt and route'
    );
    v_replay := public.app_op_trip_update('DETAIL-UPDATE', v_updated);
    perform public.app_test_assert(
        v_result is not distinct from v_replay
        and (select count(*) from public.audit_log
               where entity_id = 'TR_DETAILS' and action = 'UPDATE') = 1,
        'DETAIL07 update replay does not create duplicate changes'
    );

    v_page := public.app_op_trips_read('{
        "date_from":"2026-11-02", "date_to":"2026-11-02",
        "vehicle_id":"V1", "limit":200
    }'::jsonb);
    select value into v_row from jsonb_array_elements(v_page->'rows') as x(value)
      where value->>'id' = 'TR_DETAILS';
    perform public.app_test_assert(
        v_row->>'origin' = 'السويس'
        and v_row->>'destination' = 'الجيزة'
        and v_row->>'receipt_number' = '000043'
        and v_row->>'notes' = 'تم تعديل الإيصال',
        'DETAIL08 read returns all descriptive fields unchanged'
    );

    -- Existing rows from the earlier migrations have NULL metadata, not errors.
    select value into v_row from jsonb_array_elements(v_page->'rows') as x(value)
      where value->>'id' = 'TR_A';
    perform public.app_test_assert(
        v_row ? 'origin' and v_row ? 'destination'
        and v_row ? 'receipt_number'
        and v_row->'origin' = 'null'::jsonb,
        'DETAIL09 existing trips remain readable with optional null metadata'
    );
end;
$detail$;

select public.app_test_expect_error(
    $q$select public.app_op_trip_create('DETAIL-INVALID', '{
        "id":"TR_BAD_RECEIPT", "vehicle_id":"V1",
        "counterparty_contractor_id":"K_MOHAMED",
        "direction":"AHMED_SUPPLIES", "trip_date":"2026-11-02",
        "weight_tonnes":"1", "contractor_rate_egp":"45",
        "vehicle_rate_egp":"45", "expense_egp":"0",
        "receipt_number":42
    }'::jsonb)$q$,
    'DETAIL10 receipt JSON number rejected to avoid losing leading zeros',
    array['22023']
);

select public.app_test_assert(
    not exists (select 1 from public.trips where id = 'TR_BAD_RECEIPT')
    and not exists (select 1 from public.idempotency_keys where key = 'DETAIL-INVALID'),
    'DETAIL11 invalid receipt rolls back record and idempotency key together'
);

reset role;
set "request.jwt.claim.sub" = '';
