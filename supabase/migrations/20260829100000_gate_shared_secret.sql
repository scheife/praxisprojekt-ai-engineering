-- PROJ-1 · Behebung von BUG-2 aus dem sechsten QA-Lauf (AC-8, AC-9, AC-17 · TD-26)
--
-- Befund: Beide Drosselungs-Tore waren fuer `anon` aufrufbar, und `anon` steckt als
-- oeffentlicher Schluessel in jedem Browser. Fuenf anonyme RPC-Aufrufe genuegten, um die
-- Anmeldung einer fremden Adresse 15 Minuten zu sperren, zehn fuer einen IP-Topf. Gemessen
-- am 28.08.2026, in Lauf 6 erneut ausgeloest.
--
-- Warum das Recht nicht einfach entzogen werden kann (TD-25): Eine Anmeldung beginnt ohne
-- Sitzung. Die App MUSS die Tore mit dem oeffentlichen Schluessel aufrufen koennen — sonst
-- kann sich niemand mehr anmelden. Und die Datenbank sieht einem Aufruf nicht an, ob er von
-- der App kommt oder von einem Skript.
--
-- Die Loesung ist deshalb ein Geheimnis, das App und Datenbank teilen und das NICHT im Repo
-- liegt (`service_role` scheidet nach TD-6 aus — dieser Schluessel soll in diesem Projekt gar
-- nicht existieren). Die App kennt es aus ihrer Umgebung, die Datenbank haelt seinen
-- SHA-256-Abdruck. Wer nur den oeffentlichen Schluessel hat, kommt nicht mehr durch.
--
-- FAIL CLOSED, ausdruecklich so entschieden: Ist kein Geheimnis hinterlegt oder passt es
-- nicht, lehnen die Tore JEDEN Aufruf ab — auch den der App. Anmeldung und Registrierung
-- stehen dann still. Das ist die laute Variante: die Luecke kann nicht versehentlich offen
-- bleiben, weil eine fehlende Einrichtung sofort auffaellt statt still zu wirken.
--
-- Eingerichtet wird das Geheimnis ausserhalb dieser Datei (sonst laege es im Repo):
--   select private.set_gate_secret('<der-wert-aus-GATE_SECRET>');
-- Derselbe Wert gehoert als `GATE_SECRET` in `.env.local`.

-- ---------------------------------------------------------------------------
-- Ein Schema, das PostgREST gar nicht erst ausliefert.
-- ---------------------------------------------------------------------------
-- Supabase exponiert nur `public` (und `graphql_public`). Was in `private` liegt, ist ueber
-- die Datenschnittstelle nicht erreichbar — unabhaengig von Policies und Grants. Das ist die
-- erste der beiden Schichten; die zweite sind die entzogenen Rechte darunter.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.gate_secret (
  -- Genau eine Zeile. Der Check macht das erzwingbar, ohne eine Sequenz zu brauchen.
  id            boolean primary key default true check (id),
  -- Nur der Abdruck, nie der Wert selbst: ein Datenbank-Abzug gibt das Geheimnis damit
  -- nicht preis, und die Datenbank braucht den Klartext fuer den Vergleich nicht.
  secret_sha256 bytea   not null,
  updated_at    timestamptz not null default now()
);

revoke all on table private.gate_secret from public, anon, authenticated;

comment on table private.gate_secret is
  'SHA-256-Abdruck des Geheimnisses, das App und Datenbank teilen (TD-26). Kein Klartext, kein Client-Zugriff — liegt bewusst ausserhalb von `public`, damit PostgREST die Tabelle gar nicht kennt. Gesetzt wird der Wert ueber private.set_gate_secret(), niemals in einer Migration.';

