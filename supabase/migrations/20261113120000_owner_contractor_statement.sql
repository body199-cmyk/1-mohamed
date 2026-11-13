-- PRE-LIVE-03: owner-only, SQL-authoritative contractor settlement statement.
-- Positive signed balance = Ahmed is owed; negative = counterparty is owed.
-- Contractor WORK opening is independent of VEHICLE_CASH and payment entries.
-- Supports keyset history without truncating totals; no browser recomputation.
create or replace function public.app_op_contractor_statement_read(p_payload jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_counterparty text;
    v_from date;
    v_to date;
    v_limit integer;
    v_opening_start date;
    v_seed numeric := 0;
    v_period_opening numeric := 0;
    v_ahmed numeric := 0;
    v_other numeric := 0;
    v_closing numeric := 0;
    v_total bigint := 0;
    v_fetched integer := 0;
    v_rows jsonb := '[]'::jsonb;
    v_next jsonb := null;
    v_cursor_date date;
    v_cursor_id text;
begin
    v_counterparty := public.app_require_text(
        v_payload->>'counterparty_contractor_id','counterparty contractor id');
    if not exists (select 1 from public.contractors c
                   where c.id=v_counterparty and not c.is_primary) then
        raise exception 'Statement requires an existing non-primary counterparty'
          using errcode='22023';
    end if;
    v_from := public.app_require_text(v_payload->>'date_from','date_from')::date;
    v_to := public.app_require_text(v_payload->>'date_to','date_to')::date;
    if v_from>v_to then
        raise exception 'Invalid contractor statement period' using errcode='22023';
    end if;
    v_limit := coalesce((v_payload->>'limit')::integer, 100);
    if v_limit<1 or v_limit>200 then
        raise exception 'Statement page size out of range' using errcode='22023';
    end if;
    if v_payload ? 'cursor' then
        if jsonb_typeof(v_payload->'cursor') <> 'object' then
            raise exception 'Statement cursor must be an object' using errcode='22023';
        end if;
        v_cursor_date := nullif(v_payload->'cursor'->>'date','')::date;
        v_cursor_id := nullif(btrim(coalesce(v_payload->'cursor'->>'id','')),'');
        if v_cursor_date is null or v_cursor_id is null then
            raise exception 'Statement cursor needs date and id' using errcode='22023';
        end if;
    end if;

    select o.start_date, o.signed_piastres::numeric
      into v_opening_start, v_seed
      from public.opening_balances o
     where o.balance_type='CONTRACTOR_WORK'
       and o.contractor_id=v_counterparty
       and not o.is_cancelled;
    v_seed := coalesce(v_seed,0::numeric);
    if v_opening_start is not null and v_from<v_opening_start then
        raise exception 'Statement period starts before contractor work opening'
          using errcode='22023';
    end if;

    select v_seed + coalesce(sum(
        case when t.direction='AHMED_SUPPLIES' then t.contractor_total_piastres::numeric
             else -t.contractor_total_piastres::numeric end),0::numeric)
      into v_period_opening
      from public.trips t
     where t.counterparty_contractor_id=v_counterparty and not t.is_cancelled
       and t.trip_date<v_from
       and (v_opening_start is null or t.trip_date>=v_opening_start);

    select coalesce(sum(t.contractor_total_piastres::numeric)
         filter (where t.direction='AHMED_SUPPLIES'),0::numeric),
           coalesce(sum(t.contractor_total_piastres::numeric)
         filter (where t.direction='OTHER_SUPPLIES'),0::numeric),
           count(*)
      into v_ahmed,v_other,v_total
      from public.trips t
     where t.counterparty_contractor_id=v_counterparty and not t.is_cancelled
       and t.trip_date between v_from and v_to;
    v_closing := v_period_opening + v_ahmed - v_other;

    -- Compute running balance on the FULL period before slicing the keyset page.
    with movements as (
      select t.id,t.trip_date,t.vehicle_id,t.origin,t.destination,t.notes,
        t.direction,t.weight_milli_tonnes::text as weight_milli_tonnes,
        t.contractor_total_piastres::text as contractor_total_piastres,
        (case when t.direction='AHMED_SUPPLIES' then t.contractor_total_piastres::numeric
              else -t.contractor_total_piastres::numeric end)::text as signed_delta_piastres,
        (v_period_opening + sum(
          case when t.direction='AHMED_SUPPLIES' then t.contractor_total_piastres::numeric
               else -t.contractor_total_piastres::numeric end)
          over (order by t.trip_date asc,t.id asc rows between unbounded preceding and current row)
        )::text as running_balance_piastres
      from public.trips t
      where t.counterparty_contractor_id=v_counterparty and not t.is_cancelled
        and t.trip_date between v_from and v_to
    ), filtered as (
      select * from movements m
       where v_cursor_date is null or (m.trip_date,m.id)>(v_cursor_date,v_cursor_id)
       order by m.trip_date asc,m.id asc
       limit v_limit+1
    ), page as (
      select * from filtered limit v_limit
    )
    select
      (select count(*) from filtered),
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.trip_date asc,p.id asc),
                       '[]'::jsonb) from page p)
      into v_fetched,v_rows;

    if v_fetched>v_limit then
      v_next := jsonb_build_object(
        'date',v_rows->(jsonb_array_length(v_rows)-1)->>'trip_date',
        'id',v_rows->(jsonb_array_length(v_rows)-1)->>'id');
    end if;

    return jsonb_build_object(
      'status','OK',
      'counterparty_contractor_id',v_counterparty,
      'date_from',v_from,'date_to',v_to,
      'opening_balance_piastres',v_period_opening::text,
      'ahmed_work_piastres',v_ahmed::text,
      'counterparty_work_piastres',v_other::text,
      'closing_balance_piastres',v_closing::text,
      'beneficiary',case when v_closing>0 then 'AHMED'
                         when v_closing<0 then 'COUNTERPARTY'
                         else 'BALANCED' end,
      'balance_magnitude_piastres',abs(v_closing)::text,
      'total_count',v_total::text,
      'returned',jsonb_array_length(v_rows),
      'next_cursor',v_next,'rows',v_rows);
end;
$$;

revoke execute on function public.app_op_contractor_statement_read(jsonb)
  from public,anon,authenticated;
grant execute on function public.app_op_contractor_statement_read(jsonb)
  to authenticated;
