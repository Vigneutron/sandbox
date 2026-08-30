-- Habit hooks: a step can auto-complete once a habit goal has been done
-- enough times. Run in the Supabase SQL Editor.

alter table public.milestones
  add column if not exists hook_goal_id uuid references public.goals (id) on delete set null,
  add column if not exists hook_target int;
