-- PROJ-1: hourly cleanup in the database itself (AC-27 and the 15-minute retention of login_failures).

create extension if not exists pg_cron with schema pg_catalog;

create function private.cleanup_auth_data()
returns void
language sql
security definer
set search_path = ''
as $$
  -- Accounts that were never confirmed within 7 days; profiles go with them via the cascade.
  delete from auth.users
   where email_confirmed_at is null
     and created_at < now() - interval '7 days';

  -- Failed login attempts outside the lock window.
  delete from private.login_failures
   where created_at < now() - interval '15 minutes';
$$;

revoke execute on function private.cleanup_auth_data() from public, anon, authenticated;

-- cron.schedule with an existing job name replaces that job, so re-running is safe.
select cron.schedule('proj1-auth-cleanup', '0 * * * *', $$select private.cleanup_auth_data()$$);
