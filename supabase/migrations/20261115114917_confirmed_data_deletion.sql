reset role;
-- Confirmed destructive maintenance. Installation does NOT remove business rows.
-- Auth, primary identity, append-only audit and original idempotency keys are preserved.
create schema if not exists app_private;
revoke all on schema app_private from public,anon,authenticated;
create table app_private.deletion_challenges (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null,
 original_session uuid not null, scope jsonb not null, plan_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
 consumed_at timestamptz, outcome jsonb
);
create table app_private.deleted_entities (
 entity_table text not null, entity_id text not null,
 deleted_at timestamptz not null default clock_timestamp(), primary key(entity_table,entity_id)
);
create index deletion_challenges_owner_created on app_private.deletion_challenges(owner_id,created_at desc);
alter table app_private.deletion_challenges enable row level security;
alter table app_private.deleted_entities enable row level security;
revoke all on all tables in schema app_private from public,anon,authenticated;

create function app_private.deletion_plan(p_scope jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 mode text:=p_scope->>'mode'; vehicle text; first_day date; last_day date;
 trip_ids text[]; payment_ids text[]; opening_ids text[]; vehicle_ids text[]; contractor_ids text[];
 account_count bigint; linked_outside bigint; negative_accounts bigint:=0; revision text; counts jsonb;
begin
 if jsonb_typeof(p_scope)<>'object' or (p_scope-array['mode','vehicle_id','from','to'])<>'{}'::jsonb
 or mode is null or mode not in ('ALL','VEHICLE','PERIOD') then raise exception 'Invalid deletion scope' using errcode='22023'; end if;
 if mode='VEHICLE' then
  vehicle:=nullif(btrim(p_scope->>'vehicle_id'),'');
  if vehicle is null or not exists(select 1 from public.vehicles where id=vehicle) or p_scope?'from' or p_scope?'to' then
   raise exception 'Vehicle scope invalid' using errcode='22023'; end if;
 elsif mode='PERIOD' then
  if coalesce(p_scope->>'from','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_scope->>'to','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or p_scope?'vehicle_id' then
   raise exception 'Period scope invalid' using errcode='22023'; end if;
  first_day:=(p_scope->>'from')::date;last_day:=(p_scope->>'to')::date;
  if first_day>last_day then raise exception 'Reversed deletion period' using errcode='22023'; end if;
 elsif p_scope<>'{"mode":"ALL"}'::jsonb then raise exception 'All scope invalid' using errcode='22023'; end if;
 select coalesce(array_agg(id order by id),array[]::text[]) into trip_ids from public.trips
  where mode='ALL' or (mode='VEHICLE' and vehicle_id=vehicle) or (mode='PERIOD' and trip_date between first_day and last_day);
 select coalesce(array_agg(id order by id),array[]::text[]) into payment_ids from public.payments
  where mode='ALL' or (mode='VEHICLE' and vehicle_id=vehicle) or (mode='PERIOD' and payment_date between first_day and last_day);
 select coalesce(array_agg(id order by id),array[]::text[]) into opening_ids from public.opening_balances
  where mode='ALL' or (mode='VEHICLE' and vehicle_id=vehicle) or (mode='PERIOD' and start_date between first_day and last_day);
 select coalesce(array_agg(id order by id),array[]::text[]) into vehicle_ids from public.vehicles where mode='ALL' or (mode='VEHICLE' and id=vehicle);
 select coalesce(array_agg(id order by id),array[]::text[]) into contractor_ids from public.contractors where mode='ALL' and not is_primary;
 select count(*) into account_count from public.vehicle_accounts where vehicle_id=any(vehicle_ids);
 select count(*) into linked_outside from public.payments where linked_trip_id=any(trip_ids) and not(id=any(payment_ids));
 if mode='PERIOD' then
  with affected as (
   select vehicle_id,responsible_contractor_id contractor_id from public.trips where id=any(trip_ids)
   union select vehicle_id,responsible_contractor_id from public.payments where id=any(payment_ids)
   union select vehicle_id,contractor_id from public.opening_balances where id=any(opening_ids) and vehicle_id is not null
  ), movements as (
   select o.vehicle_id,o.contractor_id,o.start_date movement_date,o.signed_piastres::numeric delta from public.opening_balances o join affected a using(vehicle_id,contractor_id)
    where o.balance_type='VEHICLE_CASH' and not o.is_cancelled and not(o.id=any(opening_ids))
   union all select t.vehicle_id,t.responsible_contractor_id,t.trip_date,t.vehicle_total_piastres::numeric from public.trips t
    join affected a on a.vehicle_id=t.vehicle_id and a.contractor_id=t.responsible_contractor_id where not t.is_cancelled and not(t.id=any(trip_ids))
   union all select p.vehicle_id,p.responsible_contractor_id,p.payment_date,-p.amount_piastres::numeric from public.payments p
    join affected a on a.vehicle_id=p.vehicle_id and a.contractor_id=p.responsible_contractor_id where not p.is_cancelled and not(p.id=any(payment_ids))
  ), daily as (select vehicle_id,contractor_id,movement_date,sum(delta) delta from movements group by 1,2,3), running as (
   select vehicle_id,contractor_id,sum(delta) over(partition by vehicle_id,contractor_id order by movement_date rows unbounded preceding) balance from daily
  ) select count(*) into negative_accounts from(select distinct vehicle_id,contractor_id from running where balance<0) bad;
 end if;
 counts:=jsonb_build_object('trips',cardinality(trip_ids),'payments',cardinality(payment_ids),'openings',cardinality(opening_ids),'vehicles',cardinality(vehicle_ids),'contractors',cardinality(contractor_ids),'accounts',account_count);
 select count(*)::text||':'||coalesce(max(id),0)::text into revision from public.audit_log;
 return jsonb_build_object('counts',counts,'trip_ids',trip_ids,'payment_ids',payment_ids,'opening_ids',opening_ids,'vehicle_ids',vehicle_ids,'contractor_ids',contractor_ids,
  'hash',encode(sha256(convert_to(jsonb_build_object('scope',p_scope,'counts',counts,'revision',revision,'trips',trip_ids,'payments',payment_ids,'openings',opening_ids,'vehicles',vehicle_ids,'contractors',contractor_ids)::text,'UTF8')),'hex'),
  'blocked',case when linked_outside>0 then 'LINKED_OUTSIDE' when negative_accounts>0 then 'NEGATIVE_BALANCE'
   when cardinality(trip_ids)+cardinality(payment_ids)+cardinality(opening_ids)+cardinality(vehicle_ids)+cardinality(contractor_ids)=0 then 'EMPTY' else null end);
end $$;
revoke all on function app_private.deletion_plan(jsonb) from public,anon,authenticated;

create function public.app_op_data_purge_preview(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
 uid uuid:=public.app_require_owner(); claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 plan jsonb; challenge uuid; expires timestamptz; phrase text;
begin
 if nullif(claims->>'session_id','') is null or not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=uid) then raise exception 'Verified session required' using errcode='42501'; end if;
 if (select count(*) from app_private.deletion_challenges where owner_id=uid and created_at>clock_timestamp()-interval '1 minute')>=10 then
  raise exception 'Too many previews' using errcode='P2008'; end if;
 plan:=app_private.deletion_plan(p_payload);
 phrase:=case p_payload->>'mode' when 'ALL' then 'احذف كل البيانات' when 'VEHICLE' then 'احذف بيانات العربية' else 'احذف بيانات الفترة' end;
 if plan->>'blocked' is null then
  insert into app_private.deletion_challenges(owner_id,original_session,scope,plan_hash)
   values(uid,(claims->>'session_id')::uuid,p_payload,plan->>'hash') returning id,expires_at into challenge,expires;
 end if;
 return jsonb_build_object('status','OK','challenge_id',challenge,'expires_at',expires,'counts',plan->'counts','blocked',plan->>'blocked','confirmation',phrase);
end $$;
revoke all on function public.app_op_data_purge_preview(jsonb) from public,anon,authenticated;
grant execute on function public.app_op_data_purge_preview(jsonb) to authenticated;

-- Identifiers only: prevent old requests or new-key retries resurrecting deleted records.
create function app_private.reject_deleted_identity() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from app_private.deleted_entities where entity_table=tg_table_name and entity_id=new.id) then
  raise exception 'Record was permanently deleted' using errcode='P2005'; end if;
 return new;
end $$;
revoke all on function app_private.reject_deleted_identity() from public,anon,authenticated;
create trigger reject_deleted_identity before insert on public.contractors for each row execute function app_private.reject_deleted_identity();
create trigger reject_deleted_identity before insert on public.vehicles for each row execute function app_private.reject_deleted_identity();
create trigger reject_deleted_identity before insert on public.opening_balances for each row execute function app_private.reject_deleted_identity();
create trigger reject_deleted_identity before insert on public.trips for each row execute function app_private.reject_deleted_identity();
create trigger reject_deleted_identity before insert on public.payments for each row execute function app_private.reject_deleted_identity();

create function public.app_op_data_purge_execute(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
 uid uuid:=public.app_require_owner(); claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 challenge app_private.deletion_challenges%rowtype; plan jsonb; phrase text; ids text[]; v_outcome jsonb;
begin
 select * into challenge from app_private.deletion_challenges where id=(p_payload->>'challenge_id')::uuid and owner_id=uid for update;
 if not found or challenge.expires_at<clock_timestamp() then raise exception 'Deletion preview expired' using errcode='P2006'; end if;
 if nullif(claims->>'session_id','') is null or (claims->>'session_id')::uuid=challenge.original_session or not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=uid) then
  raise exception 'New password authentication required' using errcode='42501'; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) method where method->>'method'='password'
  and (method->>'timestamp')::numeric>=extract(epoch from date_trunc('second',challenge.created_at))
  and (method->>'timestamp')::numeric between extract(epoch from clock_timestamp()-interval '2 minutes') and extract(epoch from clock_timestamp()+interval '5 seconds')) then
  raise exception 'Fresh password authentication required' using errcode='42501'; end if;
 phrase:=case challenge.scope->>'mode' when 'ALL' then 'احذف كل البيانات' when 'VEHICLE' then 'احذف بيانات العربية' else 'احذف بيانات الفترة' end;
 if p_payload->>'confirmation' is distinct from phrase then raise exception 'Explicit confirmation required' using errcode='22023'; end if;
 if challenge.consumed_at is not null then return challenge.outcome; end if;
 -- NOWAIT avoids a dangerous long wait behind concurrent financial writes.
 lock table public.contractors,public.vehicles,public.vehicle_accounts,public.opening_balances,public.trips,public.payments,public.audit_log,public.idempotency_keys in exclusive mode nowait;
 plan:=app_private.deletion_plan(challenge.scope);
 if plan->>'blocked' is not null or plan->>'hash' is distinct from challenge.plan_hash then raise exception 'Data changed; request a new preview' using errcode='P2007'; end if;
 insert into app_private.deleted_entities(entity_table,entity_id)
 select kind,id from (
  select 'trips' kind,jsonb_array_elements_text(plan->'trip_ids') id union all
  select 'payments',jsonb_array_elements_text(plan->'payment_ids') union all
  select 'opening_balances',jsonb_array_elements_text(plan->'opening_ids') union all
  select 'vehicles',jsonb_array_elements_text(plan->'vehicle_ids') union all
  select 'contractors',jsonb_array_elements_text(plan->'contractor_ids')
 ) deleted on conflict do nothing;
 select coalesce(array_agg(x),array[]::text[]) into ids from jsonb_array_elements_text(plan->'payment_ids') x;
 delete from public.payments where id=any(ids);
 select coalesce(array_agg(x),array[]::text[]) into ids from jsonb_array_elements_text(plan->'trip_ids') x;
 delete from public.trips where id=any(ids);
 select coalesce(array_agg(x),array[]::text[]) into ids from jsonb_array_elements_text(plan->'opening_ids') x;
 delete from public.opening_balances where id=any(ids);
 select coalesce(array_agg(x),array[]::text[]) into ids from jsonb_array_elements_text(plan->'vehicle_ids') x;
 delete from public.vehicle_accounts where vehicle_id=any(ids);
 delete from public.vehicles where id=any(ids);
 select coalesce(array_agg(x),array[]::text[]) into ids from jsonb_array_elements_text(plan->'contractor_ids') x;
 delete from public.contractors where id=any(ids) and not is_primary;
 v_outcome:=jsonb_build_object('status','OK','counts',plan->'counts','challenge_id',challenge.id);
 perform public.app_write_audit('SETTINGS','DATA_PURGE:'||challenge.id::text,'UPDATE','حذف نهائي مؤكد من الإعدادات',null,
  jsonb_build_object('scope',challenge.scope,'counts',plan->'counts'),null,uid);
 update app_private.deletion_challenges set consumed_at=clock_timestamp(),outcome=v_outcome where id=challenge.id;
 return v_outcome;
