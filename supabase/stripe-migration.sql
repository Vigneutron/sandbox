-- Stripe billing migration. Run in the Supabase SQL Editor after schema.sql.
--
-- Pro status now comes only from Stripe via the webhook (service role), so
-- users lose write access to their profile row — they can still read it.

alter table public.profiles add column if not exists stripe_customer_id text;

drop policy if exists "own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (user_id = auth.uid());
