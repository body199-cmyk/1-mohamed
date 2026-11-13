begin;
create schema hostile_lookup;
create function hostile_lookup.btrim(text) returns text language sql as $$ select 'hijacked'::text $$;
create function hostile_lookup.floor(numeric) returns numeric language sql as $$ select 0::numeric $$;
set local search_path = hostile_lookup, public, pg_catalog;
do $$
begin
  if public.app_require_text('  safe  ', 'label') <> 'safe' then raise exception 'text lookup hijacked'; end if;
  if public.app_parse_scaled_unsigned('12.50', 2, 'amount') <> 1250 then raise exception 'decimal lookup hijacked'; end if;
  if public.app_trip_totals(1000, 1500, 1000, 50) ->> 'contractor_total_piastres' <> '1550' then raise exception 'money lookup hijacked'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('app_require_text','app_exact_bigint','app_normalize_plate','app_lock_trip_accounts','app_parse_scaled_unsigned','app_require_decimal_string','app_trip_totals') and p.proconfig is null) then raise exception 'unconfigured helper search path'; end if;
end $$;
rollback;
