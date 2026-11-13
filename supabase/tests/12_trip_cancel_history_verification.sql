-- PRE-LIVE-02: trip cancellation reason appears only when requested.
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select public.app_op_trip_cancel('PRELIVE-CANCEL-TRIP',
  '{"id":"TR_F5B_MOHAMED","expected_version":1,
  "reason":"Historical correction for acceptance test"}'::jsonb);

do $reason$
declare
  v_hidden jsonb;
  v_included jsonb;
  v_record jsonb;
begin
  v_hidden := public.app_op_trips_read(
    '{"date_from":"2026-11-02","date_to":"2026-11-02",
      "vehicle_id":"V_F5_B","limit":200}'::jsonb);
  v_included := public.app_op_trips_read(
    '{"date_from":"2026-11-02","date_to":"2026-11-02",
      "vehicle_id":"V_F5_B","include_cancelled":true,"limit":200}'::jsonb);
  select x.value into v_record from jsonb_array_elements(v_included->'rows') x
    where x.value->>'id'='TR_F5B_MOHAMED';
  perform public.app_test_assert(
    not exists(select 1 from jsonb_array_elements(v_hidden->'rows') x
      where x.value->>'id'='TR_F5B_MOHAMED')
    and v_record->>'cancel_reason'='Historical correction for acceptance test'
    and v_record->>'is_cancelled'='true'
    and v_record->>'version'='2',
    'PRE-LIVE cancelled trip remains in audit history with its reason');
end;
$reason$;
