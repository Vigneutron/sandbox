-- Optional goal deadlines. Run in the Supabase SQL Editor.
alter table public.goals add column if not exists deadline date;
