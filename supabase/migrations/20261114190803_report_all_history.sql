-- Owner-only optional all-history period; existing accounting and pagination stay authoritative.
create or replace function public.app_op_report_read(p_operation text,p_payload jsonb)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare
  v_owner uuid := public.app_require_owner();
  v_revision text;
  v_result jsonb;
  v_totals jsonb;
  v_payload jsonb := p_payload;
  v_from date;
  v_to date;
  v_opening date;
  v_all boolean := false;
begin
  if p_payload ? 'all_history' then
    if jsonb_typeof(p_payload->'all_history') <> 'boolean' then
      raise exception 'all_history must be boolean' using errcode='22023';
    end if;
    v_all := (p_payload->>'all_history')::boolean;
  end if;
  if v_all then
    if p_operation='contractor.statement' then
      select start_date into v_opening from public.opening_balances
      where balance_type='CONTRACTOR_WORK' and not is_cancelled
        and contractor_id=p_payload->>'counterparty_contractor_id';
      select min(trip_date),max(trip_date) into v_from,v_to from public.trips
      where counterparty_contractor_id=p_payload->>'counterparty_contractor_id'
        and (v_opening is null or trip_date>=v_opening);
    elsif p_operation in ('payments.list','cash.statement') then
      select start_date into v_opening from public.opening_balances
      where balance_type='VEHICLE_CASH' and not is_cancelled
        and vehicle_id=p_payload->>'vehicle_id'
        and contractor_id=p_payload->>'responsible_contractor_id';
      select min(day),max(day) into v_from,v_to from (
        select trip_date as day from public.trips
        where vehicle_id=p_payload->>'vehicle_id' and responsible_contractor_id=p_payload->>'responsible_contractor_id'
        union all
        select payment_date from public.payments
        where vehicle_id=p_payload->>'vehicle_id' and responsible_contractor_id=p_payload->>'responsible_contractor_id'
      ) dates where v_opening is null or day>=v_opening;
    elsif p_operation='trips.list' then
      select min(trip_date),max(trip_date) into v_from,v_to from public.trips
      where (nullif(btrim(p_payload->>'vehicle_id'),'') is null or vehicle_id=p_payload->>'vehicle_id')
        and (nullif(btrim(p_payload->>'counterparty_contractor_id'),'') is null
          or counterparty_contractor_id=p_payload->>'counterparty_contractor_id');
    else
      raise exception 'Unknown report' using errcode='22023';
    end if;
    v_from := coalesce(v_opening,v_from,(clock_timestamp() at time zone 'Africa/Cairo')::date);
    v_to := coalesce(v_to,v_from);
    v_payload := p_payload || jsonb_build_object('date_from',v_from,'date_to',v_to);
  end if;
  -- Count PLUS max detects a lower identity committing after a higher identity.
  -- Append-only audit entries and the STABLE statement snapshot cover every page.
  select count(*)::text || ':' || coalesce(max(id),0)::text into v_revision from public.audit_log;
  if v_payload ? 'cursor' and
     (v_payload->>'snapshot' is null or v_payload->>'snapshot'<>v_revision) then
    raise exception 'Report changed; reload from the first page' using errcode='40001';
  end if;
  case p_operation
    when 'trips.list' then
      v_result := public.app_op_trips_read(v_payload);
      select jsonb_build_object(
        'active_count',count(*)::text,
        'weight_milli_tonnes',coalesce(sum(t.weight_milli_tonnes::numeric),0)::text,
        'contractor_total_piastres',coalesce(sum(t.contractor_total_piastres::numeric),0)::text,
        'vehicle_total_piastres',coalesce(sum(t.vehicle_total_piastres::numeric),0)::text,
        'ahmed_work_piastres',coalesce(sum(t.contractor_total_piastres::numeric)
          filter(where t.direction='AHMED_SUPPLIES'),0)::text,
        'counterparty_work_piastres',coalesce(sum(t.contractor_total_piastres::numeric)
          filter(where t.direction='OTHER_SUPPLIES'),0)::text
      ) into v_totals from public.trips t
      where not t.is_cancelled
        and t.trip_date between (v_payload->>'date_from')::date and (v_payload->>'date_to')::date
        and (nullif(btrim(v_payload->>'vehicle_id'),'') is null or t.vehicle_id=v_payload->>'vehicle_id')
        and (nullif(btrim(v_payload->>'counterparty_contractor_id'),'') is null or
          t.counterparty_contractor_id=v_payload->>'counterparty_contractor_id');
      v_result := v_result || jsonb_build_object('totals',v_totals);
    when 'payments.list' then v_result := public.app_op_payments_read(v_payload);
    when 'contractor.statement' then v_result := public.app_op_contractor_statement_read(v_payload);
    when 'cash.statement' then v_result := public.app_op_vehicle_cash_statement_read(v_payload);
    else raise exception 'Unknown report' using errcode='22023';
  end case;
  return v_result || jsonb_build_object('snapshot',v_revision,'date_from',v_payload->>'date_from',
    'date_to',v_payload->>'date_to','all_history',v_all);
end;
$$;
revoke all on function public.app_op_report_read(text,jsonb) from public,anon,authenticated;
grant execute on function public.app_op_report_read(text,jsonb) to authenticated;
