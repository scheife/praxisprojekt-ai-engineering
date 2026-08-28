-- PROJ-1 · Umsetzung des /refine vom 28.08.2026 (AC-9, TD-22)
--
-- Befund aus dem vierten QA-Lauf (BUG-1, High): Ohne erklaerten Proxy hat keine Anfrage eine
-- verwertbare IP. Die vorige Migration (20260828120000) zaehlte diese Anfragen deshalb in einen
-- GEMEINSAMEN Eimer (`a.ip is not distinct from p_ip`) — gedacht als Schliessung einer Luecke,
-- gemessen aber als Denial of Service: fuenf Fehlversuche auf eine frei erfundene Adresse
-- sperrten JEDE echte Anmeldung fuer 15 Minuten.
--
-- Das /refine hat daraufhin AC-9 neu gefasst: Die IP-Regel beim Anmelden gilt nur noch hinter
-- einem ausdruecklich als vertrauenswuerdig erklaerten Proxy. Ohne einen solchen greift beim
-- Anmelden AUSSCHLIESSLICH die Adress-Regel AC-8 — und kein Anmeldeversuch wandert in einen
-- gemeinsamen Zaehler.
--
-- Warum das hier vertretbar ist und beim Registrieren nicht (TD-22 gegen TD-23):
--   Anmelden    — es gibt mit AC-8 eine Rueckfallregel je Konto, die auch ohne IP traegt. Ein
--                 gemeinsamer Zaehler kann Angreifer und Nutzer:innen nicht unterscheiden und
--                 ist damit als Schutz wertlos, als Ausfall aber teuer.
--   Registrieren— es gibt keine Rueckfallregel, weil jede Adresse neu ist. Dort bleibt der
--                 gemeinsame Eimer das Einzige, was massenhaftes Anlegen begrenzt.
--
-- `signup_attempt_gate` bleibt deshalb UNVERAENDERT. Diese Migration fasst nur das Anmelde-Tor an.

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
  -- NICHT gemeinsam gezaehlt: das war die Aussperrung aller Nutzer:innen.
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
  -- Einsetzen der Drosselung, welche Adresse existiert. Die Zeile traegt weiterhin die IP,
  -- sofern eine vorliegt — nur gezaehlt wird ohne sie nicht.
  insert into public.login_attempts (email, ip, kind) values (v_email, p_ip, 'login');
  return query select false, 0;
end;
$$;

comment on function public.login_attempt_gate(text, inet) is
  'Prueft die Sperre und haelt den Versuch fest. Regel je E-Mail-Adresse (AC-8) gilt immer; Regel je IP (AC-9) nur mit erkennbarer IP, also hinter einem erklaerten Proxy. Ohne IP wird NICHT gemeinsam gezaehlt (TD-22) — anders als beim Registrierungs-Tor (TD-23). Zaehlt auch Versuche auf unbekannte Adressen (AC-7).';
