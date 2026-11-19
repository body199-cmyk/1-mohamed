-- The internal reader uses one statement snapshot for every table. Keep it
-- outside the exposed public schema and use the caller's existing SELECT/RLS.
create schema if not exists portable_backup_private;
revoke all on schema portable_backup_private from public;
grant usage on schema portable_backup_private to authenticated;

create function portable_backup_private.read_snapshot(p_table text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_table record;
  v_rows jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_remaining integer := 50000;
begin
  if public.app_is_owner() is distinct from true then
    raise exception 'Portable export requires owner access' using errcode = '42501';
  end if;

  for v_table in
    select * from (values
      ('app_members', 'user_id'), ('app_owner', 'id'), ('audit_log', 'id'),
      ('business_settings', 'id'), ('contractors', 'id'), ('idempotency_keys', 'key'),
      ('opening_balances', 'id'), ('payments', 'id'), ('trips', 'id'),
      ('vehicle_accounts', 'vehicle_id, contractor_id'), ('vehicles', 'id'),
      ('backup_history', 'id')
    ) as exports(name, sorting)
    where p_table is null or name = p_table
  loop
    -- The order fragment comes only from the fixed list above. Limit the
    -- combined dataset at the database, before transfer or serialization.
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) order by %s), ''[]''::jsonb)
       from (select * from public.%I order by %s limit $1) t',
       v_table.sorting, v_table.name, v_table.sorting
    ) into v_rows using v_remaining + 1;

    v_remaining := v_remaining - jsonb_array_length(v_rows);
    if v_remaining < 0 then
      raise exception 'Portable export exceeds 50000 rows' using errcode = 'P2011';
    end if;
    v_tables := v_tables || jsonb_build_object(v_table.name, v_rows);
  end loop;

  if v_tables = '{}'::jsonb then
    raise exception 'Unknown portable export table' using errcode = '22023';
  end if;
  return v_tables;
end;
$$;

revoke all on function portable_backup_private.read_snapshot(text) from public, anon, authenticated;
grant execute on function portable_backup_private.read_snapshot(text) to authenticated;

-- VOLATILE gives each validation query its own snapshot at READ COMMITTED.
-- Each call to the STABLE reader sees one coherent point in time across all
-- selected tables. Compare actual rows, including values and relationships.
create function public.app_portable_backup_snapshot(p_table text default null)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
declare
  v_snapshot jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Portable export requires READ COMMITTED for drift detection' using errcode = '25001';
  end if;

  select portable_backup_private.read_snapshot(p_table) into v_snapshot;
  if v_snapshot is distinct from portable_backup_private.read_snapshot(p_table) then
    raise exception 'Data changed during portable export' using errcode = 'P2010';
  end if;
  return v_snapshot;
end;
$$;

revoke all on function public.app_portable_backup_snapshot(text) from public, anon, authenticated;
grant execute on function public.app_portable_backup_snapshot(text) to authenticated;
