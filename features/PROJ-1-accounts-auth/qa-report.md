# QA-Testbericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-27
**App-Adresse:** `http://localhost:3000` (lokaler Dev-Server, Supabase in Docker auf Port 55321)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt nachgewiesen ·
> `[!] NICHT VERIFIZIERT` in diesem Durchlauf nicht prüfbar (mit Grund)

Alle Prüfungen liefen gegen die **laufende App** über echte HTTP-Anfragen. Die Formulare wurden über
die Progressive-Enhancement-Felder abgeschickt, also genau so, wie ein Browser es tut. Die
Prüfskripte liegen unter `/tmp/qa_*.py`; die Belege nennen jeweils, was gemessen wurde.

---

## Acceptance Criteria

### Registrierung

#### AC-1 — Konto anlegen, sofort angemeldet, landet auf `/`
- [x] Registrierung mit gültiger Adresse und 10+ Zeichen: `HTTP 303 → /`, danach ist `/` mit `HTTP 200` erreichbar und zeigt die Platzhalterseite — Beleg: `/tmp/qa_func.py`, Lauf vom 27.08.

#### AC-2 — Profilzeile entsteht ohne weiteren Schritt
- [x] Nach der Registrierung genau eine `profiles`-Zeile zur neuen Nutzer-ID — Beleg: `select count(*) from public.profiles where id='<uid>'` → `1`; Trigger in `supabase/migrations/20260827120000_profiles.sql:54`

#### AC-3 — Passwort unter 10 Zeichen wird abgelehnt
- [x] Feldfehler „Dein Passwort braucht mindestens 10 Zeichen.", kein Konto angelegt (`0` neue Konten) — Beleg: `/tmp/qa_func.py`
- [x] Dritte Prüfung in der Datenbank greift ebenfalls: `GOTRUE_PASSWORD_MIN_LENGTH=10` im Auth-Container — Beleg: `docker exec supabase_auth_… env`
- [x] 9 Zeichen abgelehnt, 10 angenommen — Beleg: `src/lib/validation/auth.test.ts`

#### AC-4 — Ungültiges E-Mail-Format wird abgelehnt
- [x] Feldfehler „Bitte gib eine gültige E-Mail-Adresse ein.", kein Konto — Beleg: `/tmp/qa_func.py`; Schema in `src/lib/validation/auth.ts:24`

#### AC-5 — Adresse bereits vergeben
- [x] Meldung „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", danach weiterhin genau **ein** Konto mit dieser Adresse — Beleg: `/tmp/qa_func.py`

### Anmeldung

#### AC-6 — Anmeldung mit richtigen Daten
- [x] `HTTP 303 → /`, danach zeigt `/konto` die eigene Adresse — Beleg: `/tmp/qa_func.py`

### Schutz vor automatisiertem Erraten

#### AC-7 — Fehlermeldung verrät nicht, ob die Adresse existiert
- [x] **Wortlaut identisch**: unbekannte Adresse und falsches Passwort ergeben beide „E-Mail-Adresse oder Passwort stimmt nicht." — Beleg: `/tmp/qa_brute2.py`, je 10 Messungen
- [ ] **BUG-2 — die Antwortzeit verrät es trotzdem.** Median 153 ms (bekannt) gegen 72 ms (unbekannt), die Wertebereiche überlappen **nicht** (140–174 gegen 58–116 ms). Ein einziger Request genügt zur Unterscheidung. Siehe BUG-2.

#### AC-8 — 5 Fehlversuche je E-Mail-Adresse in 15 Minuten
- [x] 25 falsche Passwörter auf ein Konto: ab Versuch 6 abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." — Beleg: `/tmp/qa_brute2.py`
- [x] Gesperrte Versuche verlängern die Sperre nicht: nach 25 Versuchen stehen genau **5** Zeilen in `login_attempts` — Beleg: dieselbe Messung
- [x] Auch das **richtige** Passwort wird während der Sperre abgelehnt — Beleg: dieselbe Messung
- [ ] **BUG-4 — Versuche mit einem Passwort unter 10 Zeichen werden nicht mitgezählt.** 30 solche Versuche ergaben 0 Zeilen und keine Sperre. Siehe BUG-4.

