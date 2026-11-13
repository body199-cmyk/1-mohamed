-- PRE-LIVE-02: cancelled trip history includes its audited reason.
-- Preserve all previous trip keyset, owner checks and financial projections.
-- Migrations execute as owner even after preceding authenticated-role SQL tests.
reset role;
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
               t.notes, t.origin, t.destination, t.receipt_number, t.cancel_reason
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
                    'cancel_reason', p.cancel_reason,
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

revoke execute on function public.app_op_trips_read(jsonb) from public,anon,authenticated;
grant execute on function public.app_op_trips_read(jsonb) to authenticated;
