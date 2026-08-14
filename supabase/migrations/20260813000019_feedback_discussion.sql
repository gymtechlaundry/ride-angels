-- Community feedback: feature ideas and bug reports with optional screenshots.

create table if not exists public.feedback_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null default 'Ride Angels member',
  author_avatar_url text,
  kind text not null check (kind in ('feature', 'bug', 'general')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  screenshot_urls text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_posts_created_at_idx
  on public.feedback_posts (created_at desc);

create index if not exists feedback_posts_author_id_idx
  on public.feedback_posts (author_id);

comment on table public.feedback_posts is
  'In-app discussion board for feature ideas and bug reports.';

create or replace function public.set_feedback_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_posts_set_updated_at on public.feedback_posts;
create trigger feedback_posts_set_updated_at
  before update on public.feedback_posts
  for each row
  execute function public.set_feedback_posts_updated_at();

alter table public.feedback_posts enable row level security;

drop policy if exists "feedback_posts_select_authenticated" on public.feedback_posts;
create policy "feedback_posts_select_authenticated"
  on public.feedback_posts
  for select
  to authenticated
  using (true);

drop policy if exists "feedback_posts_insert_own" on public.feedback_posts;
create policy "feedback_posts_insert_own"
  on public.feedback_posts
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "feedback_posts_update_own" on public.feedback_posts;
create policy "feedback_posts_update_own"
  on public.feedback_posts
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "feedback_posts_delete_own" on public.feedback_posts;
create policy "feedback_posts_delete_own"
  on public.feedback_posts
  for delete
  to authenticated
  using (auth.uid() = author_id);

-- Screenshots storage (public read so posts can render images).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback_screenshots_public_read" on storage.objects;
create policy "feedback_screenshots_public_read"
  on storage.objects for select
  using (bucket_id = 'feedback-screenshots');

drop policy if exists "feedback_screenshots_insert_own" on storage.objects;
create policy "feedback_screenshots_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "feedback_screenshots_update_own" on storage.objects;
create policy "feedback_screenshots_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "feedback_screenshots_delete_own" on storage.objects;
create policy "feedback_screenshots_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
