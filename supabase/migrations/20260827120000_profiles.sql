-- PROJ-1 · AC-2, AC-13
-- profiles: das Konto einer Person in auslage.
--
-- Die Tabelle traegt im MVP wenig mehr als die Verknuepfung zum Konto. Sie ist trotzdem da,
-- weil auth.users in einem Schema liegt, das der Client nicht direkt abfragen soll, und weil
-- hier das RLS-Muster samt Signup-Trigger entsteht, das PROJ-2 und PROJ-3 kopieren.
-- Bewusst KEINE E-Mail-Spalte: die Adresse steht in auth.users, eine Kopie waere eine zweite
-- Wahrheit (design.md, TD-8).

create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Konto einer Person in auslage. Eine Zeile je auth.users-Eintrag, angelegt vom Trigger on_auth_user_created.';

-- Row Level Security: die zweite, vom Anwendungscode unabhaengige Pruefung (AC-13).
alter table public.profiles enable row level security;

-- auth.uid() wird in ein Subselect gewickelt: Postgres wertet es dann einmal je Abfrage aus
-- statt einmal je Zeile.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Kein INSERT (macht der Trigger) und kein DELETE (macht die Loeschweitergabe aus auth.users)
-- fuer den Client. Ohne Policy ist die Operation verboten.
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

-- Legt die Profilzeile bei der Registrierung an, ohne dass ein weiterer Schritt noetig waere
-- (AC-2). Ein Trigger kann nicht vergessen und nicht umgangen werden (design.md, TD-7).
-- Er bleibt deshalb minimal und schreibt nichts ausser der ID.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- Eine Trigger-Funktion laesst sich ohnehin nicht direkt aufrufen; das Recht trotzdem
-- nicht stehen lassen.
revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
