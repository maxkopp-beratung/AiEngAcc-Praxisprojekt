-- PROJ-3: devices — a user's appliances with their run time (design.md → Data Model).
-- Every rule the app checks is enforced here a second time, because a signed-in user can call the
-- Data API directly with the public anon key and their own session (AC-2, AC-7, AC-8, AC-9).

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  -- Owner. Defaults to the caller; deleting the profile (i.e. the account) deletes the devices (AC-27).
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  duration_minutes integer not null,
  -- Drives the order of the cards (AC-10); not writable by users (see grants below).
  created_at timestamptz not null default now(),
  -- 1–40 characters (code points), no whitespace at either end (AC-6).
  constraint devices_name_check check (
    char_length(name) between 1 and 40
    and name !~ '^\s'
    and name !~ '\s$'
  ),
  -- 0:15 to 12:00 h in 15-minute steps (AC-7).
  constraint devices_duration_check check (
    duration_minutes between 15 and 720
    and duration_minutes % 15 = 0
  )
);

comment on table public.devices is 'PROJ-3: devices per user (name + run time); recommendations are computed, never stored.';

-- One name per account, ignoring case; names are stored trimmed, so outer spaces never count (AC-8, EC-8).
create unique index devices_user_name_key on public.devices (user_id, lower(name));

-- The sorted list per user (AC-10).
create index devices_user_created_idx on public.devices (user_id, created_at);

-- At most 20 devices per account (AC-9). The transaction-scoped advisory lock per user makes two
-- concurrent inserts count one after the other, so there are never 21 (EC-9).
create function public.enforce_device_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('wattwann.devices:' || new.user_id::text, 0));

  if (select count(*) from public.devices where user_id = new.user_id) >= 20 then
    raise exception 'device_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_device_limit() from public, anon, authenticated;

create trigger devices_enforce_limit
  before insert on public.devices
  for each row execute function public.enforce_device_limit();

-- Data-layer access: RLS on, explicit grants (new tables are not exposed automatically in this project).
alter table public.devices enable row level security;

revoke all on table public.devices from public, anon, authenticated;
grant select, delete on table public.devices to authenticated;
-- Only name and run time are writable; id, user_id and created_at come from the defaults.
grant insert (name, duration_minutes) on table public.devices to authenticated;
grant update (name, duration_minutes) on table public.devices to authenticated;

create policy "devices_select_own" on public.devices
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "devices_insert_own" on public.devices
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "devices_update_own" on public.devices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "devices_delete_own" on public.devices
  for delete to authenticated
  using ((select auth.uid()) = user_id);
