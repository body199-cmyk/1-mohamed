reset role;
-- Hosted security advisor: deterministic helper lookup without changing privileges or arithmetic.
alter function public.app_require_text(text,text) set search_path = pg_catalog, public;
alter function public.app_exact_bigint(jsonb,text) set search_path = pg_catalog, public;
alter function public.app_normalize_plate(text) set search_path = pg_catalog, public;
alter function public.app_lock_trip_accounts(text[]) set search_path = pg_catalog, public;
alter function public.app_parse_scaled_unsigned(text,integer,text) set search_path = pg_catalog, public;
alter function public.app_require_decimal_string(jsonb,text,integer) set search_path = pg_catalog, public;
alter function public.app_trip_totals(bigint,bigint,bigint,bigint) set search_path = pg_catalog, public;
