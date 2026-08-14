-- In-app account deletion (App Store Guideline 5.1.1(v)).
-- Authenticated users call public.delete_own_account(); it removes their Auth
-- user. Domain rows cascade from profiles.auth_user_id → auth.users.

-- Unblock profile deletion when this user created/assigned someone else's rows.
alter table public.appointments
  drop constraint if exists appointments_created_by_user_id_fkey;
alter table public.appointments
  add constraint appointments_created_by_user_id_fkey
  foreign key (created_by_user_id) references public.profiles (id) on delete set null;

alter table public.ride_requests
  drop constraint if exists ride_requests_created_by_user_id_fkey;
alter table public.ride_requests
  add constraint ride_requests_created_by_user_id_fkey
  foreign key (created_by_user_id) references public.profiles (id) on delete set null;

alter table public.ride_assignments
  drop constraint if exists ride_assignments_assigned_by_user_id_fkey;
alter table public.ride_assignments
  add constraint ride_assignments_assigned_by_user_id_fkey
  foreign key (assigned_by_user_id) references public.profiles (id) on delete set null;

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from storage.objects
  where bucket_id in ('avatars', 'feedback-screenshots')
    and name like uid::text || '/%';

  delete from auth.users
  where id = uid;

  if not found then
    raise exception 'account_not_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling Auth user, profile, rides, circle, and uploaded photos. Irreversible.';

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
