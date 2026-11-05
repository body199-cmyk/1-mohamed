-- DB-03-TRIPS / H038 additive repair: preserve approved trip descriptive fields.
-- Apply after 20261104200022_phase_c_trip_operations.sql.
-- Do not edit the previously delivered migration in place.
-- No payment, accounting formula, authorization or idempotency change.
-- Origin/destination/receipt are optional and nullable for existing rows.
alter table public.trips
    add column if not exists origin text,
    add column if not exists destination text,
    add column if not exists receipt_number text;

-- Optional text fields must really be JSON strings. This preserves leading
-- zeros in receipt numbers; a JSON number is rejected rather than coerced.
create or replace function public.app_trip_optional_text(p_payload jsonb, p_field text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
    v jsonb := p_payload -> p_field;
begin
    if v is null or jsonb_typeof(v) = 'null' then
        return null;
    end if;
    if jsonb_typeof(v) <> 'string' then
        raise exception '% must be a text string', p_field using errcode = '22023';
    end if;
    return nullif(btrim(v #>> '{}'), '');
end;
$$;

revoke execute on function public.app_trip_optional_text(jsonb, text)
    from public, anon, authenticated;

-- All three public-facing RPCs are replaced together: creation, change audit,
-- and reading now agree on the same fields. Existing signatures are preserved.

create or replace function public.app_op_trip_create(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_vehicle text;
    v_counterparty text;
    v_direction text;
    v_date date;
    v_same boolean;
    v_weight bigint;
    v_cr bigint;
    v_vr bigint;
    v_exp bigint;
    v_responsible text;
    v_totals jsonb;
    v_origin text;
    v_destination text;
    v_receipt text;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'trip.create', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'trip id');
    v_vehicle := public.app_require_text(v_payload->>'vehicle_id', 'vehicle id');
    v_counterparty := public.app_require_text(v_payload->>'counterparty_contractor_id', 'counterparty contractor id');
    v_direction := public.app_require_text(v_payload->>'direction', 'direction');
    v_date := (public.app_require_text(v_payload->>'trip_date', 'trip date'))::date;
    v_same := coalesce((v_payload->>'same_rate')::boolean, true);

    v_weight := public.app_require_decimal_string(v_payload, 'weight_tonnes', 3);
    v_cr := public.app_require_decimal_string(v_payload, 'contractor_rate_egp', 2);
    v_vr := public.app_require_decimal_string(v_payload, 'vehicle_rate_egp', 2);
    v_exp := public.app_require_decimal_string(v_payload, 'expense_egp', 2);

    if v_weight <= 0 then
        raise exception 'Weight must be positive' using errcode = '22023';
    end if;
    if v_same and v_cr <> v_vr then
        raise exception 'same_rate is enabled but the two rates differ' using errcode = '22023';
    end if;

    v_origin := public.app_trip_optional_text(v_payload, 'origin');
    v_destination := public.app_trip_optional_text(v_payload, 'destination');
    v_receipt := public.app_trip_optional_text(v_payload, 'receipt_number');

    v_responsible := public.app_resolve_trip_responsible(v_vehicle, v_counterparty, v_direction, v_date);
    perform public.app_lock_trip_accounts(array[v_vehicle || '|' || v_responsible]);

    v_totals := public.app_trip_totals(v_weight, v_cr, v_vr, v_exp);

    insert into public.trips
        (id, vehicle_id, counterparty_contractor_id, responsible_contractor_id, direction,
         trip_date, weight_milli_tonnes, contractor_rate_piastres, vehicle_rate_piastres,
         same_rate, expense_piastres, contractor_total_piastres, vehicle_total_piastres, notes,
         origin, destination, receipt_number)
    values
        (v_id, v_vehicle, v_counterparty, v_responsible, v_direction,
         v_date, v_weight, v_cr, v_vr,
         v_same, v_exp,
         (v_totals->>'contractor_total_piastres')::bigint,
         (v_totals->>'vehicle_total_piastres')::bigint,
         v_payload->>'notes', v_origin, v_destination, v_receipt);

    perform public.app_write_audit(
        'TRIP', v_id, 'INSERT', null, null,
        jsonb_build_object(
            'vehicle_id', v_vehicle, 'counterparty_contractor_id', v_counterparty,
            'responsible_contractor_id', v_responsible, 'direction', v_direction,
            'trip_date', v_date, 'weight_milli_tonnes', v_weight::text,
            'contractor_rate_piastres', v_cr::text, 'vehicle_rate_piastres', v_vr::text,
            'same_rate', v_same, 'expense_piastres', v_exp::text,
            'origin', v_origin, 'destination', v_destination,
            'receipt_number', v_receipt, 'notes', v_payload->>'notes'),
        null,
        jsonb_build_object(
            'contractor_total_piastres', v_totals->>'contractor_total_piastres',
            'vehicle_total_piastres', v_totals->>'vehicle_total_piastres'),
        v_user
    );

    v_response := jsonb_build_object(
        'status', 'OK', 'trip_id', v_id, 'version', 1,
        'responsible_contractor_id', v_responsible,
        'contractor_total_piastres', v_totals->>'contractor_total_piastres',
        'vehicle_total_piastres', v_totals->>'vehicle_total_piastres'
    );
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

create or replace function public.app_op_trip_update(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_reason text;
    v_expected integer;
    v_old public.trips%rowtype;
    v_vehicle text;
    v_counterparty text;
    v_direction text;
    v_date date;
    v_same boolean;
    v_weight bigint;
    v_cr bigint;
    v_vr bigint;
    v_exp bigint;
    v_responsible text;
    v_totals jsonb;
    v_origin text;
    v_destination text;
    v_receipt text;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'trip.update', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'trip id');
    v_reason := public.app_require_text(v_payload->>'reason', 'edit reason');
    v_expected := (v_payload->>'expected_version')::integer;
    if v_expected is null then
        raise exception 'expected_version is required for an update' using errcode = '22023';
    end if;

    select * into v_old from public.trips where id = v_id for update;
    if not found then
        raise exception 'Trip not found: %', v_id using errcode = '22023';
    end if;
    if v_old.is_cancelled then
        raise exception 'A cancelled trip cannot be edited' using errcode = '22023';
    end if;
    if v_old.version <> v_expected then
        raise exception 'Version conflict: expected %, found %', v_expected, v_old.version
            using errcode = 'P2003';
    end if;

    v_vehicle := public.app_require_text(v_payload->>'vehicle_id', 'vehicle id');
    v_counterparty := public.app_require_text(v_payload->>'counterparty_contractor_id', 'counterparty contractor id');
    v_direction := public.app_require_text(v_payload->>'direction', 'direction');
    v_date := (public.app_require_text(v_payload->>'trip_date', 'trip date'))::date;
    v_same := coalesce((v_payload->>'same_rate')::boolean, true);

    v_weight := public.app_require_decimal_string(v_payload, 'weight_tonnes', 3);
    v_cr := public.app_require_decimal_string(v_payload, 'contractor_rate_egp', 2);
    v_vr := public.app_require_decimal_string(v_payload, 'vehicle_rate_egp', 2);
    v_exp := public.app_require_decimal_string(v_payload, 'expense_egp', 2);

    if v_weight <= 0 then
        raise exception 'Weight must be positive' using errcode = '22023';
    end if;
    if v_same and v_cr <> v_vr then
        raise exception 'same_rate is enabled but the two rates differ' using errcode = '22023';
    end if;

    v_origin := public.app_trip_optional_text(v_payload, 'origin');
    v_destination := public.app_trip_optional_text(v_payload, 'destination');
    v_receipt := public.app_trip_optional_text(v_payload, 'receipt_number');

    v_responsible := public.app_resolve_trip_responsible(v_vehicle, v_counterparty, v_direction, v_date);
    perform public.app_lock_trip_accounts(array[
        v_old.vehicle_id || '|' || v_old.responsible_contractor_id,
        v_vehicle || '|' || v_responsible
    ]);

    v_totals := public.app_trip_totals(v_weight, v_cr, v_vr, v_exp);

    update public.trips
       set vehicle_id = v_vehicle,
           counterparty_contractor_id = v_counterparty,
           responsible_contractor_id = v_responsible,
           direction = v_direction,
           trip_date = v_date,
           weight_milli_tonnes = v_weight,
           contractor_rate_piastres = v_cr,
           vehicle_rate_piastres = v_vr,
           same_rate = v_same,
           expense_piastres = v_exp,
           contractor_total_piastres = (v_totals->>'contractor_total_piastres')::bigint,
           vehicle_total_piastres = (v_totals->>'vehicle_total_piastres')::bigint,
           notes = v_payload->>'notes',
           origin = v_origin,
           destination = v_destination,
           receipt_number = v_receipt,
           version = version + 1,
           updated_at = now()
     where id = v_id;

    perform public.app_write_audit(
        'TRIP', v_id, 'UPDATE', v_reason,
        to_jsonb(v_old),
        jsonb_build_object(
            'vehicle_id', v_vehicle, 'counterparty_contractor_id', v_counterparty,
            'responsible_contractor_id', v_responsible, 'direction', v_direction,
            'trip_date', v_date, 'weight_milli_tonnes', v_weight::text,
            'contractor_rate_piastres', v_cr::text, 'vehicle_rate_piastres', v_vr::text,
            'same_rate', v_same, 'expense_piastres', v_exp::text,
            'origin', v_origin, 'destination', v_destination,
            'receipt_number', v_receipt, 'notes', v_payload->>'notes',
            'version', v_old.version + 1),
        jsonb_build_object(
            'vehicle_id', jsonb_build_array(v_old.vehicle_id, v_vehicle),
            'direction', jsonb_build_array(v_old.direction, v_direction),
            'weight_milli_tonnes', jsonb_build_array(v_old.weight_milli_tonnes::text, v_weight::text),
            'origin', jsonb_build_array(v_old.origin, v_origin),
            'destination', jsonb_build_array(v_old.destination, v_destination),
            'receipt_number', jsonb_build_array(v_old.receipt_number, v_receipt),
            'notes', jsonb_build_array(v_old.notes, v_payload->>'notes')),
        jsonb_build_object(
            'old', jsonb_build_object(
                'contractor_total_piastres', v_old.contractor_total_piastres::text,
                'vehicle_total_piastres', v_old.vehicle_total_piastres::text),
            'new', jsonb_build_object(
                'contractor_total_piastres', v_totals->>'contractor_total_piastres',
                'vehicle_total_piastres', v_totals->>'vehicle_total_piastres')),
        v_user
    );

    v_response := jsonb_build_object(
        'status', 'OK', 'trip_id', v_id, 'version', v_old.version + 1,
        'responsible_contractor_id', v_responsible,
        'contractor_total_piastres', v_totals->>'contractor_total_piastres',
        'vehicle_total_piastres', v_totals->>'vehicle_total_piastres'
    );
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

create or replace function public.app_op_trips_read(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_user uuid := public.app_require_owner();
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_from date;
    v_to date;
    v_limit integer;
    v_include_cancelled boolean;
    v_vehicle text;
    v_counterparty text;
    v_cursor_date date;
    v_cursor_id text;
    v_fetched integer;
    v_rows jsonb;
    v_total bigint;
    v_cursor jsonb := null;
begin
    v_from := (public.app_require_text(v_payload->>'date_from', 'date_from'))::date;
    v_to := (public.app_require_text(v_payload->>'date_to', 'date_to'))::date;
    if v_from > v_to then
        raise exception 'date_from must not be after date_to' using errcode = '22023';
    end if;

    v_limit := coalesce((v_payload->>'limit')::integer, 50);
    if v_limit < 1 or v_limit > 200 then
        raise exception 'limit must be between 1 and 200' using errcode = '22023';
    end if;

    v_include_cancelled := coalesce((v_payload->>'include_cancelled')::boolean, false);
    v_vehicle := nullif(btrim(coalesce(v_payload->>'vehicle_id', '')), '');
    v_counterparty := nullif(btrim(coalesce(v_payload->>'counterparty_contractor_id', '')), '');

    if v_payload ? 'cursor' and jsonb_typeof(v_payload->'cursor') = 'object' then
        v_cursor_date := (v_payload->'cursor'->>'date')::date;
        v_cursor_id := nullif(btrim(coalesce(v_payload->'cursor'->>'id', '')), '');
        if v_cursor_date is null or v_cursor_id is null then
            raise exception 'cursor requires both date and id' using errcode = '22023';
        end if;
    end if;

    select count(*) into v_total
      from public.trips t
     where t.trip_date between v_from and v_to
       and (v_vehicle is null or t.vehicle_id = v_vehicle)
       and (v_counterparty is null or t.counterparty_contractor_id = v_counterparty)
       and (v_include_cancelled or not t.is_cancelled);

    with filtered as (
        select t.id, t.vehicle_id, t.counterparty_contractor_id, t.responsible_contractor_id,
               t.direction, t.trip_date, t.weight_milli_tonnes, t.contractor_rate_piastres,
               t.vehicle_rate_piastres, t.same_rate, t.expense_piastres,
               t.contractor_total_piastres, t.vehicle_total_piastres, t.is_cancelled, t.version,
               t.notes, t.origin, t.destination, t.receipt_number
          from public.trips t
         where t.trip_date between v_from and v_to
           and (v_vehicle is null or t.vehicle_id = v_vehicle)
           and (v_counterparty is null or t.counterparty_contractor_id = v_counterparty)
           and (v_include_cancelled or not t.is_cancelled)
           and (v_cursor_date is null or (t.trip_date, t.id) > (v_cursor_date, v_cursor_id))
         order by t.trip_date asc, t.id asc
         limit v_limit + 1
    ),
    page as (
        select * from filtered limit v_limit
    )
    select
        (select count(*) from filtered),
        (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id,
                    'vehicle_id', p.vehicle_id,
                    'counterparty_contractor_id', p.counterparty_contractor_id,
                    'responsible_contractor_id', p.responsible_contractor_id,
                    'direction', p.direction,
                    'trip_date', p.trip_date,
                    'weight_milli_tonnes', p.weight_milli_tonnes::text,
                    'contractor_rate_piastres', p.contractor_rate_piastres::text,
                    'vehicle_rate_piastres', p.vehicle_rate_piastres::text,
                    'same_rate', p.same_rate,
                    'expense_piastres', p.expense_piastres::text,
                    'contractor_total_piastres', p.contractor_total_piastres::text,
                    'vehicle_total_piastres', p.vehicle_total_piastres::text,
                    'is_cancelled', p.is_cancelled,
                    'notes', p.notes,
                    'origin', p.origin,
                    'destination', p.destination,
                    'receipt_number', p.receipt_number,
                    'version', p.version
                ) order by p.trip_date, p.id), '[]'::jsonb)
           from page p)
    into v_fetched, v_rows;

    if v_fetched > v_limit then
        v_cursor := jsonb_build_object(
            'date', (v_rows->(jsonb_array_length(v_rows) - 1))->>'trip_date',
            'id', (v_rows->(jsonb_array_length(v_rows) - 1))->>'id'
        );
    end if;

    return jsonb_build_object(
        'status', 'OK',
        'date_from', v_from,
        'date_to', v_to,
        'total_count', v_total::text,
        'returned', jsonb_array_length(v_rows),
        'next_cursor', v_cursor,
        'rows', v_rows
    );
end;
$$;

-- Preserve the owner-only execution policy after CREATE OR REPLACE.
revoke execute on function
    public.app_op_trip_create(text, jsonb),
    public.app_op_trip_update(text, jsonb),
    public.app_op_trips_read(jsonb)
    from public, anon, authenticated;
grant execute on function
    public.app_op_trip_create(text, jsonb),
    public.app_op_trip_update(text, jsonb),
    public.app_op_trips_read(jsonb)
    to authenticated;
