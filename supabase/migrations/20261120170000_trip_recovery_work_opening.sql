-- Serialize contractor-work opening writes and recovery for the same counterparty.
-- TOTAL openings still summarize earlier detail under D04.
create function public.app_lock_contractor_work_opening_write()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(727304, hashtext(new.contractor_id));
  return new;
end;
$$;

create trigger trg_lock_contractor_work_opening_write
before insert or update of balance_type, contractor_id, start_date, is_cancelled
on public.opening_balances for each row
when (new.balance_type = 'CONTRACTOR_WORK' and not new.is_cancelled)
execute function public.app_lock_contractor_work_opening_write();

create function public.app_guard_trip_recovery_work_opening()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(727304, hashtext(new.counterparty_contractor_id));
  if exists (
    select 1 from public.opening_balances o
    where o.balance_type = 'CONTRACTOR_WORK' and not o.is_cancelled
      and o.contractor_id = new.counterparty_contractor_id
      and new.trip_date < o.start_date
  ) then
    raise exception 'Trip recovery precedes counterparty work opening start'
      using errcode = 'P2020';
  end if;
  return new;
end;
$$;

create trigger trg_trip_recovery_work_opening
before update of is_cancelled on public.trips for each row
when (old.is_cancelled and not new.is_cancelled)
execute function public.app_guard_trip_recovery_work_opening();

revoke execute on function
  public.app_lock_contractor_work_opening_write(),
  public.app_guard_trip_recovery_work_opening()
from public, anon, authenticated;
