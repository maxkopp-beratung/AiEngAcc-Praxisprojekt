-- PROJ-1 BUG-1: the login throttle checked first and counted the failure later, in two calls.
-- Parallel attempts all passed the check before the first failure was counted (12 of 12 got
-- through instead of 5). Now one call checks the lock and reserves the attempt as a failure in a
-- single serialized step; the server releases the reservation when the attempt was no failure.
-- 20261006000002_login_throttle.sql is already applied and stays frozen; this corrects it forward.

-- Check the lock and, if free, record the attempt as a failure. Returns the id of the reservation
-- (null when blocked). The transaction-scoped advisory lock serializes all calls, so the next
-- attempt always sees the reservations of the ones before it.
create function public.begin_login_attempt(p_email_hash text, p_ip_hash text)
returns table (blocked boolean, retry_after_seconds integer, attempt_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  status record;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('wattwann.login_throttle', 0));

  delete from private.login_failures where created_at < now() - interval '15 minutes';

  select s.blocked, s.retry_after_seconds into status
    from public.login_throttle_status(p_email_hash, p_ip_hash) s;
  if status.blocked then
    return query select true, status.retry_after_seconds, null::bigint;
    return;
  end if;

  insert into private.login_failures (email_hash, ip_hash)
  values (p_email_hash, p_ip_hash)
  returning id into new_id;
  return query select false, 0, new_id;
end;
$$;

-- Undo a reservation: the attempt succeeded or was not a wrong password (AC-6, EC-5).
create function public.release_login_attempt(p_attempt_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.login_failures where id = p_attempt_id;
$$;

-- Replaced by begin_login_attempt; nothing calls it any more.
drop function public.record_login_failure(text, text);

revoke execute on function public.begin_login_attempt(text, text) from public, anon, authenticated;
revoke execute on function public.release_login_attempt(bigint) from public, anon, authenticated;

grant execute on function public.begin_login_attempt(text, text) to service_role;
grant execute on function public.release_login_attempt(bigint) to service_role;
