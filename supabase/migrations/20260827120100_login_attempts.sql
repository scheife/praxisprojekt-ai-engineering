-- PROJ-1 · AC-7, AC-8, AC-9, AC-16
-- login_attempts: die Zaehler der Drosselung gegen automatisiertes Passwort-Raten.
--
-- Ein Eintrag je Anmeldeversuch statt eines mitgefuehrten Zaehlers: die Fensterrechnung
-- ("wie viele in den letzten 15 Minuten") ist damit eine simple Abfrage, und die
-- 24-Stunden-Loeschung ein Zeilenloeschen statt einer Zustandspflege.
--
-- Die Tabelle gehoert niemandem und haengt an keinem Profil. Sie ist die einzige Tabelle
-- des Produkts, auf die KEIN Client zugreifen kann.

create table public.login_attempts (
  id           bigint      generated always as identity primary key,
  email        text        not null,
  ip           inet,
  attempted_at timestamptz not null default now()
);

comment on table public.login_attempts is
  'Sicherheitsprotokollierung fuer die Anmelde-Drosselung. Kein Client-Zugriff. Zeilen werden nach 24 Stunden geloescht (AC-16).';
comment on column public.login_attempts.ip is
  'Leer, wenn die Anfrage ohne erkennbare IP kam (lokaler Betrieb ohne vorgelagerten Server). Dann greift nur die Adress-Regel.';

create index login_attempts_email_idx        on public.login_attempts (email, attempted_at desc);
create index login_attempts_ip_idx           on public.login_attempts (ip, attempted_at desc);
create index login_attempts_attempted_at_idx on public.login_attempts (attempted_at);

-- RLS an und BEWUSST keine Policy: wer nichts sehen darf, bekommt keine Policy, die etwas
-- erlaubt. Dazu keine Rechte fuer anon/authenticated. Gelesen und geschrieben wird
-- ausschliesslich durch die Funktionen unten (design.md, TD-5).
alter table public.login_attempts enable row level security;

-- Supabase' Vorgabe-Rechte lassen anon/authenticated sonst TRUNCATE, REFERENCES und TRIGGER
-- auf neuen Tabellen. Ueber die Datenschnittstelle ist davon nichts erreichbar, aber eine
-- Tabelle, die niemand anfassen soll, sollte auch kein Recht tragen, das man erklaeren muss.
-- (TRUNCATE umgeht RLS - genau deshalb steht diese Zeile hier.)
revoke all on public.login_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aufraeumen: alles aelter als 24 Stunden faellt weg (AC-16).
-- ---------------------------------------------------------------------------
create function public.cleanup_login_attempts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.login_attempts
   where attempted_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.cleanup_login_attempts() is
  'Loescht Drosselungs-Zeilen aelter als 24 Stunden (AC-16). Laeuft stuendlich per pg_cron und zusaetzlich bei jeder Torpruefung.';

-- ---------------------------------------------------------------------------
-- Das Tor: pruefen UND festhalten in einem Schritt.
--
-- Beides zusammen, weil eine separate "Zaehler zuruecksetzen"-Funktion, die der Browser
-- aufrufen koennte, die ganze Drosselung wertlos machen wuerde. Der Versuch wird VOR der
-- Pruefung der Zugangsdaten festgehalten; gelingt die Anmeldung, raeumt
-- clear_own_login_attempts() hinterher auf - und das kann nur, wer angemeldet ist.
--
-- Werte: 5 Versuche in 15 Minuten, getrennt je E-Mail-Adresse und je IP-Adresse.
-- Ein bereits gesperrter Versuch wird NICHT mitgezaehlt, sonst verlaengert Haemmern die
-- Sperre endlos.
-- ---------------------------------------------------------------------------
create function public.login_attempt_gate(p_email text, p_ip inet default null)
returns table (blocked boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email     text     := lower(btrim(p_email));
  v_window    constant interval := interval '15 minutes';
  v_max       constant integer  := 5;
  v_email_nth timestamptz;
  v_ip_nth    timestamptz;
  v_unblock   timestamptz;
begin
  perform public.cleanup_login_attempts();

  -- Der fuenftjuengste Versuch im Fenster. Gibt es ihn, sind bereits 5 da.
  select a.attempted_at into v_email_nth
    from public.login_attempts a
   where a.email = v_email
     and a.attempted_at > now() - v_window
   order by a.attempted_at desc
  offset v_max - 1
   limit 1;

  if p_ip is not null then
    select a.attempted_at into v_ip_nth
      from public.login_attempts a
     where a.ip = p_ip
       and a.attempted_at > now() - v_window
     order by a.attempted_at desc
    offset v_max - 1
     limit 1;
  end if;

  -- greatest() ignoriert NULL in Postgres. Die Sperre endet, sobald der fuenftjuengste
  -- Versuch beider Regeln aus dem Fenster gefallen ist.
  v_unblock := greatest(v_email_nth, v_ip_nth) + v_window;

  if v_unblock is not null and v_unblock > now() then
    return query
      select true, ceil(extract(epoch from (v_unblock - now())))::integer;
    return;
  end if;

  insert into public.login_attempts (email, ip) values (v_email, p_ip);
  return query select false, 0;
end;
$$;

comment on function public.login_attempt_gate(text, inet) is
  'Prueft die Sperre und haelt den Versuch fest (AC-8, AC-9). Zaehlt auch Versuche auf unbekannte Adressen, sonst verriete die Drosselung, welche Adresse existiert (AC-7).';

-- ---------------------------------------------------------------------------
-- Zuruecksetzen nach erfolgreicher Anmeldung.
-- Nimmt KEIN Argument: die Adresse kommt aus dem angemeldeten Konto. Damit kann niemand
-- den Zaehler einer fremden Adresse loeschen.
-- ---------------------------------------------------------------------------
create function public.clear_own_login_attempts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select u.email into v_email
    from auth.users u
   where u.id = auth.uid();

  if v_email is null then
    return;
  end if;

  delete from public.login_attempts
   where email = lower(btrim(v_email));
end;
$$;

comment on function public.clear_own_login_attempts() is
  'Loescht die Drosselungs-Zeilen des eigenen Kontos nach erfolgreicher Anmeldung. Ohne Argument, damit niemand fremde Zaehler zuruecksetzen kann.';

-- ---------------------------------------------------------------------------
-- Rechte. CREATE FUNCTION vergibt EXECUTE per Vorgabe an PUBLIC - das wird hier
-- zurueckgenommen und einzeln vergeben.
-- ---------------------------------------------------------------------------
revoke execute on function public.cleanup_login_attempts()        from public;
revoke execute on function public.login_attempt_gate(text, inet)  from public;
revoke execute on function public.clear_own_login_attempts()      from public;

-- Das Tor muss abgemeldet aufrufbar sein - eine Anmeldung beginnt ohne Sitzung.
grant execute on function public.login_attempt_gate(text, inet) to anon, authenticated;
-- Zuruecksetzen nur angemeldet.
grant execute on function public.clear_own_login_attempts() to authenticated;
-- cleanup bleibt ohne Client-Recht: das erledigt der Job und das Tor selbst.

-- ---------------------------------------------------------------------------
-- Der stuendliche Aufraeum-Job (AC-16). Zweiter Weg neben der Bereinigung im Tor:
-- der Job erledigt es auch ohne Verkehr, das Tor auch ohne Job.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-login-attempts',
  '0 * * * *',
  $job$ select public.cleanup_login_attempts() $job$
);
