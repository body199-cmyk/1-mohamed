-- FIN-05: preserve payment-read compatibility while separating exact
-- period opening/closing from the current balance and counting opening-day seed once.
-- Do not change or backdate historical payments.
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
    if v_payload ? 'date_from' and exists (
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
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows from (
      select id,vehicle_id,responsible_contractor_id,payment_date,
        amount_piastres::text as amount_piastres,
        linked_trip_id,receipt_number,notes,is_cancelled,cancel_reason,
        version,created_at from public.payments p
      where p.vehicle_id=v_vehicle and p.responsible_contractor_id=v_responsible
        and p.payment_date between v_from and v_to
        and (coalesce((v_payload->>'include_cancelled')::boolean,false) or not p.is_cancelled)
      order by payment_date desc,created_at desc,id desc limit v_limit
    ) x;
    return jsonb_build_object('status','OK','rows',v_rows,'total_count',v_count,
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
