-- PROJ-1 · Behebung von BUG-1 aus dem zweiten QA-Durchlauf (Datenbank-Haelfte)
--
-- Befund: Wer den `X-Forwarded-For`-Kopf selbst setzt, bestimmt den Schluessel, nach dem
-- gezaehlt wird. Zwei Wege fuehrten daran vorbei:
--   a) je Anfrage eine andere IP behaupten  -> 14 von 14 Anmeldeversuchen kamen durch
--   b) einen leeren ersten Eintrag schicken -> die App las gar keine IP mehr, und dann
--      uebersprangen BEIDE Tore die IP-Regel vollstaendig (16 von 16 Konten angelegt)
--
-- Diese Migration schliesst (b) — die Luecke in der Datenbank. Weg (a) schliesst die
-- Anwendung, indem sie den Kopf nur noch von einem vertrauenswuerdigen Proxy annimmt.
--
-- Die Aenderung ist klein und hat es in sich: "keine erkennbare IP" ist ab jetzt ein
-- EIGENER EIMER, kein Freifahrtschein. Wer ohne verwertbare IP kommt, wird mit allen
-- anderen zusammen gezaehlt, statt an der Regel vorbeizulaufen.
--
-- Warum das lokal nichts kaputt macht: Ohne vorgelagerten Server teilen sich heute schon
-- alle Anfragen dieselbe IP (`::1`) und damit denselben Eimer. Kuenftig ist dieser Eimer
-- `null` statt `::1` — dieselbe Menge, derselbe Effekt, nur ohne die Umgehung.
-- (Die Notiz "TD-14 war falsch: lokal gibt es sehr wohl eine IP" in design.md hatte das
-- schon festgehalten; die urspruengliche Sorge, die Entwicklung sperre sich selbst aus,
-- traf also ohnehin nie zu.)

-- ---------------------------------------------------------------------------
-- Anmelde-Tor: die IP-Regel gilt jetzt immer, auch ohne erkennbare IP.
-- ---------------------------------------------------------------------------
create or replace function public.login_attempt_gate(p_email text, p_ip inet default null)
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

  select a.attempted_at into v_email_nth
    from public.login_attempts a
   where a.kind = 'login'
     and a.email = v_email
     and a.attempted_at > now() - v_window
   order by a.attempted_at desc
  offset v_max - 1
   limit 1;

  -- `is not distinct from` behandelt NULL wie einen gewoehnlichen Wert: Anfragen ohne
  -- erkennbare IP zaehlen gemeinsam, statt ungezaehlt durchzulaufen. Vorher stand hier
  -- `if p_ip is not null then` — genau das war die Luecke.
  select a.attempted_at into v_ip_nth
    from public.login_attempts a
   where a.kind = 'login'
     and a.ip is not distinct from p_ip
     and a.attempted_at > now() - v_window
   order by a.attempted_at desc
  offset v_max - 1
   limit 1;

  -- greatest() ignoriert NULL in Postgres. Die Sperre endet, sobald der fuenftjuengste
  -- Versuch beider Regeln aus dem Fenster gefallen ist.
  v_unblock := greatest(v_email_nth, v_ip_nth) + v_window;

  if v_unblock is not null and v_unblock > now() then
    return query select true, ceil(extract(epoch from (v_unblock - now())))::integer;
    return;
  end if;

  insert into public.login_attempts (email, ip, kind) values (v_email, p_ip, 'login');
  return query select false, 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registrierungs-Tor: dito. Der frueher fruehe Ausstieg bei fehlender IP faellt weg —
-- er war die Stelle, an der sich AC-17 mit einem einzigen Kopf ausschalten liess.
-- ---------------------------------------------------------------------------
create or replace function public.signup_attempt_gate(p_email text, p_ip inet default null)
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
  perform public.cleanup_login_attempts();

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

comment on function public.login_attempt_gate(text, inet) is
  'Prueft die Sperre und haelt den Versuch fest (AC-8, AC-9). Zaehlt auch Versuche auf unbekannte Adressen (AC-7) und Anfragen ohne erkennbare IP — die teilen sich einen Eimer, statt an der Regel vorbeizulaufen.';

comment on function public.signup_attempt_gate(text, inet) is
  'Begrenzt Registrierungen auf 10 je IP-Adresse in 60 Minuten (AC-17). Anfragen ohne erkennbare IP teilen sich einen Eimer, statt die Regel zu ueberspringen.';

-- Ein Index, der die neue Abfrage traegt: `is not distinct from` sucht auch NULL-Zeilen,
-- und die stehen im bestehenden (kind, ip, attempted_at) ebenfalls drin. Kein neuer noetig.
