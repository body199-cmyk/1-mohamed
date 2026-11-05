-- H048 / T08.2. D15 = daily work before same-day payments.
-- D16 = A: no new/backdated payment may create a negative end-of-day
-- cash balance on ANY date between payment date and Cairo evaluation date.
-- This is an additive migration. Existing trip RPCs remain untouched;
-- corrections of already-paid work remain possible under D13.
-- Financial writes use owner-gated, auditable, idempotent transaction RPCs.

-- Exact, account-specific cash balance at end of a calendar date.
-- Numeric arithmetic prevents intermediate bigint overflow.
create function public.app_payment_cash_balance(
    p_vehicle_id text, p_responsible_id text, p_date date, p_exclude_payment text default null
) returns numeric
language sql stable security definer
set search_path = pg_catalog, public
as $$
    select coalesce((
      select signed_piastres::numeric
      from public.opening_balances
      where balance_type='VEHICLE_CASH' and not is_cancelled
        and vehicle_id=p_vehicle_id and contractor_id=p_responsible_id
        and start_date<=p_date
      limit 1
    ), 0::numeric)
    + coalesce((
      select sum(vehicle_total_piastres::numeric) from public.trips
      where not is_cancelled and vehicle_id=p_vehicle_id
        and responsible_contractor_id=p_responsible_id and trip_date<=p_date
    ), 0::numeric)
    - coalesce((
      select sum(amount_piastres::numeric) from public.payments
      where not is_cancelled and vehicle_id=p_vehicle_id
        and responsible_contractor_id=p_responsible_id and payment_date<=p_date
        and (p_exclude_payment is null or id<>p_exclude_payment)
    ), 0::numeric);
$$;

-- D16: minimum end-of-day balance over the complete event timeline.
-- All work of day D is credited before day-D payments (D15).
-- The lowest same-day balance occurs after ALL day-D payments, so
-- checking one EOD per event date also checks the daily payment sequence.
create function public.app_payment_min_available(
    p_vehicle_id text, p_responsible_id text, p_from date,
    p_until date, p_exclude_payment text default null
) returns numeric
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
    v_opening numeric := 0;
    v_start date;
    v_min numeric;
begin
    if p_from is null or p_until is null or p_from > p_until then
        raise exception 'Invalid payment evaluation period' using errcode='22023';
    end if;
    if not exists (
        select 1 from public.vehicle_accounts
        where vehicle_id=p_vehicle_id and contractor_id=p_responsible_id
    ) then
        raise exception 'Vehicle cash account does not exist' using errcode='23503';
    end if;
    select signed_piastres::numeric, start_date
      into v_opening, v_start
      from public.opening_balances
     where balance_type='VEHICLE_CASH' and not is_cancelled
       and vehicle_id=p_vehicle_id and contractor_id=p_responsible_id
     limit 1;
    if v_start is not null and p_from < v_start then
        raise exception 'Payment date precedes cash opening start date %', v_start
            using errcode='22023';
    end if;
    v_opening := coalesce(v_opening, 0);
    with raw_events as (
      select trip_date d, vehicle_total_piastres::numeric amount
        from public.trips
       where not is_cancelled and vehicle_id=p_vehicle_id
         and responsible_contractor_id=p_responsible_id and trip_date<=p_until
      union all
      select payment_date d, -amount_piastres::numeric amount
        from public.payments
       where not is_cancelled and vehicle_id=p_vehicle_id
         and responsible_contractor_id=p_responsible_id and payment_date<=p_until
         and (p_exclude_payment is null or id<>p_exclude_payment)
      union all
      select p_from, 0::numeric
      union all
      select p_until, 0::numeric
    ), by_day as (
      select d, sum(amount) amount from raw_events group by d
    ), running as (
      select d, v_opening + sum(amount) over (order by d) balance
      from by_day
    )
    select min(balance) into v_min from running where d>=p_from;
    return v_min;
end;
$$;

create function public.app_payment_assert_available(
    p_vehicle_id text, p_responsible_id text,
    p_date date, p_amount bigint, p_exclude_payment text default null
) returns numeric
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
    v_today date := (now() at time zone 'Africa/Cairo')::date;
    v_min numeric;
begin
    if p_date is null or p_date > v_today then
        raise exception 'Payment date cannot be in the future' using errcode='22023';
    end if;
    if p_amount is null or p_amount <= 0 then
        raise exception 'Payment amount must be positive' using errcode='22023';
    end if;
    v_min := public.app_payment_min_available(
      p_vehicle_id, p_responsible_id, p_date, v_today, p_exclude_payment
    );
    if v_min < p_amount::numeric then
        raise exception
          'D16: payment % piastres exceeds minimum available % piastres from % to % for vehicle % and contractor %',
          p_amount, v_min, p_date, v_today, p_vehicle_id, p_responsible_id
          using errcode='P2016';
    end if;
    return v_min;
