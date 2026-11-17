#!/usr/bin/env bash
set -euo pipefail

container="mohamed-backup-smoke"
work="$(mktemp -d)"
cleanup() {
  docker rm --force "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

docker rm --force "$container" >/dev/null 2>&1 || true
docker run --detach --name "$container" \
  --env POSTGRES_PASSWORD=smoke-only \
  postgres:17.11-bookworm >/dev/null

ready=false
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo "PostgreSQL fixture did not become ready."
  exit 1
fi

cat > "$work/schema.sql" <<'SQL'
create table public.app_owner (
  id integer primary key,
  owner_user_id uuid
);
create table public.app_members (
  user_id uuid primary key,
  email text not null,
  is_active boolean not null,
  invited_by uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table public.audit_log (id integer primary key, payload text not null);
create table public.business_settings (id text primary key, business_name text not null);
create table public.contractors (id integer primary key, payload text not null);
create table public.idempotency_keys (id integer primary key, payload text not null);
create table public.opening_balances (id integer primary key, payload text not null);
create table public.payments (id integer primary key, payload text not null);
create table public.trips (id integer primary key, payload text not null);
create table public.vehicle_accounts (id integer primary key, payload text not null);
create table public.vehicles (id integer primary key, payload text not null);
SQL

docker exec --interactive "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres < "$work/schema.sql"

cat > "$work/source-data.sql" <<'SQL'
insert into public.app_owner values (1, '11111111-1111-4111-8111-111111111111');
insert into public.app_members values (
  '22222222-2222-4222-8222-222222222222', 'member@example.invalid', true,
  '11111111-1111-4111-8111-111111111111', now(), now()
);
insert into public.audit_log values (1, 'audit');
insert into public.business_settings values ('main', 'Example');
insert into public.contractors values (1, 'contractor');
insert into public.idempotency_keys values (1, 'idempotency');
insert into public.opening_balances values (1, 'opening');
insert into public.payments values (1, 'payment');
insert into public.trips values (1, 'trip');
insert into public.vehicle_accounts values (1, 'account');
insert into public.vehicles values (1, 'vehicle');
SQL

docker exec --interactive "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres < "$work/source-data.sql"

docker exec "$container" pg_dump --username postgres --dbname postgres \
  --schema=public \
  --exclude-table-data=public.app_owner \
  --exclude-table-data=public.app_members \
  --format=custom --no-owner --no-acl > "$work/public.dump"

test -s "$work/public.dump"
docker run --rm --user "$(id -u):$(id -g)" --volume "$work:/backup" postgres:17.11-bookworm \
  pg_restore --list /backup/public.dump > "$work/toc.list"

for table in app_members app_owner audit_log business_settings contractors idempotency_keys \
  opening_balances payments trips vehicle_accounts vehicles; do
  grep -Eq "TABLE public "$table"([[:space:]]|$)" "$work/toc.list"
done
for table in audit_log business_settings contractors idempotency_keys opening_balances \
  payments trips vehicle_accounts vehicles; do
  grep -Eq "TABLE DATA public "$table"([[:space:]]|$)" "$work/toc.list"
done
! grep -Eq "TABLE DATA public (app_owner|app_members)([[:space:]]|$)" "$work/toc.list"

docker exec "$container" createdb --username postgres restored
docker exec --interactive "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname restored < "$work/schema.sql"
docker exec "$container" psql --set ON_ERROR_STOP=1 --username postgres --dbname restored \
  --command "insert into public.app_owner values (1, null)"
docker cp "$work/public.dump" "$container:/tmp/public.dump" >/dev/null

docker exec "$container" pg_restore --data-only --no-owner --no-acl --exit-on-error \
  --username postgres --dbname restored /tmp/public.dump

result="$(docker exec "$container" psql --no-align --tuples-only --username postgres --dbname restored \
  --command "select
    (select count(*) from public.audit_log) = 1
    and (select count(*) from public.business_settings) = 1
    and (select count(*) from public.contractors) = 1
    and (select count(*) from public.idempotency_keys) = 1
    and (select count(*) from public.opening_balances) = 1
    and (select count(*) from public.payments) = 1
    and (select count(*) from public.trips) = 1
    and (select count(*) from public.vehicle_accounts) = 1
    and (select count(*) from public.vehicles) = 1
    and (select count(*) from public.app_owner) = 1
    and (select owner_user_id is null from public.app_owner where id = 1)
    and (select count(*) from public.app_members) = 0")"

if [ "$result" != "t" ]; then
  echo "Data-only restore did not preserve business rows and leave Auth mappings clean."
  exit 1
fi

echo "PostgreSQL 17 custom dump and data-only recovery smoke test passed."
