-- Account deletion must not DELETE FROM storage.objects (Postgres raises
-- "Direct deletion from storage tables is not allowed. Use the Storage API instead.").
-- The app removes avatars / feedback-screenshots via supabase.storage before RPC.

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

  delete from auth.users
  where id = uid;

  if not found then
    raise exception 'account_not_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling Auth user and cascaded profile/domain rows. App removes Storage files via Storage API first.';
