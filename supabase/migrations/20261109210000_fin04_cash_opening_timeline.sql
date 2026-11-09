-- FIN-04: preserve independent vehicle cash opening start and historical movements.
-- Additive DB guard, not a retrospective conversion or contractor work settlement.
-- All cash writers share the same advisory account lock; trigger enforces invariant
-- even when an authorized writer bypasses the opening RPC.
create function public.app_guard_cash_opening_timeline()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if new.balance_type <> 'VEHICLE_CASH' or new.is_cancelled then
    return new;
  end if;
  perform public.app_lock_trip_accounts(array[new.vehicle_id||'|'||new.contractor_id]);
  if exists (
    select 1 from public.trips t
    where not t.is_cancelled and t.vehicle_id=new.vehicle_id
      and t.responsible_contractor_id=new.contractor_id
      and t.trip_date<new.start_date
  ) or exists (
    select 1 from public.payments p
    where not p.is_cancelled and p.vehicle_id=new.vehicle_id
      and p.responsible_contractor_id=new.contractor_id
      and p.payment_date<new.start_date
  ) then
    raise exception 'FIN-04 cash opening starts after existing vehicle cash movements'
      using errcode='22023';
  end if;
  return new;
end;
$$;

create trigger trg_fin04_cash_opening_timeline
before insert or update of start_date,vehicle_id,contractor_id,balance_type,is_cancelled
on public.opening_balances for each row
execute function public.app_guard_cash_opening_timeline();

-- The trip RPC resolves its account before acquiring the cash-account lock;
-- this second gate runs *after* that lock, closing the opening/trip write race.
create function public.app_guard_trip_cash_opening_start()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if new.is_cancelled then return new; end if;
  if exists (
    select 1 from public.opening_balances o
    where o.balance_type='VEHICLE_CASH' and not o.is_cancelled
      and o.vehicle_id=new.vehicle_id
      and o.contractor_id=new.responsible_contractor_id
      and new.trip_date<o.start_date
  ) then
    raise exception 'FIN-04 trip precedes vehicle cash opening start'
      using errcode='22023';
  end if;
  return new;
end;
$$;

create trigger trg_fin04_trip_cash_opening_start
before insert or update of trip_date,vehicle_id,responsible_contractor_id,is_cancelled
on public.trips for each row
execute function public.app_guard_trip_cash_opening_start();

revoke execute on function
  public.app_guard_cash_opening_timeline(),
  public.app_guard_trip_cash_opening_start()
from public,anon,authenticated;
