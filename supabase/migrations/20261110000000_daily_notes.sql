-- Daily notes: per-user, per-date-range notes shown in the Daily (اليومية) page.
-- Previously stored only in localStorage (lost on device change / cache clear).

create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_from text not null,
  date_to text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, date_from, date_to)
);

alter table public.daily_notes enable row level security;

create policy "Users manage own daily notes"
  on public.daily_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists daily_notes_user_range_idx
  on public.daily_notes (user_id, date_from, date_to);