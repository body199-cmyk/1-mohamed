-- The existing scoped backup reader may record results only in backup_history.
-- Other projects can apply application migrations without provisioning this login.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'offsite_backup_reader') then
    grant select on public.backup_history to offsite_backup_reader;
    grant insert (
      backup_date, format, file_name, drive_file_id, drive_web_view_link,
      size_bytes, sha256, table_counts
    ) on public.backup_history to offsite_backup_reader;
  end if;
end;
$$;