#### AC-9 — 5 Fehlversuche je IP-Adresse in 15 Minuten
- [x] 15 Anmeldeversuche mit **15 verschiedenen** Adressen von derselben IP: ab der 6. Adresse abgelehnt — Beleg: `/tmp/qa_brute2.py` (Credential-Stuffing-Szenario)
- [x] Die Regel greift unabhängig von der verwendeten Adresse; die IP wird lokal als `::1` erfasst — Beleg: `select email, ip from public.login_attempts`

#### AC-10 — Zugangsdaten erscheinen nie in der URL
- [x] Beide Formulare tragen `method="POST"` (Server Action) — Beleg: HTML von `/login` und `/signup`, `2 Formulare, alle POST`
- [x] Erfolgreiche Anmeldung: `Location: /` — keine Parameter — Beleg: `/tmp/qa_sec3.py`
- [x] Fehlgeschlagene Anmeldung: `HTTP 200` ohne Weiterleitung, Antwort im Body — Beleg: dieselbe Messung

### Zugriffsschutz

#### AC-11 — Abgemeldet führt `/` auf `/login`
- [x] `/` abgemeldet: `HTTP 307 → /login` — Beleg: `/tmp/qa_func.py`
- [x] `/konto` abgemeldet: `HTTP 307 → /login` — Beleg: dieselbe Messung

#### AC-12 — Angemeldet führen `/login` und `/signup` auf `/`
- [x] beide `HTTP 307 → /` — Beleg: `/tmp/qa_func.py`

#### AC-13 — Die Datenbank liefert fremde Daten nicht aus
- [x] A liest `profiles` und bekommt **ausschließlich** die eigene Zeile — Beleg: `/tmp/qa_sec2.py`, REST-Aufruf mit A's Token
- [x] A fragt B gezielt ab (`?id=eq.<B>`) → `[]` — Beleg: dieselbe Messung
- [x] A überschreibt B per `PATCH` → `created_at` von B **unverändert** — Beleg: `/tmp/qa_sec3.py`, Wert vorher/nachher verglichen
- [x] A löscht B per `DELETE` → `HTTP 403`, B's Profil weiterhin vorhanden — Beleg: dieselbe Messung
- [x] Abgemeldet mit dem öffentlichen Schlüssel: `HTTP 401 / 42501 permission denied` auf `profiles` — Beleg: `/tmp/qa_sec2.py`
- [x] `login_attempts` auch **angemeldet** nicht lesbar: `HTTP 403 / 42501` — Beleg: dieselbe Messung
- [x] Fremde Drosselungszähler nicht zurücksetzbar: `clear_own_login_attempts` abgemeldet → `HTTP 401` — Beleg: dieselbe Messung

### Abmelden

#### AC-14 — Abmelden beendet die Sitzung, Zurück-Button stellt nichts wieder her
- [x] Abmelden: `HTTP 303 → /login?reason=signed-out`, danach `/` wieder `HTTP 307 → /login` — Beleg: `/tmp/qa_func.py`
- [x] Die Sitzung ist serverseitig wirklich beendet (nicht nur die Weiterleitung) — Beleg: Folgeanfrage mit demselben Cookie führt auf `/login`
- [ ] **BUG-1 — der Zurück-Button ist nur teilweise abgesichert.** Geschützte Seiten werden mit `cache-control: no-cache, must-revalidate` ausgeliefert, nicht mit `no-store` wie in `design.md` (TD-11) festgelegt. Siehe BUG-1.
- [!] **NICHT VERIFIZIERT:** ob der Browser die Seite tatsächlich aus dem bfcache zurückholt — dafür braucht es einen echten Browser.

### Kontolöschung und Aufbewahrung

#### AC-15 — Konto löschen entfernt alles, erneute Anmeldung schlägt fehl
- [x] Nach dem Aufruf: Konten `0`, Profile `0`, Sitzungen `0`, Drosselungszeilen `0` — Beleg: `/tmp/qa_sec3.py`, vier Zählungen nach `HTTP 204`
- [x] Erneute Anmeldung mit denselben Zugangsdaten schlägt fehl — Beleg: dieselbe Messung
- [x] Abgemeldet lässt sich nichts löschen: `HTTP 401` — Beleg: dieselbe Messung
- [x] Ein Bestätigungsdialog ist vorhanden — Beleg: `src/components/account/delete-account-dialog.tsx:36` (`AlertDialog`)
- [!] **NICHT VERIFIZIERT:** dass der Klick auf „Endgültig löschen" die Aktion auch auslöst. Der Dialoginhalt wird von Radix erst beim Öffnen gerendert und ist ohne Browser nicht erreichbar. Die Funktion dahinter ist vollständig geprüft, die Verdrahtung des Buttons nicht.

