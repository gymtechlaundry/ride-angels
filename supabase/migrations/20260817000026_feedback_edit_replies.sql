-- Allow authors to edit their own replies; track updated_at.

alter table public.feedback_replies
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_feedback_replies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_replies_set_updated_at on public.feedback_replies;
create trigger feedback_replies_set_updated_at
  before update on public.feedback_replies
  for each row
  execute function public.set_feedback_replies_updated_at();

drop policy if exists "feedback_replies_update_own" on public.feedback_replies;
create policy "feedback_replies_update_own"
  on public.feedback_replies
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
