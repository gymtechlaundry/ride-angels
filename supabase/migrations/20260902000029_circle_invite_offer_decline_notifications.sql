-- Persist push/inbox notifications for circle invite (existing users),
-- circle accept, and rider declining a ride offer.
-- Client NotificationService.notify() is local-only; INSERT is RPC-only.

-- —— create_circle_invite: notify invitee when they already have an account ——
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

    insert into public.notifications (
      recipient_profile_id, type, title, body,
      related_entity_type, related_entity_id
    ) values (
      v_angel.id,
      'angel_invited',
      'Ride Angel invite',
      coalesce(nullif(v_rider.display_name, ''), 'A rider')
        || ' invited you to be their Ride Angel.',
      'ride_angel_connection',
      v_existing.id::text
    );

    return jsonb_build_object(
      'kind', 'existing_user',
      'connection_id', v_existing.id,
      'angel_id', v_angel.id,
      'angel_display_name', coalesce(v_angel.display_name, 'Ride Angel')
    );
  end if;

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
  'Invite by email: pending connection + angel_invited if profile exists, else circle_invites token for Resend.';

-- —— Angel accepts a pending circle invite → notify rider ——
create or replace function public.accept_ride_angel_invite(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_conn public.ride_angel_connections%rowtype;
  v_accepted_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where auth_user_id = v_uid
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_conn
  from public.ride_angel_connections
  where id = p_connection_id
  for update;

  if not found then
    raise exception 'connection_not_found';
  end if;

  if v_conn.angel_id <> v_profile.id then
    raise exception 'not_invitee';
  end if;

  if v_conn.status = 'accepted' then
    return jsonb_build_object(
      'connection_id', v_conn.id,
      'status', 'accepted'
    );
  end if;

  if v_conn.status <> 'pending' then
    raise exception 'invite_not_pending';
  end if;

  update public.ride_angel_connections
  set
    status = 'accepted',
    accepted_at = v_accepted_at,
    angel_display_name = coalesce(
      nullif(v_profile.display_name, ''),
      angel_display_name,
      'Ride Angel'
    )
  where id = v_conn.id
  returning * into v_conn;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id
  ) values (
    v_conn.rider_id,
    'angel_accepted',
    'Invite accepted',
    coalesce(nullif(v_profile.display_name, ''), 'A Ride Angel')
      || ' accepted your Ride Angel invite.',
    'ride_angel_connection',
    v_conn.id::text
  );

  return jsonb_build_object(
    'connection_id', v_conn.id,
    'status', 'accepted',
    'accepted_at', v_accepted_at
  );
end;
$$;

comment on function public.accept_ride_angel_invite(uuid) is
  'Angel accepts pending circle invite; notifies rider (angel_accepted).';

revoke all on function public.accept_ride_angel_invite(uuid) from public;
grant execute on function public.accept_ride_angel_invite(uuid) to authenticated;

-- —— Rider declines a pending offer → notify angel ——
create or replace function public.decline_ride_offer(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_offer public.ride_offers%rowtype;
  v_ride public.ride_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where auth_user_id = v_uid
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_offer
  from public.ride_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = v_offer.ride_request_id
  limit 1;

  if not found then
    raise exception 'ride_not_found';
  end if;

  if v_ride.rider_id <> v_profile.id then
    raise exception 'not_ride_owner';
  end if;

  if v_offer.status = 'declined' then
    return jsonb_build_object('offer_id', v_offer.id, 'status', 'declined');
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;

  update public.ride_offers
  set status = 'declined'
  where id = v_offer.id
  returning * into v_offer;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_offer.angel_id,
    'offer_declined',
    'Offer declined',
    coalesce(nullif(v_profile.display_name, ''), 'The rider')
      || ' declined your ride offer.',
    'ride_offer',
    v_offer.id::text,
    v_ride.appointment_id,
    v_ride.id
  );

  return jsonb_build_object(
    'offer_id', v_offer.id,
    'status', 'declined',
    'ride_request_id', v_ride.id
  );
end;
$$;

comment on function public.decline_ride_offer(uuid) is
  'Rider declines a pending offer; notifies angel (offer_declined).';

revoke all on function public.decline_ride_offer(uuid) from public;
grant execute on function public.decline_ride_offer(uuid) to authenticated;
