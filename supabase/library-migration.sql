-- Goal template library: users publish goal structures; everyone can browse
-- and copy them. Run in the Supabase SQL Editor.

create table if not exists public.goal_templates (
  id uuid primary key,
  author_id uuid references auth.users (id) on delete set null,
  title text not null,
  structure text not null,
  official boolean not null default false,
  times_used int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.template_milestones (
  id uuid primary key,
  template_id uuid not null references public.goal_templates (id) on delete cascade,
  parent_id uuid references public.template_milestones (id) on delete cascade,
  title text not null,
  position int not null
);

alter table public.goal_templates enable row level security;
alter table public.template_milestones enable row level security;

-- the library is public to browse
create policy "read templates" on public.goal_templates
  for select using (true);
create policy "read template milestones" on public.template_milestones
  for select using (true);

-- publishing: signed-in users create templates they author
create policy "publish templates" on public.goal_templates
  for insert with check (author_id = auth.uid());
create policy "publish template milestones" on public.template_milestones
  for insert with check (
    exists (
      select 1 from public.goal_templates t
      where t.id = template_id and t.author_id = auth.uid()
    )
  );
create policy "delete own templates" on public.goal_templates
  for delete using (author_id = auth.uid());

-- usage counter, callable by any client without granting update on the table
create or replace function public.increment_template_uses(tid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.goal_templates set times_used = times_used + 1 where id = tid;
$$;
