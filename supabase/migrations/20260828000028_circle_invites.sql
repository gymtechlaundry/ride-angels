-- Family-first circle invites for users who may not have an account yet.
-- Existing onboarded users still get a pending ride_angel_connections row.
-- Unregistered emails get a circle_invites token emailed via Edge Function + Resend.

create table if not exists public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  relationship_label text not null default 'Trusted contact',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  claimed_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists circle_invites_rider_email_pending_idx
  on public.circle_invites (rider_id, lower(email))
  where status = 'pending';

create index if not exists circle_invites_token_idx on public.circle_invites (token);
create index if not exists circle_invites_rider_id_idx on public.circle_invites (rider_id);

alter table public.circle_invites enable row level security;

drop policy if exists "circle_invites_select_own" on public.circle_invites;
create policy "circle_invites_select_own"
  on public.circle_invites for select to authenticated
  using (
    rider_id in (
      select p.id from public.profiles p where p.auth_user_id = auth.uid()
    )
  );

-- No direct client insert/update/delete — use RPCs.

create or replace function public.create_circle_invite(
  p_email text,
  p_relationship_label text default 'Trusted contact'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rider public.profiles%rowtype;
  v_angel record;
  v_label text := nullif(trim(coalesce(p_relationship_label, '')), '');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing public.ride_angel_connections%rowtype;
  v_invite public.circle_invites%rowtype;
  v_token text;
  v_invited_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_email';
  end if;
  if v_label is null then
    v_label := 'Trusted contact';
  end if;

  select * into v_rider
  from public.profiles
  where auth_user_id = v_uid
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  -- Existing onboarded Ride Angels account → pending connection (no email invite).
  select * into v_angel
  from public.find_profile_for_invite(v_email)
  limit 1;

  if found and v_angel.id is not null then
    if v_angel.id = v_rider.id then
      raise exception 'cannot_invite_self';
    end if;

    select * into v_existing
    from public.ride_angel_connections
    where rider_id = v_rider.id
      and angel_id = v_angel.id
    limit 1;

    if found then
      if v_existing.status = 'accepted' then
        raise exception 'already_in_circle';
      end if;
      if v_existing.status = 'pending' then
        raise exception 'invite_already_pending';
      end if;

      update public.ride_angel_connections
      set
        status = 'pending',
        relationship_label = v_label,
        invited_at = v_invited_at,
        accepted_at = null,
        rider_display_name = coalesce(nullif(v_rider.display_name, ''), 'Rider'),
        angel_display_name = coalesce(nullif(v_angel.display_name, ''), 'Ride Angel')
      where id = v_existing.id
      returning * into v_existing;
    else
      insert into public.ride_angel_connections (
        rider_id,
        angel_id,
        status,
        relationship_label,
        rider_display_name,
        angel_display_name,
        invited_at
      )
      values (
        v_rider.id,
        v_angel.id,
        'pending',
        v_label,
        coalesce(nullif(v_rider.display_name, ''), 'Rider'),
        coalesce(nullif(v_angel.display_name, ''), 'Ride Angel'),
        v_invited_at
      )
      returning * into v_existing;
    end if;

    return jsonb_build_object(
      'kind', 'existing_user',
      'connection_id', v_existing.id,
      'angel_id', v_angel.id,
      'angel_display_name', coalesce(v_angel.display_name, 'Ride Angel')
    );
  end if;

  -- No account yet → pending email invite with shareable token.
  select * into v_invite
  from public.circle_invites
  where rider_id = v_rider.id
    and lower(email) = v_email
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if found then
    update public.circle_invites
    set
      relationship_label = v_label,
      updated_at = now(),
      expires_at = now() + interval '14 days'
    where id = v_invite.id
    returning * into v_invite;
  else
    v_token := replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');

    insert into public.circle_invites (
      token,
      rider_id,
      email,
      relationship_label,
      status,
      expires_at
    )
    values (
      v_token,
      v_rider.id,
      v_email,
      v_label,
      'pending',
      now() + interval '14 days'
    )
    returning * into v_invite;
  end if;

  return jsonb_build_object(
    'kind', 'email_invite',
    'invite_id', v_invite.id,
    'token', v_invite.token,
    'email', v_invite.email,
    'invite_url',
      'https://hyperionappstudio.com/rideangels/invite/' || v_invite.token,
    'rider_display_name', coalesce(nullif(v_rider.display_name, ''), 'A Ride Angels user')
  );
end;
$$;

comment on function public.create_circle_invite(text, text) is
  'Invite by email: pending connection if profile exists, else circle_invites token for Resend.';

revoke all on function public.create_circle_invite(text, text) from public;
grant execute on function public.create_circle_invite(text, text) to authenticated;

create or replace function public.claim_circle_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_angel public.profiles%rowtype;
  v_invite public.circle_invites%rowtype;
  v_rider public.profiles%rowtype;
  v_existing public.ride_angel_connections%rowtype;
  v_token text := trim(coalesce(p_token, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_token = '' then
    raise exception 'invalid_token';
  end if;

  select * into v_angel
  from public.profiles
  where auth_user_id = v_uid
  limit 1;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_invite
  from public.circle_invites
  where token = v_token
  limit 1;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'invite_not_pending';
  end if;
  if v_invite.expires_at <= now() then
    update public.circle_invites
    set status = 'expired', updated_at = now()
    where id = v_invite.id;
    raise exception 'invite_expired';
  end if;
  if v_invite.rider_id = v_angel.id then
    raise exception 'cannot_claim_own_invite';
  end if;

  select * into v_rider
  from public.profiles
  where id = v_invite.rider_id
  limit 1;

  select * into v_existing
  from public.ride_angel_connections
  where rider_id = v_invite.rider_id
    and angel_id = v_angel.id
  limit 1;

  if found then
    if v_existing.status = 'accepted' then
      update public.circle_invites
      set
        status = 'accepted',
        claimed_by_profile_id = v_angel.id,
        updated_at = now()
      where id = v_invite.id;
      return jsonb_build_object(
        'kind', 'already_accepted',
        'connection_id', v_existing.id,
        'rider_id', v_invite.rider_id,
        'rider_display_name', coalesce(v_rider.display_name, 'Rider')
      );
    end if;

    update public.ride_angel_connections
    set
      status = 'pending',
      relationship_label = v_invite.relationship_label,
      invited_at = now(),
      accepted_at = null,
      rider_display_name = coalesce(nullif(v_rider.display_name, ''), 'Rider'),
      angel_display_name = coalesce(nullif(v_angel.display_name, ''), 'Ride Angel')
    where id = v_existing.id
    returning * into v_existing;
  else
    insert into public.ride_angel_connections (
      rider_id,
      angel_id,
      status,
      relationship_label,
      rider_display_name,
      angel_display_name,
      invited_at
    )
    values (
      v_invite.rider_id,
      v_angel.id,
      'pending',
      v_invite.relationship_label,
      coalesce(nullif(v_rider.display_name, ''), 'Rider'),
      coalesce(nullif(v_angel.display_name, ''), 'Ride Angel'),
      now()
    )
    returning * into v_existing;
  end if;

  update public.circle_invites
  set
    status = 'accepted',
    claimed_by_profile_id = v_angel.id,
    updated_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'kind', 'claimed',
    'connection_id', v_existing.id,
    'rider_id', v_invite.rider_id,
    'rider_display_name', coalesce(v_rider.display_name, 'Rider'),
    'relationship_label', v_invite.relationship_label
  );
end;
$$;

comment on function public.claim_circle_invite(text) is
  'Authenticated invitee claims a circle invite token → pending ride_angel_connection.';

revoke all on function public.claim_circle_invite(text) from public;
grant execute on function public.claim_circle_invite(text) to authenticated;

create or replace function public.list_my_outbound_circle_invites()
returns table (
  id uuid,
  email text,
  relationship_label text,
  status text,
  token text,
  invite_url text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rider_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select p.id into v_rider_id
  from public.profiles p
  where p.auth_user_id = v_uid
  limit 1;

  if v_rider_id is null then
    return;
  end if;

  return query
  select
    i.id,
    i.email,
    i.relationship_label,
    i.status,
    i.token,
    'https://hyperionappstudio.com/rideangels/invite/' || i.token,
    i.expires_at,
    i.created_at
  from public.circle_invites i
  where i.rider_id = v_rider_id
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc;
end;
$$;

revoke all on function public.list_my_outbound_circle_invites() from public;
grant execute on function public.list_my_outbound_circle_invites() to authenticated;
