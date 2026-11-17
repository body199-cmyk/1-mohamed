-- Approved workspace members have operational access; owner identity is unchanged.
create table public.app_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique check(email=lower(btrim(email)) and length(email)<=254),
 is_active boolean not null default true,
 invited_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.app_members enable row level security;
revoke all on public.app_members from public,anon,authenticated;
grant select on public.app_members to authenticated;
create policy "Only owner can inspect membership" on public.app_members for select to authenticated using(public.app_is_owner());

create function public.app_has_access() returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth as $$
 select auth.uid() is not null and (public.app_is_owner() is true or exists(
 select 1 from public.app_members where user_id=auth.uid() and is_active));
$$;
revoke all on function public.app_has_access() from public,anon;
grant execute on function public.app_has_access() to authenticated;

create function public.app_require_access() returns uuid language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
begin
 if public.app_has_access() is not true then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return auth.uid();
end; $$;
revoke all on function public.app_require_access() from public,anon,authenticated;

-- Replace only the authorization call in the existing operational routines.
-- Keep formulas, signatures, grants, audit actor IDs and idempotency unchanged.
do $$ declare f record; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'app_op_%'
 loop
  execute replace(pg_get_functiondef(f.oid),'public.app_require_owner()','public.app_require_access()');
 end loop;
end; $$;

-- Direct business writes remain forbidden; only approved readers change.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public'
 and tablename in ('contractors','vehicles','vehicle_accounts','opening_balances','trips','payments','business_settings','audit_log','idempotency_keys')
 and cmd='SELECT' and qual like '%app_is_owner()%'
 loop execute format('alter policy %I on public.%I using (public.app_has_access())',p.policyname,p.tablename); end loop;
end; $$;

create function public.app_member_target(p_email text) returns uuid language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
declare target uuid; begin
 perform public.app_require_owner();
 select id into target from auth.users where lower(email)=lower(btrim(p_email));
 return target;
end; $$;

create function public.app_member_grant(p_user_id uuid,p_email text) returns void language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
declare actor uuid:=public.app_require_owner(); clean text:=lower(btrim(p_email)); begin
 if p_user_id=actor or clean is null or length(clean)>254 or clean !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or not exists(select 1 from auth.users where id=p_user_id and lower(email)=clean) then
 raise exception 'Invalid invitation target' using errcode='22023'; end if;
 insert into public.app_members(user_id,email,invited_by) values(p_user_id,clean,actor)
 on conflict(user_id) do update set email=excluded.email,is_active=true,invited_by=actor,updated_at=now();
end; $$;

create function public.app_member_revoke(p_user_id uuid) returns void language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
begin
 perform public.app_require_owner();
 update public.app_members set is_active=false,updated_at=now() where user_id=p_user_id;
 if not found then raise exception 'Member not found' using errcode='22023'; end if;
end; $$;
revoke all on function public.app_member_target(text),public.app_member_grant(uuid,text),public.app_member_revoke(uuid) from public,anon;
grant execute on function public.app_member_target(text),public.app_member_grant(uuid,text),public.app_member_revoke(uuid) to authenticated;
create index app_members_invited_by_idx on public.app_members(invited_by);