#### AC-16 — Drosselungsdaten nach 24 Stunden gelöscht
- [x] Zeile mit Zeitstempel vor 25 Stunden angelegt, `cleanup_login_attempts()` aufgerufen: vorher `1`, nachher `0` — Beleg: `/tmp/qa_sec.py`
- [x] Der stündliche Job läuft auch ohne Verkehr: `cleanup-login-attempts / 0 * * * * / aktiv=t` — Beleg: `select … from cron.job`

---

## Edge Cases

#### EC-1 — Doppelklick auf „Registrieren"
- [x] Der Absende-Button ist während der Übertragung gesperrt — Beleg: `src/components/auth/signup-form.tsx:96` (`disabled={isPending}`)
- [!] **NICHT VERIFIZIERT:** das tatsächliche Klickverhalten. Der Schutz ist reines Browser-Verhalten; ohne JavaScript existiert er nicht. Die Datenintegrität hängt aber nicht daran, sondern an EC-2.

#### EC-2 — Zwei gleichzeitige Registrierungen mit derselben Adresse
- [x] **Garantie in der Datenbank nachgewiesen:** `users_email_partial_key` — `CREATE UNIQUE INDEX … ON auth.users (email) WHERE (is_sso_user = false)`
- [x] **Gegenprobe:** zwei Einfügungen mit derselben Adresse in einer Transaktion → `unique_violation`, die zweite wird abgewiesen — Beleg: `DO`-Block gegen die laufende Datenbank
- [x] Die unterlegene Anfrage erhält die Meldung aus AC-5 — Beleg: `/tmp/qa_func.py`

#### EC-3 — Sitzung läuft ab
- [x] Sitzung serverseitig entzogen, Cookie behalten: `/` → `HTTP 307 → /login?reason=session-expired` — Beleg: `/tmp/qa_ec5b.py`
- [x] Der Grund wird auch angezeigt: Hinweiszeile „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." — Beleg: `src/components/auth/login-notice.test.tsx`
- [x] Keine stumme Fehlermeldung, kein Absturz — Beleg: dieselbe Messung
- [x] Die Grenzen existieren überhaupt: `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=8h0m0s`, `GOTRUE_SESSIONS_TIMEBOX=24h0m0s` — Beleg: `docker exec … env`
- [!] **NICHT VERIFIZIERT:** dass die Sitzung nach echten 8 bzw. 24 Stunden abläuft — dafür müsste der Test so lange laufen. Geprüft ist der gleichwertige Fall (Sitzung entzogen).

#### EC-4 — Datenbank nicht erreichbar
- [x] Supabase gestoppt, Anmeldung versucht: `HTTP 200` mit „Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal." — Beleg: Lauf mit gestopptem Stack
- [x] Keine Absturzseite (kein 5xx) — Beleg: dieselbe Messung
- [x] Passwortfeld nicht vorbelegt — Beleg: HTML enthält kein `type="password" … value="…"`
- [x] Keine Zugangsdaten in der URL — Beleg: `Location` leer
- [x] Die Drosselung fällt dabei **zu**, nicht auf: bei Störung wird nicht durchgewinkt — Beleg: `src/lib/rate-limit.ts:70`

#### EC-5 — Konto in einem anderen Tab gelöscht
- [x] Konto gelöscht, alter Tab ruft `/` auf: `HTTP 307 → /login?reason=session-expired` statt Absturz — Beleg: `/tmp/qa_ec5b.py`
- [x] Auf `/konto` steht die Adresse **nicht** mehr im HTML; die Weiterleitung kommt im Datenstrom — Beleg: dieselbe Messung
- [x] Der Auth-Server weist das Token korrekt ab: `HTTP 403 — User from sub claim in JWT does not exist` — Beleg: direkter Aufruf von `/auth/v1/user`

