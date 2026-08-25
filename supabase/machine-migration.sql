-- Machine goals (Pro): free-form process graphs with paths, loops, and
-- cross-goal hooks. Run in the Supabase SQL Editor.

alter table public.milestones
  add column if not exists pos_x double precision,
  add column if not exists pos_y double precision,
  add column if not exists loop_target int,
  add column if not exists loop_count int not null default 0,
  add column if not exists loop_last date,
  add column if not exists hook_source_id uuid references public.milestones (id) on delete set null;

create table if not exists public.machine_edges (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  from_id uuid not null references public.milestones (id) on delete cascade,
  to_id uuid not null references public.milestones (id) on delete cascade
);

alter table public.machine_edges enable row level security;

create policy "own machine edges" on public.machine_edges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
