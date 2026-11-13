-- PRE-LIVE-01: payment keyset pages never repeat/skip same-day payments.
-- Runs after FIN-05 fixtures; no real data or Supabase project.
set role authenticated;
set "request.jwt.claim.role"='authenticated';
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';

select public.app_op_payment_create('PAG-PAY-A',
  '{"id":"P_PAG_A","vehicle_id":"V_F5_A","responsible_contractor_id":"K_AHMED",
  "payment_date":"2026-11-04","amount_egp":"1.00","notes":"first"}'::jsonb);
select public.app_op_payment_create('PAG-PAY-B',
  '{"id":"P_PAG_B","vehicle_id":"V_F5_A","responsible_contractor_id":"K_AHMED",
  "payment_date":"2026-11-04","amount_egp":"2.00","notes":"second"}'::jsonb);

do $pagination$
declare
  v_base jsonb := '{"vehicle_id":"V_F5_A","responsible_contractor_id":"K_AHMED",
    "date_from":"2026-11-01","date_to":"2026-11-05","limit":1}'::jsonb;
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
  v_fourth jsonb;
  v_ids text[];
  v_opening text;
  v_closing text;
begin
  perform public.app_test_assert(
    has_function_privilege('authenticated','public.app_op_payments_read(jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.app_op_payments_read(jsonb)','EXECUTE'),
    'PRE-LIVE pagination remains owner-only');
  v_first := public.app_op_payments_read(v_base);
  v_second := public.app_op_payments_read(v_base ||
    jsonb_build_object('cursor',v_first->'next_cursor'));
  v_third := public.app_op_payments_read(v_base ||
    jsonb_build_object('cursor',v_second->'next_cursor'));
  v_fourth := public.app_op_payments_read(v_base ||
    jsonb_build_object('cursor',v_third->'next_cursor'));
  v_ids := array[v_first->'rows'->0->>'id',v_second->'rows'->0->>'id',
    v_third->'rows'->0->>'id'];
  perform public.app_test_assert(
    v_first->>'total_count'='3'
    and v_first->>'returned'='1'
    and v_first->'next_cursor' is not null
    and v_second->'next_cursor' is not null
    and v_third->'next_cursor'='null'::jsonb
    and v_ids[1]<>v_ids[2] and v_ids[2]<>v_ids[3]
    and v_ids[1]<>v_ids[3]
    and v_ids @> array['P_PAG_A','P_PAG_B','P_F5A_OUT'],
    'PRE-LIVE 3 payments span pages exactly once, including same-date tie');
  perform public.app_test_assert(
    v_first->>'period_opening_piastres'=v_second->>'period_opening_piastres'
    and v_first->>'period_closing_piastres'=v_second->>'period_closing_piastres'
    and v_first->>'current_cash_balance_piastres'=v_third->>'current_cash_balance_piastres',
    'PRE-LIVE all pages retain the same FIN-05 exact cash balances');
  perform public.app_test_assert(
    v_first->'next_cursor' ? 'created_at'
    and v_first->'next_cursor' ? 'date'
    and v_first->'next_cursor' ? 'id',
    'PRE-LIVE cursor includes stable three-part order');
end;
$pagination$;

select public.app_test_expect_error(
  $q$select public.app_op_payments_read('{"vehicle_id":"V_F5_A",
    "responsible_contractor_id":"K_AHMED","cursor":{"date":"2026-11-04","id":"X"}}'::jsonb)$q$,
  'PRE-LIVE incomplete cursor fails closed',array['22023']);
select public.app_test_expect_error(
  $q$select public.app_op_payments_read('{"vehicle_id":"V_F5_A",
    "responsible_contractor_id":"K_AHMED","cursor":"bad"}'::jsonb)$q$,
  'PRE-LIVE non-object cursor fails closed',array['22023']);