#### EC-6 — Randleerzeichen im Passwort
- [x] Registrierung und Anmeldung mit `"  mit leerzeichen  "` verhalten sich identisch (beide `HTTP 303`) — Beleg: `/tmp/qa_func.py`
- [x] Ohne die Leerzeichen schlägt die Anmeldung fehl — das Passwort wird also nicht beschnitten — Beleg: dieselbe Messung
- [x] Auch ein Passwort aus 12 Leerzeichen wird nach Länge gezählt — Beleg: `src/lib/validation/auth.test.ts`

---

## Security Audit

- [x] **Authentifizierung:** `/` und `/konto` ohne Sitzung → `HTTP 307 → /login`; Vorprüfung in `src/proxy.ts:83`, echte Prüfung in `src/lib/auth.ts:31` — Beleg: `/tmp/qa_func.py`
- [x] **Autorisierung:** A kann B's Zeile weder lesen noch ändern noch löschen; abgemeldet gar kein Zugriff — Beleg: `/tmp/qa_sec2.py`, `/tmp/qa_sec3.py`; Policies in `supabase/migrations/20260827120000_profiles.sql:24`
- [x] **Eingabeprüfung XSS:** `"><script>alert(1)</script>@example.com` als Adresse abgeschickt — kein unmaskiertes `<script>` im ausgelieferten HTML
- [x] **Eingabeprüfung SQL:** `a@example.com'; drop table public.profiles; --` abgeschickt — `profiles` existiert weiterhin, die Nutzlast wird als Text behandelt
- [x] **Brute Force auf die Anmeldung:** 25 Versuche auf ein Konto → ab dem 6. abgelehnt; 15 Adressen von einer IP → ab der 6. abgelehnt — Beleg: `/tmp/qa_brute2.py`
- [x] **Keine Konto-Enumeration über den Meldungstext:** beide Fälle wortgleich — Beleg: je 10 Messungen
- [ ] **BUG-2 — Konto-Enumeration über die Antwortzeit möglich.** Siehe unten.
- [ ] **BUG-3 — Registrierung ist unbegrenzt automatisierbar.** 35 von 35 über die App, 40 von 40 direkt gegen Supabase. Siehe unten.
- [x] **Zugangsdaten nie in der URL:** beide Formulare POST, keine Parameter in `Location` — Beleg: HTML + `/tmp/qa_sec3.py`
- [x] **Keine Secrets im Client-Bundle:** `service_role`-JWT, `sb_secret`-Schlüssel, `JWT_SECRET` und das Postgres-Passwort ergeben **je 0 Treffer** in `.next/static` — Beleg: `grep -rlF` über das Build-Ergebnis
- [x] **Kein `service_role`-Schlüssel in der Anwendung:** die drei Fundstellen im Quellcode sind Kommentare — Beleg: `grep -rn "service_role" src/ supabase/`
- [x] **Nur zwei Werte erreichen den Browser:** `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Beleg: `grep -rhoE "NEXT_PUBLIC_[A-Z_]+" src/`
- [x] **Keine `.env`-Datei eingecheckt** außer `.env.local.example` — Beleg: `git ls-files | grep '^\.env'`
- [x] **Namen der Datenbankfunktionen erscheinen nicht im Client-Bundle** — Beleg: `grep -rl "login_attempt_gate\|delete_own_account" .next/static` → 0
- [!] **NICHT VERIFIZIERT — Drosselung auf gewöhnlichen Endpunkten:** außer den Auth-Wegen gibt es in PROJ-1 keine, und dort ist sie fürs MVP optional.

---

## Automatisierte Tests

- `npm test`: **21 Tests, 3 Dateien, alle grün**
  - `src/lib/validation/auth.test.ts` (8) und `src/lib/rate-limit.test.ts` (6) — von `/build`
  - `src/components/auth/login-notice.test.tsx` (7) — in diesem Durchlauf ergänzt: Hinweiszeilen für EC-3 und AC-15, Toast beim Abmelden, unbekannte Gründe, Screenreader-Auszeichnung
- **Rot-Nachweis erbracht:** Mit drei absichtlichen Brüchen an `login-notice.tsx` fielen 4 der 7 neuen Tests; nach dem Wiederherstellen wieder alle grün.
- `npm run lint`: grün · `npm run build`: grün · `npx tsc --noEmit`: sauber

## E2E-Tests

- Status: **nicht ausgeführt** (`/e2e-tests` für die kritischen Abläufe)

---

## Nicht verifiziert in diesem Durchlauf

- [!] Darstellung in verschiedenen Browsern (Chrome / Firefox / Safari) — `/qa` läuft ohne Browser
- [!] Responsives Verhalten bei 375 px / 768 px / 1440 px — kein echter Viewport
- [!] Browser-Konsole und Netzwerk-Tab — kein DevTools
- [!] Ob der Browser geschützte Seiten aus dem bfcache zurückholt (gehört zu BUG-1)
- [!] Ob der Klick auf „Endgültig löschen" die Aktion auslöst — der Dialog wird erst per JavaScript gerendert (AC-15)
- [!] Das tatsächliche Doppelklick-Verhalten des Absende-Buttons (EC-1) — nur im Code belegt
- [!] Ablauf der Sitzung nach echten 8 bzw. 24 Stunden (EC-3) — der gleichwertige Fall (Sitzung entzogen) ist geprüft
- [!] Fokusreihenfolge, Tastaturbedienung und Animationen — brauchen einen Browser

---

## Gefundene Fehler

### BUG-1: Geschützte Seiten tragen `no-cache` statt `no-store`
- **Severity:** Medium
- **Betrifft:** AC-14, `design.md` → TD-11
- **Schritte:**
  1. Anmelden, `/konto` aufrufen
  2. Antwortkopf ansehen: `cache-control: no-cache, must-revalidate`
  3. Erwartet laut TD-11: `no-store, must-revalidate`
  4. Tatsächlich: `src/proxy.ts:24` setzt `no-store`, aber Next.js überschreibt den Kopf bei gerenderten Seiten. Nur die **Weiterleitungen** (307) tragen `no-store`.
- **Warum das zählt:** Chrome und Firefox nehmen Seiten mit `no-store` vom bfcache aus. Mit `no-cache` bleibt die Seite bfcache-fähig — der Zurück-Button kann nach dem Abmelden die gerenderte Kontoseite samt E-Mail-Adresse aus dem Speicher zurückholen, ohne den Server zu fragen. Das ist genau das Szenario aus der User Story „an einem geteilten Rechner". Mit PROJ-2 stünden dort Beträge.
- **Kein Zugriff:** Die Sitzung ist tot; jede Aktion führt auf `/login`. Es geht um eine stehengebliebene Ansicht, nicht um Zugang.
- **Richtung für die Behebung:** Den Kopf für `/` und `/konto` in `next.config.ts` → `headers()` setzen, statt sich auf `proxy.ts` zu verlassen.
- **Priorität:** Vor einem öffentlichen Deployment beheben

### BUG-2: Die Antwortzeit verrät, ob eine Adresse registriert ist
- **Severity:** Medium
- **Betrifft:** AC-7 (dem Sinn nach), `design.md` → Abschnitt „Die Meldungen, wortwörtlich"
- **Schritte:**
  1. 14-mal abwechselnd mit einer registrierten und einer unbekannten Adresse anmelden, jeweils falsches Passwort
  2. Antwortzeiten messen
  3. Erwartet: kein verwertbarer Unterschied
  4. Tatsächlich: Median **153 ms** (bekannt) gegen **72 ms** (unbekannt). Die Wertebereiche überlappen **nicht** (140–174 gegen 58–116 ms) — eine einzige Anfrage genügt zur Unterscheidung.
- **Ursache isoliert:** Der Unterschied entsteht in **Supabase Auth selbst**, nicht im App-Code: direkt gegen `/auth/v1/token` gemessen 88 ms gegen 11 ms. Die Annahme in `design.md`, Supabase rechne bei unbekannter Adresse gegen einen Blindwert, trifft für diese Version nicht zu.
- **Einordnung:** Der Wortlaut der Meldung erfüllt AC-7 buchstäblich. Der Zweck des AC — nicht zu verraten, ob eine Adresse existiert — ist über diesen Seitenkanal unterlaufen. `spec.md` nimmt die Enumeration bei der **Registrierung** bereits bewusst in Kauf; hier geht es um die Anmeldung.
- **Priorität:** Vor einem öffentlichen Deployment beheben

### BUG-3: Die Registrierung ist unbegrenzt automatisierbar
- **Severity:** Medium (bei öffentlichem Deployment: High)
- **Betrifft:** `design.md` → „Was Supabase Auth von sich aus tut", `spec.md` → Open Question CAPTCHA
- **Schritte:**
  1. 35 Registrierungen hintereinander über `/signup` von derselben IP
  2. Erwartet laut Design: ab Versuch 31 abgelehnt (30 pro 5 Minuten je IP)
  3. Tatsächlich: **35 von 35 angelegt**, keine einzige Ablehnung
  4. Gegenprobe direkt gegen Supabase Auth: **40 von 40 angelegt**
- **Ursache:** `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` existiert im Auth-Container **gar nicht** — der Wert `sign_in_sign_ups = 30` aus `supabase/config.toml` wird nicht angewendet. Die Schutzschicht, auf die sich das Design für die Registrierung stützt, gibt es in diesem Stack nicht.
- **Einordnung:** Die **Anmeldung** ist davon nicht betroffen — die eigene Drosselung greift unabhängig davon (AC-8, AC-9 bestehen). Die Entscheidung gegen ein CAPTCHA ist in `spec.md` dokumentiert; neu ist, dass auch der angenommene Ersatz fehlt.
- **Priorität:** Vor einem öffentlichen Deployment beheben — für den lokalen Prüfungsbetrieb ohne Folgen

### BUG-4: Zu kurze Passwörter umgehen den Drosselungszähler
- **Severity:** Low
- **Betrifft:** AC-8
- **Schritte:**
  1. 30 Anmeldeversuche auf ein bestehendes Konto mit dem Passwort `kurz`
  2. Erwartet: nach 5 Versuchen gesperrt
  3. Tatsächlich: **0 Zeilen** in `login_attempts`, keine Sperre. Die Schema-Prüfung lehnt vor dem Tor ab (`src/lib/actions/auth.ts:70` prüft, `passLoginGate` folgt erst danach)
  4. Zusätzlich: Die Meldung lautet „Dein Passwort braucht mindestens 10 Zeichen." statt „stimmt nicht" — das Anmeldeformular gibt damit die Passwortregel preis
- **Warum es trotzdem niedrig eingestuft ist:** Ein Passwort unter 10 Zeichen kann kein gültiges Passwort sein, weil die Mindestlänge bei der Registrierung erzwungen wird. Erraten lässt sich damit nichts. Der Zähler ist trotzdem lückenhaft, und die abweichende Meldung ist unnötig.
- **Priorität:** Im nächsten Durchgang

### BUG-5: `src/lib/supabase/client.ts` wird nirgends verwendet
- **Severity:** Low
- **Schritte:** `grep -rn "lib/supabase/client" src/` → kein Treffer
- **Warum es zählt:** Toter Code, der so aussieht, als gehörte er zum Auth-Weg. PROJ-2 wird ihn vermutlich brauchen — bis dahin ist er eine Stolperfalle.
- **Priorität:** Nice to have

### Beobachtung (kein Fehler): `/konto` antwortet mit 200, bevor der Schutz greift
Weil `src/app/konto/loading.tsx` existiert, beginnt Next.js die Antwort sofort mit dem Skeleton. Die
Weiterleitung von `requireUser()` kommt anschließend **im Datenstrom** (`/login?reason=session-expired;307;`).
Es werden dabei keine Daten ausgeliefert — die Adresse steht nicht im HTML. Für automatisierte Prüfungen
heißt das: Auf dieser Route ist der Statuscode allein kein verlässlicher Indikator. Festgehalten, weil es
beim ersten Prüflauf wie ein Sicherheitsleck aussah.

---

## Zusammenfassung

- **Acceptance Criteria:** 16 von 16 geprüft — **14 vollständig bestanden**, 2 mit Einschränkung
  (AC-7 dem Wortlaut nach bestanden, dem Sinn nach durch BUG-2 unterlaufen · AC-14 im Kern bestanden,
  der Zurück-Button-Teil durch BUG-1 nur teilweise abgesichert)
- **Edge Cases:** 6 von 6 geprüft, alle bestanden (EC-1 nur im Code belegt)
- **Gefundene Fehler:** 5 — 0 kritisch, 0 hoch, **3 mittel**, 2 niedrig
- **Security:** 13 Prüfungen verifiziert, 1 nicht verifiziert (Drosselung auf gewöhnlichen Endpunkten —
  in PROJ-1 gibt es keine); 2 der verifizierten Prüfungen sind als BUG-2 und BUG-3 negativ ausgefallen
- **Automatisierte Tests:** 21 grün, Rot-Nachweis erbracht
- **Production Ready:** **JA** — im Sinne der Regel: keine kritischen und keine hohen Fehler

> „Production Ready: JA" heißt *keine kritischen oder hohen Fehler* — es heißt **nicht**, dass alles
> geprüft wurde. Die Liste „Nicht verifiziert in diesem Durchlauf" ist weiterhin offen und braucht
> einen Menschen oder `/e2e-tests`.

**Empfehlung:** Für den lokalen Prüfungsbetrieb ist das Feature fertig. **Vor einem öffentlichen
Deployment** sind BUG-1, BUG-2 und BUG-3 zu beheben — alle drei sind genau dann relevant, wenn die App
von außen erreichbar ist, und alle drei betreffen Annahmen, die das Design getroffen hat und die sich
in der Praxis nicht bestätigt haben.

---

## Nachtrag vom 28.08.2026 — Behebung, und eine Korrektur an diesem Bericht

### BUG-1 war ein Fehlbefund dieses Berichts

Die Messung lief gegen `next dev`. Im **Produktions-Build** tragen `/` und `/konto`
`cache-control: no-store, must-revalidate` — genau den Wert aus `src/proxy.ts`. TD-11 hält, es
gab nichts zu beheben. Der Dev-Server setzt bei gerenderten Seiten seinen eigenen Kopf und
überschreibt dabei auch Regeln aus `next.config.ts` (mit einem Testkopf nachgewiesen: die Regel
greift, der `Cache-Control`-Wert wird trotzdem ersetzt).

**Konsequenz für kommende Durchläufe:** Kopfzeilen und Zwischenspeicher-Verhalten gegen
`next start` messen, nicht gegen `next dev`. Dieser Bericht hat das nicht getan.

### Behobene Fehler

| Fehler | Behebung | Gegenprobe (Produktions-Build) |
|---|---|---|
| BUG-1 | keine — Fehlbefund, siehe oben | `/` und `/konto`: `no-store, must-revalidate` |
| BUG-2 | Fehlschläge brauchen mindestens 350 ms (`MIN_FAILURE_MS`) | 375 ms gegen 374 ms, 0,2 % Unterschied, Bereiche überlappen; langsamste Antwort 417 ms < 500 ms |
| BUG-3 | neue Drosselung `signup_attempt_gate`: 10 Registrierungen je IP in 60 Minuten | 20 Versuche → 10 angelegt, ab Nr. 11 abgewiesen; 10 `signup`-Zeilen gezählt |
| BUG-4 | `loginSchema` prüft keine Passwortlänge mehr | 5 kurze Versuche gezählt, ab dem 6. gesperrt; Meldung jetzt „E-Mail-Adresse oder Passwort stimmt nicht." |
| BUG-5 | `src/lib/supabase/client.ts` entfernt | keine Importe betroffen |

### Regression nach der Behebung

- Anmelde-Drosselung greift weiterhin ab dem 6. Versuch (AC-8)
- Anmeldung mit richtigen Daten: `HTTP 303 → /` (AC-6)
- Zähler nach erfolgreicher Anmeldung zurückgesetzt: 0 Zeilen
- `npm test` 23 grün · `npm run lint` grün · `npm run build` grün · `npx tsc --noEmit` sauber

### Weiterhin offen

- `spec.md` hat kein Acceptance Criterion für die Registrierungs-Drosselung → `/refine PROJ-1`
- `docs/privacy.md` beschreibt nur die Anmelde-Drosselung, nicht die neue Registrierungs-Zählung → `/dsgvo`
- Die Liste „Nicht verifiziert in diesem Durchlauf" bleibt unverändert offen — dieser Nachtrag
  hat nichts davon nachgeholt (kein Browser, keine Viewports, keine Dialog-Verdrahtung)
