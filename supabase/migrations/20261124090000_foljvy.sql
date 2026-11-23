-- Passet som pågår på datorn i salen, så att mobilen kan följa det. En rad per konto; klockan är ClockState i appen.
-- workout_id null betyder att inget pass pågår.
create table public.live_runs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  workout_id text,
  clock jsonb,
  updated_at timestamptz not null default now()
);
alter table public.live_runs enable row level security;
create policy "Godkända konton hanterar sitt eget pågående pass" on public.live_runs
  for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
revoke all on public.live_runs from anon;
-- Mobilen får ändringarna direkt via Supabase Realtime.
alter publication supabase_realtime add table public.live_runs;
