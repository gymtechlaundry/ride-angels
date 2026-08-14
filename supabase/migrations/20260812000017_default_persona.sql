-- Persist which persona to restore on each sign-in / session apply.

alter table public.profiles
  add column if not exists default_persona text;

alter table public.profiles
  drop constraint if exists profiles_default_persona_check;

alter table public.profiles
  add constraint profiles_default_persona_check
  check (
    default_persona is null
    or default_persona in ('rider', 'angel')
  );

comment on column public.profiles.default_persona is
  'Landing persona restored on each sign-in. Active mode can still switch in-session.';
