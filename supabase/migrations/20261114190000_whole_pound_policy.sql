-- D19: user-approved whole-pound money; exact scaled storage remains internal.
-- Additive policy change; existing applied migrations are never edited.
create or replace function public.app_parse_scaled_unsigned(
    p_text text,
    p_scale integer,
    p_label text
)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
    v_text text := btrim(coalesce(p_text, ''));
    v_dot integer;
    v_int text;
    v_frac text;
    v_digits text;
    v_scaled bigint;
begin
    if v_text !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception '% must be a plain non-negative decimal like 12 or 12.5', p_label
            using errcode = '22023';
    end if;

    v_dot := position('.' in v_text);
    if v_dot = 0 then
        v_int := v_text;
        v_frac := '';
    else
        v_int := left(v_text, v_dot - 1);
        v_frac := substring(v_text from v_dot + 1);
    end if;

    if length(v_frac) > p_scale then
        raise exception '% has more than % decimal digits; correct the value instead of truncating it',
                        p_label, p_scale
            using errcode = '22023';
    end if;

    v_digits := v_int || rpad(v_frac, p_scale, '0');

    begin
        v_scaled := v_digits::bigint;
        if p_scale = 2 then
            return (round(v_scaled::numeric / 100) * 100)::bigint;
        end if;
        return v_scaled;
    exception when numeric_value_out_of_range then
        raise exception '% exceeds the bigint storage limit; correct the value', p_label
            using errcode = '22003';
    end;
end;
$$;

create or replace function public.app_trip_totals(
    p_weight_milli bigint,
    p_contractor_rate bigint,
    p_vehicle_rate bigint,
    p_expense bigint
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
    v_max numeric := 9223372036854775807::numeric;
    v_product numeric;
    v_contractor numeric;
    v_vehicle numeric;
begin
    v_product := p_weight_milli::numeric * p_contractor_rate::numeric;
    v_contractor := floor((v_product + p_expense::numeric * 1000 + 50000) / 100000) * 100;

    v_product := p_weight_milli::numeric * p_vehicle_rate::numeric;
    v_vehicle := floor((v_product + p_expense::numeric * 1000 + 50000) / 100000) * 100;

    if v_contractor > v_max or v_vehicle > v_max then
        raise exception 'Trip total exceeds the bigint storage limit; correct weight or rates'
            using errcode = '22003';
    end if;

    return jsonb_build_object(
        'contractor_total_piastres', v_contractor::bigint::text,
        'vehicle_total_piastres', v_vehicle::bigint::text
    );
end;
$$;


-- Preserve historical rows; all new or updated financial records must be whole pounds.
-- Live cutover must first confirm no fractional legacy records need a reviewed conversion.
alter table public.opening_balances add constraint opening_whole_pounds check (signed_piastres % 100 = 0) not valid;
alter table public.payments add constraint payment_whole_pounds check (amount_piastres % 100 = 0) not valid;
alter table public.trips add constraint trip_whole_pounds check (
  contractor_total_piastres % 100 = 0 and vehicle_total_piastres % 100 = 0
  and contractor_rate_piastres % 100 = 0 and vehicle_rate_piastres % 100 = 0
  and expense_piastres % 100 = 0) not valid;
