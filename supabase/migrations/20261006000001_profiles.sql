-- PROJ-1: profiles — one row per auth user, holds only the optional display name.
-- The email stays in auth.users (no second copy). Deleting the auth user deletes the profile.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check check (
    display_name is null
    or (char_length(display_name) between 1 and 50 and display_name = btrim(display_name))
  )
);

comment on table public.profiles is 'PROJ-1: profile per auth user (optional display name).';

-- Data-layer access: RLS on, explicit grants (new tables are not exposed automatically in this project).
alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: the signup trigger creates profiles, the auth.users cascade removes them.

-- updated_at is maintained by the database, not by the client.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Signup hook: exactly one profile per new auth user (AC-3). The display name comes from the
-- signup metadata; blank or over-long values become "no name" (second line of defence behind Zod).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if name is not null and char_length(name) > 50 then
    name := null;
  end if;

  insert into public.profiles (id, display_name) values (new.id, name);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