-- ---------------------------------------------------------------------------
-- Das Geheimnis setzen — von Hand, nicht aus einer Migration.
-- ---------------------------------------------------------------------------
create or replace function private.set_gate_secret(p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null or length(btrim(p_value)) < 16 then
    raise exception 'Das Tor-Geheimnis muss mindestens 16 Zeichen haben.';
  end if;

  insert into private.gate_secret (id, secret_sha256, updated_at)
  values (true, sha256(convert_to(p_value, 'utf8')), now())
  on conflict (id) do update
    set secret_sha256 = excluded.secret_sha256,
        updated_at    = excluded.updated_at;
end;
$$;

revoke execute on function private.set_gate_secret(text) from public, anon, authenticated;

comment on function private.set_gate_secret(text) is
  'Hinterlegt den Abdruck des geteilten Geheimnisses. Liegt in `private`, ist also ueber die Datenschnittstelle nicht aufrufbar — nur ueber psql oder Studio.';

-- ---------------------------------------------------------------------------
-- Die Pruefung, die beide Tore vorschalten.
-- ---------------------------------------------------------------------------
create or replace function private.assert_gate_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected bytea;
begin
  select g.secret_sha256 into v_expected from private.gate_secret g;

  -- Kein Geheimnis hinterlegt => niemand kommt durch. Das ist die bewusste Entscheidung
  -- gegen ein stilles Durchwinken: eine vergessene Einrichtung faellt sofort auf.
  if v_expected is null
     or p_secret is null
     or sha256(convert_to(p_secret, 'utf8')) is distinct from v_expected then
    -- 42501 = insufficient_privilege. PostgREST macht daraus HTTP 403; die App wertet
    -- jeden Fehler als `unavailable` und laesst die Anmeldung damit NICHT durch.
    raise exception 'gate secret mismatch' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.assert_gate_secret(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Die alten Signaturen verschwinden.
-- ---------------------------------------------------------------------------
-- Ohne dieses Drop bliebe `login_attempt_gate(text, inet)` als eigene Ueberladung bestehen
-- und weiterhin fuer `anon` aufrufbar — die Luecke waere nicht geschlossen, sondern nur um
-- eine zweite Variante ergaenzt. Genau deshalb bekommt `p_secret` auch KEINEN Vorgabewert.

drop function if exists public.login_attempt_gate(text, inet);
drop function if exists public.signup_attempt_gate(text, inet);

-- ---------------------------------------------------------------------------
-- Anmelde-Tor (AC-8, AC-9) — unveraendert in der Sache, neu nur die Pruefung davor.
-- ---------------------------------------------------------------------------
create function public.login_attempt_gate(p_secret text, p_email text, p_ip inet default null)
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
  -- Zuerst das Geheimnis, dann alles andere: ein Aufruf ohne gueltiges Geheimnis darf
  -- weder zaehlen noch etwas ueber den Zaehlerstand verraten.
  perform private.assert_gate_secret(p_secret);

  perform public.cleanup_login_attempts();

  -- Die Regel je E-Mail-Adresse (AC-8). Sie gilt immer und traegt den Schutz allein, wenn
  -- keine vertrauenswuerdige IP vorliegt.
  select a.attempted_at into v_email_nth
    from public.login_attempts a
   where a.kind = 'login'
     and a.email = v_email
     and a.attempted_at > now() - v_window
   order by a.attempted_at desc
  offset v_max - 1
   limit 1;

  -- Die Regel je IP-Adresse (AC-9) — nur mit erkennbarer IP, also nur hinter einem erklaerten
  -- Proxy (TRUSTED_PROXY_HOPS >= 1, siehe src/lib/rate-limit.ts). Ohne IP wird hier bewusst
  -- NICHT gemeinsam gezaehlt: das war die Aussperrung aller Nutzer:innen (TD-22).
  if p_ip is not null then
    select a.attempted_at into v_ip_nth
      from public.login_attempts a
     where a.kind = 'login'
       and a.ip = p_ip
       and a.attempted_at > now() - v_window
     order by a.attempted_at desc
    offset v_max - 1
     limit 1;
  end if;

  -- greatest() ignoriert NULL in Postgres. Die Sperre endet, sobald der fuenftjuengste Versuch
  -- der greifenden Regel(n) aus dem Fenster gefallen ist.
  v_unblock := greatest(v_email_nth, v_ip_nth) + v_window;

  if v_unblock is not null and v_unblock > now() then
    return query select true, ceil(extract(epoch from (v_unblock - now())))::integer;
    return;
  end if;

  -- Festgehalten wird jeder Versuch, auch zu Adressen ohne Konto (AC-7): sonst verriete das
  -- Einsetzen der Drosselung, welche Adresse existiert.
  insert into public.login_attempts (email, ip, kind) values (v_email, p_ip, 'login');
  return query select false, 0;
end;
$$;

comment on function public.login_attempt_gate(text, text, inet) is
  'Prueft die Sperre und haelt den Versuch fest. Verlangt seit TD-26 das geteilte Geheimnis als erstes Argument — ohne gueltiges Geheimnis wird jeder Aufruf abgelehnt (BUG-2). Regel je E-Mail-Adresse (AC-8) gilt immer; Regel je IP (AC-9) nur mit erkennbarer IP. Ohne IP wird NICHT gemeinsam gezaehlt (TD-22) — anders als beim Registrierungs-Tor (TD-23). Zaehlt auch Versuche auf unbekannte Adressen (AC-7).';

-- ---------------------------------------------------------------------------
-- Registrierungs-Tor (AC-17) — ebenfalls nur um die Pruefung ergaenzt.
-- ---------------------------------------------------------------------------
create function public.signup_attempt_gate(p_secret text, p_email text, p_ip inet default null)
returns table (blocked boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window  constant interval := interval '60 minutes';
  v_max     constant integer  := 10;
  v_ip_nth  timestamptz;
  v_unblock timestamptz;
begin
  perform private.assert_gate_secret(p_secret);

  perform public.cleanup_login_attempts();

  -- Anders als beim Anmelden zaehlen Versuche OHNE erkennbare IP hier gemeinsam
  -- (`is not distinct from`): es gibt keine Rueckfallregel je Konto, weil jede Adresse
  -- neu ist (TD-23).
  select a.attempted_at into v_ip_nth
    from public.login_attempts a
   where a.kind = 'signup'
     and a.ip is not distinct from p_ip
     and a.attempted_at > now() - v_window
   order by a.attempted_at desc
  offset v_max - 1
   limit 1;

  v_unblock := v_ip_nth + v_window;

  if v_unblock is not null and v_unblock > now() then
    return query select true, ceil(extract(epoch from (v_unblock - now())))::integer;
    return;
  end if;

  insert into public.login_attempts (email, ip, kind)
  values (lower(btrim(p_email)), p_ip, 'signup');
  return query select false, 0;
end;
$$;

comment on function public.signup_attempt_gate(text, text, inet) is
  'Begrenzt Registrierungen auf 10 Versuche je Herkunft in 60 Minuten (AC-17). Verlangt seit TD-26 das geteilte Geheimnis als erstes Argument (BUG-2). Anfragen ohne erkennbare IP teilen sich einen Eimer (TD-23).';

-- ---------------------------------------------------------------------------
-- Rechte auf den neuen Signaturen.
-- ---------------------------------------------------------------------------
-- `anon` behaelt das Ausfuehrungsrecht, weil eine Anmeldung ohne Sitzung beginnt und die App
-- die Tore genau so aufruft. Der Schutz liegt jetzt nicht mehr im Recht, sondern im
-- Geheimnis: wer nur den oeffentlichen Schluessel hat, kommt nicht durch.

revoke execute on function public.login_attempt_gate(text, text, inet)  from public;
revoke execute on function public.signup_attempt_gate(text, text, inet) from public;

grant execute on function public.login_attempt_gate(text, text, inet)  to anon, authenticated;
grant execute on function public.signup_attempt_gate(text, text, inet) to anon, authenticated;
