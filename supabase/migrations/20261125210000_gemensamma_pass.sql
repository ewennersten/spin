-- Gemensamma pass: alla godkända konton ser, kör, ändrar och tar bort alla pass. user_id är nu den som skapade passet.

-- Samma id hos flera konton (exempelpassen) blir ett pass. Den senast ändrade raden behålls.
delete from public.workouts w
using public.workouts o
where w.id = o.id and (w.updated_at, w.user_id) < (o.updated_at, o.user_id);

alter table public.workouts drop constraint workouts_pkey;
alter table public.workouts add primary key (id);

drop policy "Godkända konton hanterar sina egna pass" on public.workouts;
create policy "Godkända konton hanterar alla pass" on public.workouts
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
