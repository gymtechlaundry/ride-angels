-- V1 circle UX: phone circle invites + angel "on my way" status.

-- —— Phone support on circle_invites ——
alter table public.circle_invites
  alter column email drop not null;

alter table public.circle_invites
  add column if not exists phone text;

alter table public.circle_invites
  drop constraint if exists circle_invites_contact_check;

alter table public.circle_invites
  add constraint circle_invites_contact_check
  check (email is not null or phone is not null);

create unique index if not exists circle_invites_rider_phone_pending_idx
  on public.circle_invites (rider_id, phone)
  where status = 'pending' and phone is not null;

-- Recreate email unique index so null emails (phone-only invites) don't collide.
drop index if exists circle_invites_rider_email_pending_idx;
create unique index circle_invites_rider_email_pending_idx
  on public.circle_invites (rider_id, lower(email))
  where status = 'pending' and email is not null;

-- —— create_circle_invite: email OR E.164 phone ——
create or replace function public.create_circle_invite(
  p_identifier text,
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
  v_raw text := trim(coalesce(p_identifier, ''));
  v_email text;
  v_phone text;
  v_existing public.ride_angel_connections%rowtype;
  v_invite public.circle_invites%rowtype;
  v_token text;
  v_invited_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_raw = '' then
    raise exception 'invalid_identifier';
  end if;
  if v_label is null then
    v_label := 'Trusted contact';
  end if;

  if position('@' in v_raw) > 0 then
    v_email := lower(v_raw);
    if v_email is null or v_email = '' then
      raise exception 'invalid_email';
    end if;
  else
    v_phone := regexp_replace(v_raw, '[^0-9+]', '', 'g');
    if v_phone !~ '^\+[0-9]{8,15}$' then
      raise exception 'invalid_phone';
    end if;
  end if;

  select * into v_rider
  from public.profiles
  where auth_user_id = v_uid
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_angel
  from public.find_profile_for_invite(coalesce(v_email, v_phone))
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

  -- No onboarded profile yet.
  if v_email is not null then
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
        token, rider_id, email, phone, relationship_label, status, expires_at
      ) values (
        v_token, v_rider.id, v_email, null, v_label, 'pending',
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
  end if;

  -- Unknown phone: tokenized link; client shares via SMS (no Resend).
  select * into v_invite
  from public.circle_invites
  where rider_id = v_rider.id
    and phone = v_phone
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
      token, rider_id, email, phone, relationship_label, status, expires_at
    ) values (
      v_token, v_rider.id, null, v_phone, v_label, 'pending',
      now() + interval '14 days'
    )
    returning * into v_invite;
  end if;

  return jsonb_build_object(
    'kind', 'phone_invite',
    'invite_id', v_invite.id,
    'token', v_invite.token,
    'phone', v_invite.phone,
    'invite_url',
      'https://hyperionappstudio.com/rideangels/invite/' || v_invite.token,
    'rider_display_name', coalesce(nullif(v_rider.display_name, ''), 'A Ride Angels user')
  );
end;
$$;

comment on function public.create_circle_invite(text, text) is
  'Invite by email or E.164 phone: pending connection if profile exists, else token for email/SMS share.';

-- list outbound includes phone invites
create or replace function public.list_my_outbound_circle_invites()
returns table (
  id uuid,
  email text,
  phone text,
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
    i.phone,
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

-- —— On my way ——
alter table public.ride_assignments
  add column if not exists on_my_way_at timestamptz;

create or replace function public.mark_angel_on_my_way(p_ride_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_ride public.ride_requests%rowtype;
  v_asg public.ride_assignments%rowtype;
  v_appt public.appointments%rowtype;
  v_now timestamptz := now();
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

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  limit 1;

  if not found then
    raise exception 'ride_not_found';
  end if;

  select * into v_asg
  from public.ride_assignments
  where ride_request_id = p_ride_request_id
  for update;

  if not found then
    raise exception 'assignment_not_found';
  end if;

  if v_asg.angel_id <> v_profile.id then
    raise exception 'not_assigned_angel';
  end if;

  if coalesce(v_asg.confirmation_status, 'confirmed') not in (
    'confirmed', 'pending_reconfirm'
  ) then
    raise exception 'assignment_not_active';
  end if;

  if v_ride.status in ('cancelled', 'ride_cancelled', 'completed') then
    raise exception 'ride_not_active';
  end if;

  update public.ride_assignments
  set on_my_way_at = v_now
  where id = v_asg.id
  returning * into v_asg;

  select * into v_appt from public.appointments where id = v_ride.appointment_id;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'angel_on_my_way',
    'On the way',
    coalesce(nullif(v_profile.display_name, ''), 'Your Ride Angel')
      || ' is on the way'
      || case
           when v_appt.title is not null and length(trim(v_appt.title)) > 0
             then ' for ' || trim(v_appt.title)
           else ''
         end
      || '.',
    'ride_assignment',
    v_asg.id::text,
    v_ride.appointment_id,
    v_ride.id
  );

  return jsonb_build_object(
    'ride_request_id', v_ride.id,
    'assignment_id', v_asg.id,
    'on_my_way_at', v_asg.on_my_way_at
  );
end;
$$;

comment on function public.mark_angel_on_my_way(uuid) is
  'Assigned angel marks on the way; notifies rider (angel_on_my_way).';

revoke all on function public.mark_angel_on_my_way(uuid) from public;
grant execute on function public.mark_angel_on_my_way(uuid) to authenticated;

revoke all on function public.create_circle_invite(text, text) from public;
grant execute on function public.create_circle_invite(text, text) to authenticated;

revoke all on function public.list_my_outbound_circle_invites() from public;
grant execute on function public.list_my_outbound_circle_invites() to authenticated;
