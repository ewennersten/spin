-- Konton som måste godkännas och pass som bara ägaren ser.

-- Ett konto per inloggning. approved sätts av Elias i Supabase (tabellen profiles), aldrig av användaren själv.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Man ser sitt eget konto" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
-- Ingen policy för insert, update eller delete: kontot skapas av triggern nedan och ändras bara från Supabase.
revoke insert, update, delete on public.profiles from anon, authenticated;

create schema if not exists private;
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;
revoke execute on function private.create_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.create_profile();

-- Passen sparas som JSON, i samma form som i appen. id är appens id (exempelpassen har textid).
create table public.workouts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.workouts enable row level security;
create policy "Godkända konton hanterar sina egna pass" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.approved));
revoke all on public.workouts from anon;

-- Passen listas i den ordning de skapades, som i webbläsarens lagring.
alter table public.workouts add column created_at timestamptz not null default now();
