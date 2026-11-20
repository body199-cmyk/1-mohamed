-- D04: a new or backdated active trip must not be silently hidden by
-- an existing contractor-work TOTAL opening.
-- Historical rows that predate an opening remain untouched under the
-- already-approved TOTAL cutover rule; do not rewrite their value.
-- The opening writer and recovery trigger use the same advisory lock,
-- preventing an opening/active-trip write race for one counterparty.
create function public.app_guard_new_trip_work_opening()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(727304, hashtext(new.counterparty_contractor_id));
  if exists (
    select 1 from public.opening_balances o
    where o.balance_type = 'CONTRACTOR_WORK'
      and not o.is_cancelled
      and o.contractor_id = new.counterparty_contractor_id
      and new.trip_date < o.start_date
  ) then
    raise exception 'Active trip precedes contractor-work opening start'
      using errcode = 'P2021';
  end if;
  return new;
end;
$$;

create trigger trg_trip_new_work_opening
before insert or update of trip_date, counterparty_contractor_id
on public.trips
for each row
when (not new.is_cancelled)
execute function public.app_guard_new_trip_work_opening();

revoke execute on function public.app_guard_new_trip_work_opening()
from public, anon, authenticated;
