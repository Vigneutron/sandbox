-- Habit goals: weekly schedule + cue on the goal, one completion row per day.
-- Run in the Supabase SQL Editor.

alter table public.goals add column if not exists days int[];
alter table public.goals add column if not exists cue text not null default '';

create table if not exists public.habit_completions (
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  primary key (goal_id, date)
);

alter table public.habit_completions enable row level security;

create policy "own habit completions" on public.habit_completions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
