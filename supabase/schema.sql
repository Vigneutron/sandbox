-- Goal Goal Gadget database schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity text not null,
  why text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  cue text not null default '',
  days int[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  primary key (habit_id, date)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pro boolean not null default false
);

-- Row-level security: every user can only touch their own rows.
alter table public.goals enable row level security;
alter table public.habits enable row level security;
alter table public.completions enable row level security;
alter table public.profiles enable row level security;

create policy "own goals" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own habits" on public.habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own completions" on public.completions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
