-- Goal tree milestones. Run in the Supabase SQL Editor.

create table if not exists public.milestones (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  position int not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy "own milestones" on public.milestones
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
