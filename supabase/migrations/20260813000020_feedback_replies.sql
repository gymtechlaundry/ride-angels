-- Threaded replies on feedback posts.

create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feedback_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null default 'Ride Angels member',
  author_avatar_url text,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_replies_post_id_created_at_idx
  on public.feedback_replies (post_id, created_at asc);

create index if not exists feedback_replies_author_id_idx
  on public.feedback_replies (author_id);

comment on table public.feedback_replies is
  'Replies in feedback discussion threads.';

alter table public.feedback_replies enable row level security;

drop policy if exists "feedback_replies_select_authenticated" on public.feedback_replies;
create policy "feedback_replies_select_authenticated"
  on public.feedback_replies
  for select
  to authenticated
  using (true);

drop policy if exists "feedback_replies_insert_own" on public.feedback_replies;
create policy "feedback_replies_insert_own"
  on public.feedback_replies
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "feedback_replies_delete_own" on public.feedback_replies;
create policy "feedback_replies_delete_own"
  on public.feedback_replies
  for delete
  to authenticated
  using (auth.uid() = author_id);