end $$;
revoke all on function public.app_op_data_purge_execute(jsonb) from public,anon,authenticated;
grant execute on function public.app_op_data_purge_execute(jsonb) to authenticated;

create or replace function public.app_idempotency_begin(
    p_key text,
    p_operation text,
    p_payload jsonb,
    p_user uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_hash text;
    v_inserted integer := 0;
    v_rec public.idempotency_keys%rowtype;
begin
    if p_key is null or btrim(p_key) = '' then
        raise exception 'Request key is required' using errcode = '22023';
    end if;
    if p_operation is null or btrim(p_operation) = '' then
        raise exception 'Operation name is required' using errcode = '22023';
    end if;
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
        raise exception 'Request payload must be a JSON object' using errcode = '22023';
    end if;

    -- jsonb::text تمثيل قياسي (مفاتيح مرتبة) ⇒ البصمة مستقرة عند إعادة المحاولة.
    v_hash := md5(p_operation || '|' || p_payload::text);

    insert into public.idempotency_keys (key, user_id, operation, payload_hash, status)
    values (p_key, p_user, p_operation, v_hash, 'PROCESSING')
    on conflict (key) do nothing
    returning 1 into v_inserted;

    if coalesce(v_inserted, 0) = 1 then
        return jsonb_build_object('__replay', false);
    end if;

    select * into v_rec from public.idempotency_keys where key = p_key;

    if v_rec.payload_hash is distinct from v_hash
       or v_rec.user_id is distinct from p_user then
        raise exception 'Request key reused with a different payload'
            using errcode = 'P2001';
    end if;

    if v_rec.status = 'COMPLETED' then
        if exists(select 1 from jsonb_each_text(coalesce(v_rec.response_body,'{}'::jsonb)) response
         join app_private.deleted_entities deleted on deleted.entity_id=response.value and deleted.entity_table=case response.key when 'trip_id' then 'trips' when 'payment_id' then 'payments' when 'opening_balance_id' then 'opening_balances' when 'vehicle_id' then 'vehicles' when 'contractor_id' then 'contractors' else '' end) then
         raise exception 'Previous operation refers to deleted data' using errcode='P2005';
        end if;
        return jsonb_build_object('__replay', true, 'response', v_rec.response_body);
    end if;

    raise exception 'Request key is still processing or previously failed; use a new key'
        using errcode = 'P2002';
end;
$$;
revoke all on function public.app_idempotency_begin(text,text,jsonb,uuid) from public,anon,authenticated;
