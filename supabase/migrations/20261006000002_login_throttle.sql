-- PROJ-1: login throttle (AC-10, AC-11) and the signup existence check (AC-7).
-- Failed attempts are stored only as SHA-256 hashes of email and IP, for at most 15 minutes.
-- Nothing here is reachable for anon/authenticated: only the server (service_role) may call the functions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.login_failures (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

comment on table private.login_failures is 'PROJ-1: failed login attempts (hashed), kept max. 15 minutes.';

create index login_failures_email_hash_created_at_idx on private.login_failures (email_hash, created_at);
create index login_failures_ip_hash_created_at_idx on private.login_failures (ip_hash, created_at);

-- Defence in depth: RLS on without policies, and no grants.
alter table private.login_failures enable row level security;
revoke all on table private.login_failures from public, anon, authenticated;

-- Lock status: blocked when there are >= 5 failures for the email hash OR >= 20 for the IP hash
-- within the last 15 minutes (sliding window). retry_after_seconds = until enough failures have
-- left the window for the count to drop below the limit; with both counters blocked, the later one.
create function public.login_throttle_status(p_email_hash text, p_ip_hash text)
returns table (blocked boolean, retry_after_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  email_limit constant integer := 5;
  ip_limit constant integer := 20;
  lock_window constant interval := interval '15 minutes';
  email_release timestamptz;
  ip_release timestamptz;
  release_at timestamptz;
begin
  -- The limit-th most recent failure is the one whose expiry brings the count below the limit.
  select f.created_at + lock_window into email_release
    from private.login_failures f
   where f.email_hash = p_email_hash
     and f.created_at > now() - lock_window
   order by f.created_at desc
  offset email_limit - 1
   limit 1;

  select f.created_at + lock_window into ip_release
    from private.login_failures f
   where f.ip_hash = p_ip_hash
     and f.created_at > now() - lock_window
   order by f.created_at desc
  offset ip_limit - 1
   limit 1;

  release_at := greatest(email_release, ip_release); -- greatest() ignores nulls

  if release_at is null then
    return query select false, 0;
  else
    return query select true, greatest(1, ceil(extract(epoch from (release_at - now())))::integer);
  end if;
end;
$$;

-- Record one failed attempt; expired rows are removed on the way.
create function public.record_login_failure(p_email_hash text, p_ip_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.login_failures where created_at < now() - interval '15 minutes';
  insert into private.login_failures (email_hash, ip_hash) values (p_email_hash, p_ip_hash);
$$;

-- Does an account with this email exist? Used only by the signup action (AC-7).
create function public.auth_email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(btrim(p_email)));
$$;

revoke execute on function public.login_throttle_status(text, text) from public, anon, authenticated;
revoke execute on function public.record_login_failure(text, text) from public, anon, authenticated;
revoke execute on function public.auth_email_exists(text) from public, anon, authenticated;

grant execute on function public.login_throttle_status(text, text) to service_role;
grant execute on function public.record_login_failure(text, text) to service_role;
grant execute on function public.auth_email_exists(text) to service_role;
