-- PROJ-1 · AC-15
-- Kontoloeschung (Art. 17 DSGVO).
--
-- Bewusst NICHT ueber die Admin-Schnittstelle: die braeuchte den service_role-Schluessel in
-- der Anwendung, und der hebelt Row Level Security komplett aus. Existiert er nicht, kann er
-- auch nicht verwechselt, geloggt oder versehentlich veroeffentlicht werden (design.md, TD-6).
--
-- Die Funktion loescht ausschliesslich das Konto der aufrufenden Person. Sie nimmt kein
-- Argument, das man faelschen koennte.

create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  -- Auch die Drosselungs-Zeilen dieser Adresse: "alle zugehoerigen Daten" heisst alle.
  if v_email is not null then
    delete from public.login_attempts where email = lower(btrim(v_email));
  end if;

  -- profiles haengt per on delete cascade an auth.users; Sitzungen, Auffrischungs-Token und
  -- Identitaeten ebenso. Diese eine Zeile raeumt daher das ganze Konto ab.
  delete from auth.users where id = v_uid;
end;
$$;

comment on function public.delete_own_account() is
  'Loescht das Konto der aufrufenden Person samt Profil, Sitzungen und Drosselungs-Zeilen (AC-15, Art. 17 DSGVO).';

revoke execute on function public.delete_own_account() from public;
grant  execute on function public.delete_own_account() to authenticated;
