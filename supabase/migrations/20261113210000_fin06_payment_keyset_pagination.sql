-- FIN-06: deterministic keyset pagination for real historical cash payments.
-- Keep FIN-05 exact opening/closing semantics unchanged.
create or replace function public.app_op_payments_read(p_payload jsonb)
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
    v_vehicle text;
    v_responsible text;
    v_from date;
    v_to date;
    v_count integer;
    v_limit integer;
    v_rows jsonb;
    v_fetched integer;
    v_cursor_date date;
    v_cursor_created timestamptz;
    v_cursor_id text;
    v_next_cursor jsonb := null;
    v_today date := (now() at time zone 'Africa/Cairo')::date;
begin
    v_vehicle := public.app_require_text(v_payload->>'vehicle_id','vehicle id');
    v_responsible := public.app_require_text(v_payload->>'responsible_contractor_id','responsible contractor id');
    if not exists(select 1 from public.vehicle_accounts where vehicle_id=v_vehicle and contractor_id=v_responsible) then
        raise exception 'Vehicle cash account not found' using errcode='23503';
    end if;
    v_from := coalesce((v_payload->>'date_from')::date,'1900-01-01'::date);
    v_to := coalesce((v_payload->>'date_to')::date,v_today);
    if v_from>v_to then raise exception 'Invalid payment date range' using errcode='22023'; end if;
    -- Explicit report periods start on/after their account opening.
    -- Keep the legacy unfiltered payment-list lookup working.
    if v_payload->>'date_from' is not null and exists (
      select 1 from public.opening_balances o
       where o.balance_type='VEHICLE_CASH' and not o.is_cancelled
         and o.vehicle_id=v_vehicle and o.contractor_id=v_responsible
         and v_from<o.start_date
    ) then
      raise exception 'Payment report starts before vehicle cash opening'
        using errcode='22023';
    end if;
    v_limit := coalesce((v_payload->>'limit')::integer,100);
    if v_limit<1 or v_limit>200 then raise exception 'Read limit out of range' using errcode='22023'; end if;
    select count(*) into v_count from public.payments p
      where p.vehicle_id=v_vehicle and p.responsible_contractor_id=v_responsible
      and p.payment_date between v_from and v_to
      and (coalesce((v_payload->>'include_cancelled')::boolean,false) or not p.is_cancelled);
    -- Keyset order is deterministic even for equal dates and timestamps.
    -- A cursor is only accepted with all three fields.
    if v_payload ? 'cursor' then
      if jsonb_typeof(v_payload->'cursor') <> 'object' then
        raise exception 'Payment cursor must be an object' using errcode='22023';
      end if;
      v_cursor_date := nullif(v_payload->'cursor'->>'date','')::date;
      v_cursor_created := nullif(v_payload->'cursor'->>'created_at','')::timestamptz;
      v_cursor_id := nullif(btrim(v_payload->'cursor'->>'id'),'');
      if v_cursor_date is null or v_cursor_created is null or v_cursor_id is null then
        raise exception 'Payment cursor requires date, created_at and id' using errcode='22023';
      end if;
    end if;
    with filtered as (
      select p.id,p.vehicle_id,p.responsible_contractor_id,p.payment_date,
        p.amount_piastres::text as amount_piastres,
        p.linked_trip_id,p.receipt_number,p.notes,p.is_cancelled,p.cancel_reason,
        p.version,p.created_at
      from public.payments p
      where p.vehicle_id=v_vehicle and p.responsible_contractor_id=v_responsible
        and p.payment_date between v_from and v_to
        and (coalesce((v_payload->>'include_cancelled')::boolean,false) or not p.is_cancelled)
        and (v_cursor_date is null or
          (p.payment_date,p.created_at,p.id) < (v_cursor_date,v_cursor_created,v_cursor_id))
      order by p.payment_date desc,p.created_at desc,p.id desc
      limit v_limit + 1
    ),
    page as (select * from filtered limit v_limit)
    select (select count(*) from filtered),
      (select coalesce(jsonb_agg(to_jsonb(x) order by x.payment_date desc,
         x.created_at desc,x.id desc),'[]'::jsonb) from page x)
      into v_fetched,v_rows;
    if v_fetched > v_limit then
      v_next_cursor := jsonb_build_object(
        'date',(v_rows->(jsonb_array_length(v_rows)-1))->>'payment_date',
        'created_at',(v_rows->(jsonb_array_length(v_rows)-1))->>'created_at',
        'id',(v_rows->(jsonb_array_length(v_rows)-1))->>'id'
      );
    end if;
    return jsonb_build_object('status','OK','rows',v_rows,'total_count',v_count,'next_cursor',v_next_cursor,
      -- Retain original field for compatibility and make its CURRENT meaning explicit.
      'cash_balance_piastres',public.app_payment_cash_balance(v_vehicle,v_responsible,v_today)::text,
      'current_cash_balance_piastres',public.app_payment_cash_balance(v_vehicle,v_responsible,v_today)::text,
      'period_closing_piastres',public.app_payment_cash_balance(v_vehicle,v_responsible,v_to)::text,
      -- An opening created ON the first report day belongs to the initial
      -- balance of that report; otherwise do not count it twice.
      'period_opening_piastres',(
        public.app_payment_cash_balance(v_vehicle,v_responsible,v_from-1)
        + coalesce((
          select o.signed_piastres::numeric from public.opening_balances o
           where o.balance_type='VEHICLE_CASH' and not o.is_cancelled
             and o.vehicle_id=v_vehicle and o.contractor_id=v_responsible
             and o.start_date=v_from
        ),0::numeric)
      )::text);
end;
$$;

-- Owner gate stays inside the SECURITY DEFINER function; anon cannot call it.
revoke execute on function public.app_op_payments_read(jsonb) from public, anon, authenticated;
grant execute on function public.app_op_payments_read(jsonb) to authenticated;
