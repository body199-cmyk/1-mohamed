-- Owner-only history of daily encrypted Google Drive backups.
create table if not exists public.backup_history (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null unique,
  format text not null check (format = '1-mohamed-full-supabase-logical-backup'),
  file_name text not null,
  drive_file_id text not null,
  drive_web_view_link text,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  table_counts jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.backup_history enable row level security;
revoke all on public.backup_history from public, anon, authenticated;
grant select on public.backup_history to authenticated;
drop policy if exists "Only owner can inspect backup history" on public.backup_history;
create policy "Only owner can inspect backup history"
  on public.backup_history for select to authenticated
  using (public.app_is_owner());
