-- App creator / moderator for discussion board.

alter table public.profiles
  add column if not exists is_app_creator boolean not null default false;

comment on column public.profiles.is_app_creator is
  'Ride Angels product creator / moderator. Can delete any feedback posts and replies.';

create or replace function public.is_app_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_app_creator
      from public.profiles p
      where p.auth_user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

revoke all on function public.is_app_creator() from public;
grant execute on function public.is_app_creator() to authenticated;

-- Mark known creator account(s). Safe if no match.
update public.profiles
set is_app_creator = true
where lower(coalesce(email, '')) in (
  'devin@hyperionappstudio.com'
);

alter table public.feedback_posts
  add column if not exists author_is_app_creator boolean not null default false;

alter table public.feedback_replies
  add column if not exists author_is_app_creator boolean not null default false;

update public.feedback_posts fp
set author_is_app_creator = true
from public.profiles p
where p.id = fp.author_id
  and p.is_app_creator = true;

update public.feedback_replies fr
set author_is_app_creator = true
from public.profiles p
where p.id = fr.author_id
  and p.is_app_creator = true;

-- Creators can delete any post / reply; authors still delete their own.
drop policy if exists "feedback_posts_delete_own" on public.feedback_posts;
drop policy if exists "feedback_posts_delete_own_or_creator" on public.feedback_posts;
create policy "feedback_posts_delete_own_or_creator"
  on public.feedback_posts
  for delete
  to authenticated
  using (auth.uid() = author_id or public.is_app_creator());

drop policy if exists "feedback_replies_delete_own" on public.feedback_replies;
drop policy if exists "feedback_replies_delete_own_or_creator" on public.feedback_replies;
create policy "feedback_replies_delete_own_or_creator"
  on public.feedback_replies
  for delete
  to authenticated
  using (auth.uid() = author_id or public.is_app_creator());
