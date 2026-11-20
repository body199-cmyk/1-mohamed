-- Additive, owner-only reactivation of records retained by ordinary cancellation.
-- NOT an import/merge/overwrite from an untrusted backup file.
-- Both transactions are idempotent and audited, with optimistic version checks.
-- Cash payment reactivation obeys the existing D15/D16 historical minimum.
-- A canceled trip reactivation is subject to the existing FIN-04 opening trigger.

create function public.app_op_trip_reactivate(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := public.app_require_owner();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_gate jsonb;
  v_id text;
  v_reason text;
  v_expected integer;
  v_old public.trips%rowtype;
  v_new public.trips%rowtype;
  v_response jsonb;
begin
  v_gate := public.app_idempotency_begin(p_request_key, 'trip.reactivate', v_payload, v_user);
  if (v_gate->>'__replay')::boolean then return v_gate->'response'; end if;

  v_id := public.app_require_text(v_payload->>'id', 'trip id');
  v_reason := public.app_require_text(v_payload->>'reason', 'recovery reason');
  if length(v_reason) > 400 then
    raise exception 'Recovery reason too long' using errcode = '22023';
  end if;
  v_expected := (v_payload->>'expected_version')::integer;
  if v_expected is null or v_expected < 1 then
    raise exception 'Expected version required' using errcode='22023';
  end if;

  select * into v_old from public.trips where id = v_id for update;
  if not found or not v_old.is_cancelled then
    raise exception 'Canceled trip was not found' using errcode='22023';
  end if;
  if v_old.version <> v_expected then
    raise exception 'Version conflict' using errcode='P2003';
  end if;

  perform public.app_lock_trip_accounts(array[v_old.vehicle_id||'|'||v_old.responsible_contractor_id]);

  update public.trips set
    is_cancelled = false,
    cancel_reason = null,
    cancelled_at = null,
    version = version + 1,
    updated_at = now()
  where id = v_id
  returning * into v_new;
  -- FIN-04 trigger validates the original cash account and opening start.

  perform public.app_write_audit(
    'TRIP', v_id, 'UPDATE', 'استعادة إلغاء: '||v_reason, to_jsonb(v_old), to_jsonb(v_new),
    jsonb_build_object('is_cancelled', jsonb_build_array(true,false),
      'recovered_version',v_new.version),
    jsonb_build_object('cash_work_restored_piastres',v_old.vehicle_total_piastres::text,
      'contractor_work_restored_piastres',v_old.contractor_total_piastres::text),
    v_user
  );
  v_response := jsonb_build_object(
    'status','OK','trip_id',v_id,'is_cancelled',false,'version',v_new.version,
    'vehicle_total_piastres',v_new.vehicle_total_piastres::text
  );
  perform public.app_idempotency_complete(p_request_key,v_response);
  return v_response;
end;
$$;

create function public.app_op_payment_reactivate(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := public.app_require_owner();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_gate jsonb;
  v_id text;
  v_reason text;
  v_expected integer;
  v_old public.payments%rowtype;
  v_new public.payments%rowtype;
  v_available numeric;
  v_response jsonb;
begin
  v_gate := public.app_idempotency_begin(p_request_key, 'payment.reactivate', v_payload, v_user);
  if (v_gate->>'__replay')::boolean then return v_gate->'response'; end if;

  v_id := public.app_require_text(v_payload->>'id', 'payment id');
  v_reason := public.app_require_text(v_payload->>'reason', 'recovery reason');
  if length(v_reason) > 400 then
    raise exception 'Recovery reason too long' using errcode='22023';
  end if;
  v_expected := (v_payload->>'expected_version')::integer;
  if v_expected is null or v_expected < 1 then
    raise exception 'Expected version required' using errcode='22023';
  end if;

  select * into v_old from public.payments where id = v_id for update;
  if not found or not v_old.is_cancelled then
    raise exception 'Canceled payment was not found' using errcode='22023';
  end if;
  if v_old.version <> v_expected then
    raise exception 'Version conflict' using errcode='P2003';
  end if;

  perform public.app_lock_trip_accounts(array[v_old.vehicle_id||'|'||v_old.responsible_contractor_id]);

  -- The existing D16 check excludes the canceled row and tests every
  -- intermediate historical day before allowing this payment back.
  v_available := public.app_payment_assert_available(
    v_old.vehicle_id, v_old.responsible_contractor_id,
    v_old.payment_date, v_old.amount_piastres, v_id
  );

  update public.payments set
    is_cancelled = false,
    cancel_reason = null,
    cancelled_at = null,
    version = version + 1,
    updated_at = now()
  where id = v_id
  returning * into v_new;

  -- Existing descriptive linked_trip_id remains historical; no rebinding
  -- or per-trip payment allocation is performed.
  perform public.app_write_audit(
    'PAYMENT',v_id,'UPDATE','استعادة إلغاء: '||v_reason,to_jsonb(v_old),to_jsonb(v_new),
    jsonb_build_object('is_cancelled',jsonb_build_array(true,false),
      'recovered_version',v_new.version),
    jsonb_build_object('cash_debited_piastres',v_old.amount_piastres::text,
      'minimum_before_piastres',v_available::text),
    v_user
  );
  v_response := jsonb_build_object(
    'status','OK','payment_id',v_id,'is_cancelled',false,
    'version',v_new.version,'amount_piastres',v_new.amount_piastres::text,
    'remaining_piastres',public.app_payment_cash_balance(
      v_old.vehicle_id,v_old.responsible_contractor_id,
      (now() at time zone 'Africa/Cairo')::date)::text
  );
  perform public.app_idempotency_complete(p_request_key,v_response);
  return v_response;
end;
$$;

revoke all on function
  public.app_op_trip_reactivate(text,jsonb),
  public.app_op_payment_reactivate(text,jsonb)
from public, anon, authenticated;
grant execute on function
  public.app_op_trip_reactivate(text,jsonb),
  public.app_op_payment_reactivate(text,jsonb)
to authenticated;
