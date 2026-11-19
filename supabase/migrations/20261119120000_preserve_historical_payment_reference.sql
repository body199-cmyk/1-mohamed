-- A trip correction may move work to a different account under D13. Preserve
-- the descriptive link when a payment edit keeps the same link and account.
create or replace function public.app_payment_trip_link_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'UPDATE' then
        if row(new.linked_trip_id, new.vehicle_id, new.responsible_contractor_id)
           is not distinct from row(old.linked_trip_id, old.vehicle_id, old.responsible_contractor_id) then
            return new;
        end if;
    end if;

    if new.linked_trip_id is not null and not exists (
        select 1 from public.trips t
        where t.id = new.linked_trip_id
          and t.vehicle_id = new.vehicle_id
          and t.responsible_contractor_id = new.responsible_contractor_id
    ) then
        raise exception 'Payment trip reference does not belong to this vehicle account'
            using errcode = '23514';
    end if;

    return new;
end;
$$;
