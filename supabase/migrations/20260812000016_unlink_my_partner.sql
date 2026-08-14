-- Allow a signed-in rider to revoke their own partner app link (e.g. ColorPing).

create or replace function public.unlink_my_partner(p_partner_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(p_partner_id), '') is null then
    raise exception 'partner_id_required';
  end if;

  update public.partner_account_links
  set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where profile_id = v_uid
    and partner_id = p_partner_id
    and status = 'verified';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'partner_link_not_found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'partner_id', p_partner_id,
    'unlinked', true
  );
end;
$$;

revoke all on function public.unlink_my_partner(text) from public;
grant execute on function public.unlink_my_partner(text) to authenticated;
