-- Ride Angels Phase 1: profiles keyed by Supabase Auth user id.
-- Run in Supabase Dashboard → SQL Editor (or via CLI migration).
-- Do NOT key ownership by email or phone.

create table if not exists public.profiles (
  id uuid primary key,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default 'Ride Angels member',
  email text,
  phone text,
  avatar_url text,
  roles text[] not null default '{}'::text[],
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_matches_auth_user check (id = auth_user_id)
);

create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);

comment on table public.profiles is
  'Ride Angels application profile. Ownership is auth_user_id only.';

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- Auto-create an empty profile when Auth creates a user (register OTP verify).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, auth_user_id, email, phone)
  values (
    new.id,
    new.id,
    new.email,
    new.phone
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- No delete from client — account deletion is a future support flow.
