alter table public.backup_history drop constraint if exists backup_history_format_check;
alter table public.backup_history add constraint backup_history_format_check
  check (format in ('1-mohamed-full-supabase-logical-backup', '1-mohamed-business-recovery-v1'));