end;
$$;

-- All individual payment RPCs MUST lock the same cash-account key as trip RPCs.
-- The lock serializes payment-versus-trip writes per cash account.
create function public.app_op_payment_create(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_vehicle text;
    v_responsible text;
    v_date date;
    v_amount bigint;
    v_link text;
    v_result jsonb;
    v_available numeric;
begin
    v_gate := public.app_idempotency_begin(p_request_key,'payment.create',v_payload,v_user);
    if (v_gate->>'__replay')::boolean then return v_gate->'response'; end if;
    v_id := public.app_require_text(v_payload->>'id','payment id');
    v_vehicle := public.app_require_text(v_payload->>'vehicle_id','vehicle id');
    v_responsible := public.app_require_text(v_payload->>'responsible_contractor_id','responsible contractor id');
    v_date := public.app_require_text(v_payload->>'payment_date','payment date')::date;
    v_amount := public.app_require_decimal_string(v_payload,'amount_egp',2);
    v_link := nullif(btrim(coalesce(v_payload->>'linked_trip_id','')),'');
    if v_amount<=0 then raise exception 'Payment amount must be positive' using errcode='22023'; end if;
    perform public.app_lock_trip_accounts(array[v_vehicle||'|'||v_responsible]);
    if not exists(select 1 from public.vehicle_accounts a join public.vehicles v on v.id=a.vehicle_id
        join public.contractors c on c.id=a.contractor_id
        where a.vehicle_id=v_vehicle and a.contractor_id=v_responsible
          and not v.is_archived and not c.is_archived) then
        raise exception 'Active vehicle cash account required' using errcode='23503';
    end if;
    v_available := public.app_payment_assert_available(v_vehicle,v_responsible,v_date,v_amount);
    insert into public.payments
      (id,vehicle_id,responsible_contractor_id,payment_date,amount_piastres,linked_trip_id,receipt_number,notes)
    values (v_id,v_vehicle,v_responsible,v_date,v_amount,v_link,
        nullif(v_payload->>'receipt_number',''),nullif(v_payload->>'notes',''));
    perform public.app_write_audit(
      'PAYMENT',v_id,'INSERT',null,null,
      jsonb_build_object('id',v_id,'vehicle_id',v_vehicle,'responsible_contractor_id',v_responsible,
          'payment_date',v_date,'amount_piastres',v_amount::text,'linked_trip_id',v_link,
          'receipt_number',v_payload->>'receipt_number','notes',v_payload->>'notes','version',1),
      null,jsonb_build_object('cash_delta_piastres',(-v_amount::numeric)::text,
          'minimum_before_piastres',v_available::text),v_user
    );
    v_result := jsonb_build_object('status','OK','payment_id',v_id,'version',1,
      'amount_piastres',v_amount::text,'remaining_piastres',
      public.app_payment_cash_balance(v_vehicle,v_responsible,(now() at time zone 'Africa/Cairo')::date)::text);
    perform public.app_idempotency_complete(p_request_key,v_result);
    return v_result;
end;
$$;

create function public.app_op_payment_update(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
    v_gate jsonb;
    v_old public.payments%rowtype;
    v_id text;
    v_expected integer;
    v_reason text;
    v_vehicle text;
    v_responsible text;
    v_date date;
    v_amount bigint;
    v_link text;
    v_available numeric;
    v_result jsonb;
begin
    v_gate := public.app_idempotency_begin(p_request_key,'payment.update',v_payload,v_user);
    if (v_gate->>'__replay')::boolean then return v_gate->'response'; end if;
    v_id := public.app_require_text(v_payload->>'id','payment id');
    v_reason := public.app_require_text(v_payload->>'reason','edit reason');
    v_expected := (v_payload->>'expected_version')::integer;
    if v_expected is null or v_expected<1 then
        raise exception 'Expected version required' using errcode='22023';
    end if;
    select * into v_old from public.payments where id=v_id for update;
    if not found or v_old.is_cancelled then
        raise exception 'Active payment not found' using errcode='22023';
    end if;
    if v_old.version<>v_expected then
        raise exception 'Payment version conflict' using errcode='P2003';
    end if;
    v_vehicle := public.app_require_text(v_payload->>'vehicle_id','vehicle id');
    v_responsible := public.app_require_text(v_payload->>'responsible_contractor_id','responsible contractor id');
    v_date := public.app_require_text(v_payload->>'payment_date','payment date')::date;
    v_amount := public.app_require_decimal_string(v_payload,'amount_egp',2);
    v_link := nullif(btrim(coalesce(v_payload->>'linked_trip_id','')),'');
    perform public.app_lock_trip_accounts(array[
      v_old.vehicle_id||'|'||v_old.responsible_contractor_id,
      v_vehicle||'|'||v_responsible
    ]);
    if not exists(select 1 from public.vehicle_accounts a
        where a.vehicle_id=v_vehicle and a.contractor_id=v_responsible) then
        raise exception 'Vehicle cash account does not exist' using errcode='23503';
    end if;
    -- D13-B: remove OLD payment exactly once at its ORIGINAL account/date,
    -- even if the user changes date or moves the payment to a new account.
    v_available := public.app_payment_assert_available(
      v_vehicle,v_responsible,v_date,v_amount,v_id
    );
    update public.payments set
      vehicle_id=v_vehicle,responsible_contractor_id=v_responsible,
      payment_date=v_date,amount_piastres=v_amount,linked_trip_id=v_link,
      receipt_number=nullif(v_payload->>'receipt_number',''),
      notes=nullif(v_payload->>'notes',''),
      version=version+1,updated_at=now()
    where id=v_id;
    perform public.app_write_audit(
      'PAYMENT',v_id,'UPDATE',v_reason,to_jsonb(v_old),
      (select to_jsonb(p) from public.payments p where id=v_id),
      jsonb_build_object('old_amount_piastres',v_old.amount_piastres::text,
          'new_amount_piastres',v_amount::text,
          'old_account',v_old.vehicle_id||'|'||v_old.responsible_contractor_id,
          'new_account',v_vehicle||'|'||v_responsible),
      jsonb_build_object('cash_delta_new_piastres',(-v_amount::numeric)::text,
          'cash_released_old_piastres',v_old.amount_piastres::text,
          'minimum_before_piastres',v_available::text),v_user
    );
    v_result := jsonb_build_object('status','OK','payment_id',v_id,
      'version',v_old.version+1,'amount_piastres',v_amount::text,
      'remaining_piastres',
        public.app_payment_cash_balance(v_vehicle,v_responsible,(now() at time zone 'Africa/Cairo')::date)::text);
    perform public.app_idempotency_complete(p_request_key,v_result);
    return v_result;
end;
$$;

create function public.app_op_payment_cancel(p_request_key text,p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
    v_gate jsonb;
    v_old public.payments%rowtype;
    v_id text;
    v_expected integer;
    v_reason text;
    v_result jsonb;
begin
    v_gate := public.app_idempotency_begin(p_request_key,'payment.cancel',v_payload,v_user);
    if (v_gate->>'__replay')::boolean then return v_gate->'response'; end if;
    v_id := public.app_require_text(v_payload->>'id','payment id');
    v_reason := public.app_require_text(v_payload->>'reason','cancellation reason');
    v_expected := (v_payload->>'expected_version')::integer;
    if v_expected is null or v_expected<1 then raise exception 'Expected version required' using errcode='22023'; end if;
    select * into v_old from public.payments where id=v_id for update;
    if not found or v_old.is_cancelled then raise exception 'Active payment not found' using errcode='22023'; end if;
    if v_old.version<>v_expected then raise exception 'Payment version conflict' using errcode='P2003'; end if;
    perform public.app_lock_trip_accounts(array[v_old.vehicle_id||'|'||v_old.responsible_contractor_id]);
    update public.payments set
      is_cancelled=true,cancel_reason=v_reason,cancelled_at=now(),
      version=version+1,updated_at=now()
    where id=v_id;
    perform public.app_write_audit(
      'PAYMENT',v_id,'CANCEL',v_reason,to_jsonb(v_old),
      (select to_jsonb(p) from public.payments p where id=v_id),
      null,jsonb_build_object('cash_released_piastres',v_old.amount_piastres::text),v_user
    );
    v_result := jsonb_build_object('status','OK','payment_id',v_id,
       'is_cancelled',true,'version',v_old.version+1,
       'remaining_piastres',
       public.app_payment_cash_balance(v_old.vehicle_id,v_old.responsible_contractor_id,
         (now() at time zone 'Africa/Cairo')::date)::text);
    perform public.app_idempotency_complete(p_request_key,v_result);
    return v_result;
end;
$$;

create function public.app_op_payments_read(p_payload jsonb)
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
      'cash_balance_piastres',public.app_payment_cash_balance(v_vehicle,v_responsible,v_today)::text,
      'period_opening_piastres',
      public.app_payment_cash_balance(v_vehicle,v_responsible,v_from-1)::text);
end;
$$;

revoke execute on function
  public.app_payment_cash_balance(text,text,date,text),
  public.app_payment_min_available(text,text,date,date,text),
  public.app_payment_assert_available(text,text,date,bigint,text),
  public.app_op_payment_create(text,jsonb),
  public.app_op_payment_update(text,jsonb),
  public.app_op_payment_cancel(text,jsonb),
  public.app_op_payments_read(jsonb)
from public,anon,authenticated;

grant execute on function
  public.app_op_payment_create(text,jsonb),
  public.app_op_payment_update(text,jsonb),
  public.app_op_payment_cancel(text,jsonb),
  public.app_op_payments_read(jsonb)
to authenticated;
