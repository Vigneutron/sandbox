-- Template bundles: a template can now generate multiple goals (with hooks,
-- loops, and machine edges) from a JSON body. Run in the Supabase SQL Editor.

alter table public.goal_templates
  add column if not exists body jsonb,
  add column if not exists pro boolean not null default false,
  add column if not exists category text not null default 'Community',
  add column if not exists description text not null default '';

-- retire the legacy hand-seeded officials (replaced by the 100-template seed)
delete from public.goal_templates where official and body is null;
