-- Generated with Supabase CLI; ordered after the existing 12:00 migration.
-- No hosted database is touched. Read-only reports use one statement snapshot.
reset role;
alter function public.app_op_trips_read(jsonb) stable;
create or replace function public.app_op_vehicle_cash_statement_read(p_payload jsonb)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.app_require_owner();
  v_base jsonb;
  v_vehicle text := public.app_require_text(p_payload->>'vehicle_id','vehicle');
  v_contractor text := public.app_require_text(p_payload->>'responsible_contractor_id','contractor');
  v_from date := public.app_require_text(p_payload->>'date_from','date_from')::date;
  v_to date := public.app_require_text(p_payload->>'date_to','date_to')::date;
  v_limit integer := coalesce((p_payload->>'limit')::integer,200);
  v_date date;
  v_kind integer;
  v_id text;
  v_rows jsonb;
  v_next jsonb := null;
  v_count bigint;
  v_fetched integer;
  v_work numeric;
  v_paid numeric;
begin
  -- Reuse the audited FIN-05 account/date/opening boundary validation.
  v_base := public.app_op_payments_read((p_payload-'cursor') || jsonb_build_object('limit',1));
  if v_limit<1 or v_limit>200 then raise exception 'Invalid page size' using errcode='22023'; end if;
  if p_payload ? 'cursor' then
    if jsonb_typeof(p_payload->'cursor') <> 'object' then
      raise exception 'Invalid cash cursor' using errcode='22023';
    end if;
    v_date := (p_payload->'cursor'->>'date')::date;
    v_kind := (p_payload->'cursor'->>'kind')::integer;
    v_id := nullif(p_payload->'cursor'->>'id','');
    if v_date is null or v_kind not in (0,1) or v_kind is null or v_id is null then
      raise exception 'Incomplete cash cursor' using errcode='22023';
    end if;
  end if;
  with movements as (
    select t.id,t.trip_date as date,0 as kind,'WORK'::text as movement_type,
      t.vehicle_total_piastres::numeric as delta,t.origin,t.destination,t.notes
    from public.trips t
    where t.vehicle_id=v_vehicle and t.responsible_contractor_id=v_contractor
      and not t.is_cancelled and t.trip_date between v_from and v_to
    union all
    select p.id,p.payment_date,1,'PAYMENT',-p.amount_piastres::numeric,null,null,p.notes
    from public.payments p
    where p.vehicle_id=v_vehicle and p.responsible_contractor_id=v_contractor
      and not p.is_cancelled and p.payment_date between v_from and v_to
  ), ledger as (
    select *,((v_base->>'period_opening_piastres')::numeric + sum(delta)
      over(order by date,kind,id rows between unbounded preceding and current row))::text
      as running_balance_piastres from movements
  ), filtered as (
    select * from ledger where v_date is null or (date,kind,id)>(v_date,v_kind,v_id)
    order by date,kind,id limit v_limit+1
  ), page as (select * from filtered order by date,kind,id limit v_limit)
  select (select count(*) from movements),
    (select coalesce(sum(delta) filter(where kind=0),0) from movements),
    (select coalesce(-sum(delta) filter(where kind=1),0) from movements),
    (select count(*) from filtered),
    (select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'kind',kind,
      'movement_type',movement_type,'signed_delta_piastres',delta::text,
      'running_balance_piastres',running_balance_piastres,
      'origin',origin,'destination',destination,'notes',notes) order by date,kind,id),'[]'::jsonb)
      from page)
  into v_count,v_work,v_paid,v_fetched,v_rows;
  if (v_base->>'period_opening_piastres')::numeric+v_work-v_paid <>
     (v_base->>'period_closing_piastres')::numeric then
    raise exception 'Cash ledger does not reconcile' using errcode='22023';
  end if;
  if v_fetched>v_limit then
    v_next := jsonb_build_object('date',v_rows->(v_limit-1)->>'date',
      'kind',(v_rows->(v_limit-1)->>'kind')::integer,'id',v_rows->(v_limit-1)->>'id');
  end if;
  return jsonb_build_object('status','OK','date_from',v_from,'date_to',v_to,
    'vehicle_id',v_vehicle,'responsible_contractor_id',v_contractor,
    'period_opening_piastres',v_base->>'period_opening_piastres',
    'period_closing_piastres',v_base->>'period_closing_piastres',
    'current_cash_balance_piastres',v_base->>'current_cash_balance_piastres',
    'work_piastres',v_work::text,'paid_piastres',v_paid::text,
    'total_count',v_count::text,'rows',v_rows,'next_cursor',v_next);
end;
$$;
revoke all on function public.app_op_vehicle_cash_statement_read(jsonb) from public,anon,authenticated;
grant execute on function public.app_op_vehicle_cash_statement_read(jsonb) to authenticated;

create or replace function public.app_op_report_read(p_operation text,p_payload jsonb)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare
  v_owner uuid := public.app_require_owner();
  v_revision text;
  v_result jsonb;
  v_totals jsonb;
begin
  -- Count PLUS max detects a lower identity committing after a higher identity.
  -- Append-only audit entries and the STABLE statement snapshot cover every page.
  select count(*)::text || ':' || coalesce(max(id),0)::text into v_revision from public.audit_log;
  if p_payload ? 'cursor' and
     (p_payload->>'snapshot' is null or p_payload->>'snapshot'<>v_revision) then
    raise exception 'Report changed; reload from the first page' using errcode='40001';
  end if;
  case p_operation
    when 'trips.list' then
      v_result := public.app_op_trips_read(p_payload);
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
        and t.trip_date between (p_payload->>'date_from')::date and (p_payload->>'date_to')::date
        and (nullif(btrim(p_payload->>'vehicle_id'),'') is null or t.vehicle_id=p_payload->>'vehicle_id')
        and (nullif(btrim(p_payload->>'counterparty_contractor_id'),'') is null or
          t.counterparty_contractor_id=p_payload->>'counterparty_contractor_id');
      v_result := v_result || jsonb_build_object('totals',v_totals);
    when 'payments.list' then v_result := public.app_op_payments_read(p_payload);
    when 'contractor.statement' then v_result := public.app_op_contractor_statement_read(p_payload);
    when 'cash.statement' then v_result := public.app_op_vehicle_cash_statement_read(p_payload);
    else raise exception 'Unknown report' using errcode='22023';
  end case;
  return v_result || jsonb_build_object('snapshot',v_revision);
end;
$$;
revoke all on function public.app_op_report_read(text,jsonb) from public,anon,authenticated;
grant execute on function public.app_op_report_read(text,jsonb) to authenticated;
