-- Notify community when discussion posts / replies are created.
-- Inserts into public.notifications (push via existing notify_dispatch_push trigger).

create or replace function public.notify_feedback_post_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text;
  v_body text;
begin
  v_kind := case new.kind
    when 'feature' then 'feature idea'
    when 'bug' then 'bug report'
    else 'discussion'
  end;

  v_title := 'New discussion';
  v_body := left(
    coalesce(nullif(trim(new.author_display_name), ''), 'Someone')
      || ' posted a '
      || v_kind
      || ': '
      || coalesce(nullif(trim(new.title), ''), 'Untitled'),
    280
  );

  insert into public.notifications (
    recipient_profile_id,
    type,
    title,
    body,
    related_entity_type,
    related_entity_id
  )
  select
    p.id,
    'discussion_posted',
    v_title,
    v_body,
    'feedback_post',
    new.id::text
  from public.profiles p
  where p.id <> new.author_id
    and coalesce(p.onboarding_completed, false) = true;

  return new;
end;
$$;

drop trigger if exists feedback_posts_notify_created on public.feedback_posts;
create trigger feedback_posts_notify_created
  after insert on public.feedback_posts
  for each row
  execute function public.notify_feedback_post_created();

create or replace function public.notify_feedback_reply_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.feedback_posts%rowtype;
  v_title text;
  v_body text;
  v_snippet text;
begin
  select * into v_post
  from public.feedback_posts
  where id = new.post_id;

  if not found then
    return new;
  end if;

  v_snippet := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 100);
  v_title := 'New reply';
  v_body := left(
    coalesce(nullif(trim(new.author_display_name), ''), 'Someone')
      || ' replied on "'
      || coalesce(nullif(trim(v_post.title), ''), 'Untitled')
      || '"'
      || case
           when length(trim(v_snippet)) > 0 then ': ' || v_snippet
           else ''
         end,
    280
  );

  -- Post author + prior reply authors on this thread (exclude the new reply author).
  insert into public.notifications (
    recipient_profile_id,
    type,
    title,
    body,
    related_entity_type,
    related_entity_id
  )
  select distinct
    r.profile_id,
    'discussion_reply',
    v_title,
    v_body,
    'feedback_post',
    new.post_id::text
  from (
    select v_post.author_id as profile_id
    union
    select fr.author_id
    from public.feedback_replies fr
    where fr.post_id = new.post_id
      and fr.id <> new.id
  ) r
  where r.profile_id is not null
    and r.profile_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists feedback_replies_notify_created on public.feedback_replies;
create trigger feedback_replies_notify_created
  after insert on public.feedback_replies
  for each row
  execute function public.notify_feedback_reply_created();

comment on function public.notify_feedback_post_created() is
  'Fan-out in-app (+ push) notifications when a discussion post is created.';

comment on function public.notify_feedback_reply_created() is
  'Notify discussion participants when a reply is posted.';
