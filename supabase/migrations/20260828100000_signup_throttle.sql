-- PROJ-1 · Behebung von BUG-3 aus dem QA-Bericht
--
-- Das Design stuetzte sich fuer die Registrierung auf Supabase' eigenes Limit
-- (30 Anfragen pro 5 Minuten je IP, `sign_in_sign_ups` in config.toml). QA hat gemessen,
-- dass es diesen Schutz hier nicht gibt: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` existiert im
-- Auth-Container gar nicht, 40 von 40 Direktregistrierungen gingen durch.
--
-- Die Registrierung bekommt deshalb eine eigene Drosselung, nach derselben Regel wie die
-- Anmeldung: eine Datenbankfunktion, die prueft UND festhaelt, damit es keine vom Browser
-- aufrufbare Ruecksetzfunktion braucht.
--
-- Werte: 10 Registrierungen je IP-Adresse in 60 Minuten. Grosszuegig fuer echte Nutzung -
-- eine Person legt ein Konto an, ein Buero hinter einer gemeinsamen IP vielleicht eine
-- Handvoll - und eng genug, dass massenhaftes Anlegen sofort auflaeuft.
--
-- Ein CAPTCHA bleibt die staerkere Massnahme und ist in spec.md bewusst zurueckgestellt.
-- Diese Drosselung ersetzt es nicht, sie schliesst nur die Luecke, die das Design offen
-- gelassen hat.

-- Die Tabelle traegt jetzt beide Arten von Versuchen.
alter table public.login_attempts
  add column kind text not null default 'login'
  check (kind in ('login', 'signup'));

comment on column public.login_attempts.kind is
  'login = fehlgeschlagener Anmeldeversuch (je E-Mail und je IP), signup = Registrierungsversuch (je IP).';

create index login_attempts_kind_ip_idx on public.login_attempts (kind, ip, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Das Anmelde-Tor zaehlt ab jetzt nur noch Anmeldeversuche.
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
-- Das Registrierungs-Tor. Nur je IP - die Adresse ist bei jeder Registrierung eine neue
-- und taugt deshalb nicht als Schluessel.
-- ---------------------------------------------------------------------------
create function public.signup_attempt_gate(p_email text, p_ip inet default null)
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

  -- Ohne erkennbare IP greift die Regel nicht - derselbe Vorbehalt wie beim Anmelde-Tor.
  if p_ip is null then
    insert into public.login_attempts (email, ip, kind)
    values (lower(btrim(p_email)), null, 'signup');
    return query select false, 0;
    return;
  end if;

  select a.attempted_at into v_ip_nth
    from public.login_attempts a
   where a.kind = 'signup'
     and a.ip = p_ip
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

comment on function public.signup_attempt_gate(text, inet) is
  'Begrenzt Registrierungen auf 10 je IP-Adresse in 60 Minuten. Prueft und haelt fest in einem Aufruf.';

-- ---------------------------------------------------------------------------
-- Das Zuruecksetzen nach erfolgreicher Anmeldung raeumt nur Anmeldeversuche weg.
-- Die Registrierungssperre einer IP darf sich nicht dadurch aufloesen, dass sich jemand
-- anmeldet.
-- ---------------------------------------------------------------------------
create or replace function public.clear_own_login_attempts()
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
   where kind = 'login'
     and email = lower(btrim(v_email));
end;
$$;

-- Die Kontoloeschung raeumt weiterhin alles zu dieser Adresse ab, beide Arten.
-- (delete_own_account bleibt unveraendert - es filtert nicht nach kind.)

revoke execute on function public.signup_attempt_gate(text, inet) from public;
grant  execute on function public.signup_attempt_gate(text, inet) to anon, authenticated;
