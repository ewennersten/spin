-- Privata och delade pass. Ett nytt pass är privat. Ägaren (user_id) kan dela det med alla godkända konton, som då
-- kan köra och kopiera det. Bara ägaren kan ändra, dela och ta bort.

alter table public.workouts add column shared boolean not null default false;
-- Passen som fanns var gemensamma, så de förblir delade.
update public.workouts set shared = true;

drop policy "Godkända konton hanterar alla pass" on public.workouts;

create policy "Godkända konton ser sina egna och delade pass" on public.workouts
  for select to authenticated
  using ((user_id = (select auth.uid()) or shared) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
create policy "Godkända konton skapar egna pass" on public.workouts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
create policy "Ägaren ändrar sitt pass" on public.workouts
  for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
create policy "Ägaren tar bort sitt pass" on public.workouts
  for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
