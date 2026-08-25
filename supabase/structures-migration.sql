-- Goal structures (linear / pyramid / tree) and milestone nesting.
-- Run in the Supabase SQL Editor after milestones-migration.sql.

alter table public.goals
  add column if not exists structure text not null default 'linear';

alter table public.milestones
  add column if not exists parent_id uuid references public.milestones (id) on delete cascade;
