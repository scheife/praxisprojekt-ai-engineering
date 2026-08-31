-- PROJ-2 · AC-5, AC-9, AC-10, AC-24, AC-26, AC-29, AC-30, EC-1
-- expenses: eine einzelne Geschaeftsausgabe.
--
-- Kopiert das Zugriffsmuster, das PROJ-1 an profiles etabliert hat — RLS an, eine Policy je
-- Operation, auth.uid() im Subselect, keinerlei Recht fuer anon. Kein zweites Muster daneben.
-- Zusaetzlich prueft jede Server Action die Zugehoerigkeit noch einmal im Anwendungscode:
-- AC-24 verlangt die Datenbankschicht, AC-25 die Anwendungsschicht (design.md, TD-25).

create table public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  amount_cents integer     not null,
  category     text        not null,
  spent_on     date        not null,
  note         text,
  client_token uuid        not null,
  created_at   timestamptz not null default now(),

  -- Betrag groesser 0 und hoechstens 9.999.999,99 EUR (AC-5, AC-29). In ganzen Cent, damit
  -- keine Summe je runden muss (design.md, TD-1).
  constraint expenses_amount_cents_range
    check (amount_cents between 1 and 999999999),

  -- Die neun Schluessel aus docs/data-model.md. Auf Datenbankebene, weil AC-10 es ausdruecklich
  -- "auch wenn der Anwendungscode umgangen wird" verlangt. Als Pruefregel und nicht als Enum:
  -- einen Enum-Wert wieder loszuwerden ist in Postgres praktisch unmoeglich (design.md, TD-2).
  constraint expenses_category_known
    check (category in (
      'office_supplies', 'software', 'hardware', 'travel', 'hospitality',
      'education', 'marketing', 'fees', 'other'
    )),

  -- Kein Datum vor dem 01.01.2000 (AC-30). Ein vertippter Jahrgang wie 0202 schickt die
  -- Rueckwaertsgrenze aus AC-18 sonst in eine Vergangenheit ueber 1.800 Jahre.
  --
  -- Bewusst KEINE Pruefregel gegen Zukunftsdaten (AC-7): "heute" bewegt sich, und eine Regel,
  -- die von der Uhr abhaengt, ist beim Wiedereinspielen einer Sicherung nicht reproduzierbar
  -- (design.md, TD-3). Das prueft das Schema im Anwendungscode.
  constraint expenses_spent_on_not_ancient
    check (spent_on >= date '2000-01-01'),

  -- Notiz hoechstens 200 Zeichen (AC-9). Leer wird als NULL gespeichert, nicht als leerer Text.
  constraint expenses_note_length
    check (note is null or char_length(note) <= 200),

  -- Die Vorgangskennung des Erfassungsvorgangs: dieselbe Kennung kann pro Person nur einmal zu
  -- einer Zeile werden. Das ist die Verteidigung gegen den Doppelklick, die auch ohne Browser
  -- haelt (EC-1). Der gesperrte Button ist nur die bequemere erste.
  constraint expenses_user_client_token_unique
    unique (user_id, client_token)
);

comment on table public.expenses is
  'Eine Geschaeftsausgabe in auslage. Gehoert genau einer Person, faellt mit deren Konto (AC-26). Betraege in ganzen Cent, Kategorie als stabiler Schluessel.';

-- Bedient die Monatsabfrage, die Sortierung aus AC-11 und die Suche nach dem aeltesten Monat
-- aus AC-18 in einem Index.
create index expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc, created_at desc);

-- Row Level Security: die zweite, vom Anwendungscode unabhaengige Pruefung (AC-24).
alter table public.expenses enable row level security;

-- auth.uid() im Subselect: Postgres wertet es dann einmal je Abfrage aus statt einmal je Zeile.
create policy "expenses_select_own"
  on public.expenses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- with check auch beim Anlegen und Aendern, damit sich eine Ausgabe nicht an eine fremde
-- Person weiterreichen laesst.
create policy "expenses_insert_own"
  on public.expenses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "expenses_update_own"
  on public.expenses
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "expenses_delete_own"
  on public.expenses
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- anon bekommt nichts. Wer nichts sehen darf, bekommt kein Recht, das etwas erlaubt.
revoke all on public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
