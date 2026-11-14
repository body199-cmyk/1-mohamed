reset role;
set role authenticated;
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
do $$
declare a jsonb; b jsonb; q jsonb; op text; opening record;
begin
  foreach op in array array['trips.list','payments.list','cash.statement','contractor.statement'] loop
    q := '{"vehicle_id":"V_STMT_PRELIVE","responsible_contractor_id":"K_AHMED",
      "counterparty_contractor_id":"K_STMT_PRELIVE","all_history":true,"limit":1}'::jsonb;
    a := public.app_op_report_read(op,q);
    perform public.app_test_assert(a->>'all_history'='true' and a->>'date_from' is not null
      and a->>'date_to' is not null,'All-history resolves actual period for '||op);
    b := public.app_op_report_read(op,(q-'all_history') || jsonb_build_object(
      'date_from',a->>'date_from','date_to',a->>'date_to'));
    perform public.app_test_assert(a->'rows'=b->'rows' and a->>'total_count'=b->>'total_count',
      'All-history preserves original report and filters for '||op);
    if op='contractor.statement' then
      perform public.app_test_assert(a->>'opening_balance_piastres'=b->>'opening_balance_piastres'
        and a->>'closing_balance_piastres'=b->>'closing_balance_piastres','Work opening and closing preserved');
    end if;
    if a->'next_cursor' <> 'null'::jsonb then
      b := public.app_op_report_read(op,q||jsonb_build_object('cursor',a->'next_cursor','snapshot',a->>'snapshot'));
      perform public.app_test_assert(a->>'date_from'=b->>'date_from' and a->>'date_to'=b->>'date_to'
        and a->'rows'<>b->'rows','All-history cursor retains scope without duplicate page');
    end if;
  end loop;
  for opening in select * from public.opening_balances where not is_cancelled loop
    op := case when opening.balance_type='CONTRACTOR_WORK' then 'contractor.statement' else 'cash.statement' end;
    a := public.app_op_report_read(op,jsonb_build_object('all_history',true,
      'counterparty_contractor_id',opening.contractor_id,'responsible_contractor_id',opening.contractor_id,
      'vehicle_id',opening.vehicle_id,'limit',1));
    perform public.app_test_assert(a->>'date_from'=opening.start_date::text,
      'Complete account starts at its actual opening, never a sentinel date');
  end loop;
end $$;
select public.app_test_expect_error($q$select public.app_op_report_read('trips.list','{"all_history":"true"}')$q$,
 'Only a boolean history flag is accepted',array['22023']);
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000002';
select public.app_test_expect_error($q$select public.app_op_report_read('trips.list','{"all_history":true}')$q$,
 'Whole history cannot bypass owner authorization',array['42501']);
set "request.jwt.claim.sub"='00000000-0000-0000-0000-000000000001';
