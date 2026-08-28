# QA-Testbericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-28 (zweiter Durchlauf, nach `/refine` und der Behebung von BUG-2 bis BUG-5)
**App-Adresse:** `http://localhost:3000` — **Produktions-Build** (`npm run build && npm run start`), Supabase in Docker auf Port 55321
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt nachgewiesen ·
> `[!] NICHT VERIFIZIERT` in diesem Durchlauf nicht prüfbar (mit Grund)

Alle Prüfungen liefen gegen die **laufende App** über echte HTTP-Anfragen. Die Formulare wurden über
die Progressive-Enhancement-Felder der Server Actions abgeschickt, also genau so, wie ein Browser
es tut. Die Prüfskripte liegen im Scratchpad unter `qa/` (`func.py`, `brute.py`, `timing3.py`,
`sec2.py`, `ec.py`, `nullip.py`, `xff.py`).

**Gemessen wurde diesmal gegen `next start`, nicht gegen `next dev`** — das war die ausdrückliche
Lehre aus dem ersten Durchlauf, in dem BUG-1 ein Fehlbefund des Dev-Servers war. Die
Kopfzeilen-Prüfungen unten bestätigen: gegen den Produktions-Build hält TD-11.

---

## Acceptance Criteria

### Registrierung

#### AC-1 — Konto anlegen, sofort angemeldet, landet auf `/`
- [x] Registrierung mit gültiger Adresse und 12-Zeichen-Passwort: `HTTP 303`, `location: /`; danach ist `/` mit `HTTP 200` erreichbar und zeigt die Platzhalterseite („Hier entstehen deine Ausgaben.") — Beleg: `qa/func.py`
- [x] Die Sitzung entsteht dabei wirklich: `sb-…-auth-token`-Cookie gesetzt — Beleg: derselbe Lauf

#### AC-2 — Profilzeile entsteht ohne weiteren Schritt
- [x] Nach der Registrierung genau **eine** `profiles`-Zeile zur neuen Nutzer-ID — Beleg: `select count(*) from public.profiles where id='36898895-…'` → `1`
- [x] Der Trigger ist die Quelle, nicht der Anwendungscode: `on_auth_user_created` auf `auth.users` — Beleg: `supabase/migrations/20260827120000_profiles.sql:60`

#### AC-3 — Passwort unter 10 Zeichen wird abgelehnt
- [x] Feldfehler „Dein Passwort braucht mindestens 10 Zeichen.", **0** Konten angelegt — Beleg: `qa/func.py`
- [x] Die dritte Prüfung in der Datenbank greift ebenfalls: `GOTRUE_PASSWORD_MIN_LENGTH=10` im Auth-Container — Beleg: `docker exec supabase_auth_… env`
- [x] 9 Zeichen abgelehnt, 10 angenommen — Beleg: `src/lib/validation/auth.test.ts`

#### AC-4 — Ungültiges E-Mail-Format wird abgelehnt
- [x] Feldfehler „Bitte gib eine gültige E-Mail-Adresse ein.", **0** Konten — Beleg: `qa/func.py`; Schema in `src/lib/validation/auth.ts:23`

#### AC-5 — Adresse bereits vergeben
- [x] Meldung „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", danach weiterhin genau **ein** Konto mit dieser Adresse — Beleg: `qa/func.py`

### Anmeldung

#### AC-6 — Anmeldung mit richtigen Daten
- [x] `HTTP 303`, `location: /`; danach zeigt `/konto` die eigene Adresse — Beleg: `qa/func.py`

### Schutz vor automatisiertem Erraten

#### AC-7 — Fehlermeldung verrät nicht, ob die Adresse existiert
- [x] **Wortlaut identisch**: unbekannte Adresse und falsches Passwort ergeben beide „E-Mail-Adresse oder Passwort stimmt nicht." — Beleg: `qa/brute.py`
- [x] Auch ein zu kurzes Passwort ergibt jetzt denselben Satz, statt die Passwortregel zu nennen — Beleg: `qa/brute.py`, EC-7-Block

#### AC-8 — 5 Fehlversuche je E-Mail-Adresse in 15 Minuten
- [x] 8 falsche Passwörter auf ein Konto: Versuche 1–5 „stimmt nicht", **ab Versuch 6** „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." — Beleg: `qa/brute.py`
- [x] Hämmern verlängert die Sperre nicht: nach 8 Versuchen stehen genau **5** Zeilen in `login_attempts` — Beleg: derselbe Lauf
- [x] Auch das **richtige** Passwort wird während der Sperre abgelehnt — Beleg: derselbe Lauf
- [x] Die Regel greift **unabhängig von der IP**: 14 Versuche auf ein Konto mit je anderer vorgeblicher IP → 9 davon abgewiesen — Beleg: `qa/timing3.py`

#### AC-9 — 5 Fehlversuche je IP-Adresse in 15 Minuten
- [x] Wie spezifiziert erfüllt: 7 Anmeldeversuche mit **7 verschiedenen** Adressen von derselben IP → ab der 6. abgewiesen, 5 Zeilen zu dieser IP — Beleg: `qa/brute.py` (Credential-Stuffing-Szenario)
- [ ] **BUG-1 — die Regel lässt sich vom Aufrufer abschalten.** Wer den `X-Forwarded-For`-Kopf selbst setzt, bestimmt den Schlüssel, nach dem gezählt wird. 14 von 14 Versuchen kamen durch. Siehe BUG-1.

#### AC-10 — Zugangsdaten erscheinen nie in der URL
- [x] Beide Formulare tragen `method="POST"` und `action=""` (Server Action, kein natives GET) — Beleg: HTML von `/login` und `/signup`
- [x] Erfolgreiche Anmeldung: `location: /` — keine Parameter — Beleg: `qa/func.py`
- [x] Fehlgeschlagene Anmeldung: `HTTP 200` ohne Weiterleitung, Antwort im Body — Beleg: derselbe Lauf
- [x] Das Passwort steht nach einem Fehler **nicht** im ausgelieferten HTML; das Passwortfeld trägt kein `value` — Beleg: Antwort-HTML nach Fehlanmeldung mit `GEHEIM-nicht-echt`

#### AC-17 — 10 Registrierungen je IP-Adresse in 60 Minuten
- [x] Wie spezifiziert erfüllt: 13 Registrierungen von einer IP → **10 angelegt**, ab Nr. 11 „Von dieser Verbindung wurden gerade viele Konten angelegt. Bitte versuche es in 60 Minuten erneut."; 10 `signup`-Zeilen zu dieser IP — Beleg: `qa/brute.py`
- [x] Die Sperre greift auch ohne gesetzten Kopf: 30 Registrierungen über die App liefen nach genau 10 auf (lokal ist die IP `::1`) — Beleg: `qa/timing2.py`
- [ ] **BUG-1 — auch hier abschaltbar.** 16 von 16 Konten angelegt, wenn je Anfrage eine andere IP behauptet wird. Siehe BUG-1.
- [ ] **BUG-4 — gezählt werden Versuche, nicht angelegte Konten.** Nach 10 gescheiterten Registrierungen (Adresse schon vergeben, **0** Konten entstanden) wird der nächste, echte Erstversuch derselben IP abgewiesen. Siehe BUG-4.

#### AC-18 — Antwortzeit verrät nicht, ob eine Adresse registriert ist
- [x] **Mediane praktisch deckungsgleich:** 364,5 ms (registriert) gegen 364,4 ms (unbekannt) — Unterschied **0,03 %**, Vorgabe < 10 % — Beleg: `qa/timing3.py`, je n=26, rotierende IP und frisches Konto je Messung, damit keine Drosselung hineinspielt
- [x] **Wertebereiche überlappen vollständig:** 358–476 ms gegen 358–560 ms — eine einzelne Anfrage trägt keine Information mehr — Beleg: derselbe Lauf
- [x] Die Untergrenze wirkt: keine Antwort schneller als 358 ms (`MIN_FAILURE_MS = 350`, `src/lib/actions/auth.ts:53`)
- [x] Damit ist BUG-2 des ersten Durchlaufs (153 gegen 72 ms, Bereiche getrennt) tatsächlich geschlossen — unabhängig nachgemessen, nicht aus dem Nachtrag übernommen
- [ ] **BUG-3 — die Zusage „unter 500 ms je Antwort" hält nicht durchgängig.** 2 von 52 Antworten lagen darüber (509 und 560 ms). Siehe BUG-3.

### Zugriffsschutz

#### AC-11 — Abgemeldet führt `/` auf `/login`
- [x] `/` abgemeldet: `HTTP 307 → /login`; `/konto` abgemeldet: `HTTP 307 → /login` — Beleg: `qa/func.py`
- [x] Auch bei nicht erreichbarer Datenbank wird nicht durchgewunken: `HTTP 307 → /login` — Beleg: `qa/ec.py`, Lauf mit gestopptem Kong

#### AC-12 — Angemeldet führen `/login` und `/signup` auf `/`
- [x] beide `HTTP 307 → /` — Beleg: `qa/func.py`

#### AC-13 — Die Datenbank liefert fremde Daten nicht aus
- [x] A liest `profiles` und bekommt **ausschließlich** die eigene Zeile (1 Zeile, ID = A) — Beleg: `qa/sec2.py`, REST-Aufruf mit A's Token
- [x] A fragt B gezielt ab (`?id=eq.<B>`) → `[]` — Beleg: derselbe Lauf
- [x] A überschreibt B per `PATCH` → `HTTP 204`, aber B's `created_at` **unverändert** (0 Zeilen betroffen) — Beleg: Wert vorher/nachher verglichen
- [x] A löscht B per `DELETE` → `HTTP 403`, B's Profil weiterhin vorhanden — Beleg: derselbe Lauf
- [x] Abgemeldet mit dem öffentlichen Schlüssel: `HTTP 401 / 42501` auf `profiles` — Beleg: derselbe Lauf
- [x] `login_attempts` auch **angemeldet** nicht lesbar: `HTTP 403 / 42501`; abgemeldet `HTTP 401` — Beleg: derselbe Lauf
- [x] RLS ist an und es gibt **keine einzige Policy** auf `login_attempts` — Beleg: `\d public.login_attempts` → „Policies (row security enabled): (none)"
- [x] `cleanup_login_attempts()` ist für Clients gesperrt (`HTTP 403`), `clear_own_login_attempts` abgemeldet `HTTP 401` — Beleg: derselbe Lauf

### Abmelden

#### AC-14 — Abmelden beendet die Sitzung, Zurück-Button stellt nichts wieder her
- [x] Abmelden über das Formular auf `/konto`: `HTTP 303 → /login?reason=signed-out` — Beleg: `qa/logout.py`
- [x] **Die Sitzung ist serverseitig wirklich weg:** `auth.sessions` zu diesem Konto vorher `1`, nachher `0` — Beleg: derselbe Lauf
- [x] Danach `/` und `/konto` wieder `HTTP 307 → /login` — Beleg: derselbe Lauf
- [x] **`Cache-Control: no-store, must-revalidate`** auf `/`, `/konto`, `/login`, `/signup` und auf den Weiterleitungen — im **Produktions-Build** gemessen — Beleg: `curl -I` gegen `next start`. TD-11 hält; der gegenteilige Befund des ersten Durchlaufs war ein Artefakt von `next dev`
- [!] **NICHT VERIFIZIERT:** ob der Browser die Seite tatsächlich nicht aus dem bfcache zurückholt — dafür braucht es einen echten Browser. Die Voraussetzung (`no-store`) ist erfüllt.

### Kontolöschung und Aufbewahrung

#### AC-15 — Konto löschen entfernt alles, erneute Anmeldung schlägt fehl
- [x] Nach `delete_own_account` als B: Konten `0`, Profile `0`, Sitzungen `0` (vorher 1/1/2), Drosselungszeilen `0` (vorher 2) — Beleg: `qa/sec2.py`
- [x] **Konto A bleibt unversehrt** (users 1, profiles 1) — die Löschung trifft nur die aufrufende Person — Beleg: derselbe Lauf
- [x] Erneute Anmeldung mit denselben Zugangsdaten schlägt fehl — Beleg: derselbe Lauf
- [x] Abgemeldet lässt sich nichts löschen: `HTTP 401 / 42501` — Beleg: derselbe Lauf
- [x] Ein untergeschobenes Argument greift nicht: `delete_own_account` mit `p_uid=<B>` → `HTTP 404 PGRST202` (die Funktion nimmt kein Argument), B existiert weiter — Beleg: derselbe Lauf
- [x] Ein Bestätigungsdialog ist vorhanden und der Auslöser steht im HTML — Beleg: `src/components/account/delete-account-dialog.tsx:37`; „Konto löschen" im ausgelieferten HTML von `/konto`
- [x] Die Verdrahtung im Code stimmt: der Absende-Button liegt **innerhalb** `<form action={formAction}>` — Beleg: `delete-account-dialog.tsx:64-72`
- [!] **NICHT VERIFIZIERT:** dass der Klick auf „Endgültig löschen" die Aktion auch auslöst. Der Dialoginhalt wird von Radix erst beim Öffnen gerendert und steht ohne Browser nicht im HTML (nachgesehen: „Endgültig löschen" fehlt im ausgelieferten Markup). Die Funktion dahinter ist vollständig geprüft.

#### AC-16 — Drosselungsdaten nach 24 Stunden gelöscht
- [x] Drei Zeilen angelegt (eine `login` und eine `signup` je 25 Stunden alt, eine frisch), `cleanup_login_attempts()` aufgerufen: **2 gelöscht**, die frische bleibt — Beleg: `qa/ec.py`
- [x] **Beide Arten** werden erfasst, auch die neuen `signup`-Zeilen — Beleg: derselbe Lauf
- [x] Der stündliche Job läuft auch ohne Verkehr: `cleanup-login-attempts | 0 * * * * | aktiv=true` — Beleg: `select … from cron.job`
- [x] Zweiter Weg zusätzlich zum Job: jede Torprüfung räumt selbst auf — Beleg: `perform public.cleanup_login_attempts()` in `20260828100000_signup_throttle.sql:47` und `:97`

---

## Edge Cases

#### EC-1 — Doppelklick auf „Registrieren"
- [x] Der Absende-Button ist während der Übertragung gesperrt — Beleg: `src/components/auth/signup-form.tsx:96` (`disabled={isPending}`)
- [x] Die Datenintegrität hängt nicht daran, sondern an EC-2 (Eindeutigkeit in der Datenbank)
- [!] **NICHT VERIFIZIERT:** das tatsächliche Klickverhalten — reines Browser-Verhalten, ohne JavaScript existiert der Schutz nicht.

#### EC-2 — Zwei gleichzeitige Registrierungen mit derselben Adresse
- [x] **Garantie in der Datenbank nachgewiesen:** `CREATE UNIQUE INDEX users_email_partial_key ON auth.users (email) WHERE (is_sso_user = false)` — Beleg: `pg_indexes`
- [x] **Gegenprobe:** zwei Einfügungen mit derselben Adresse in einem `DO`-Block → `ERGEBNIS: ZWEITE ABGEWIESEN (unique_violation)` — Beleg: `qa/ec.py`
- [x] Die unterlegene Anfrage erhält die Meldung aus AC-5 — Beleg: `qa/func.py`

#### EC-3 — Sitzung läuft ab
- [x] Sitzung serverseitig entzogen, Cookie behalten: `/` → `HTTP 307 → /login?reason=session-expired` — Beleg: `qa/ec.py`
- [x] Der Grund wird auch angezeigt: „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." steht im HTML von `/login?reason=session-expired` — Beleg: derselbe Lauf
- [x] `?reason=deleted` zeigt „Dein Konto ist gelöscht. Alles Gute!"; unbekannte und `signed-out`-Gründe zeigen keine Zeile — Beleg: derselbe Lauf
- [x] Die Grenzen existieren überhaupt: `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=8h0m0s`, `GOTRUE_SESSIONS_TIMEBOX=24h0m0s` — Beleg: `docker exec … env`
- [!] **NICHT VERIFIZIERT:** dass die Sitzung nach echten 8 bzw. 24 Stunden abläuft — der Test müsste so lange laufen. Geprüft ist der gleichwertige Fall (Sitzung entzogen).

#### EC-4 — Datenbank nicht erreichbar
- [x] Kong angehalten, Anmeldung versucht: `HTTP 200` mit „Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal." — Beleg: Lauf mit gestopptem `supabase_kong_…`
- [x] Keine Absturzseite (kein 5xx) — Beleg: derselbe Lauf
- [x] Passwortfeld nicht vorbelegt (`value`-Attribut fehlt), Passwort nicht im HTML — Beleg: derselbe Lauf
- [x] Keine Zugangsdaten in der URL (`location` leer) — Beleg: derselbe Lauf
- [x] **Die Drosselung fällt dabei ZU, nicht auf:** bei Störung wird nicht durchgewunken — Beleg: derselbe Lauf, dazu die neuen Unit-Tests „fällt bei einem Datenbankfehler ZU, nicht auf"
- [x] Auch ein unbrauchbarer IP-Wert im Kopf führt zum Zufallen, nicht zum Durchwinken — Beleg: `qa/xff.py`

#### EC-5 — Konto in einem anderen Tab gelöscht
- [x] Konto in Sitzung 1 gelöscht, Sitzung 2 ruft `/` auf: `HTTP 307 → /login?reason=session-expired` statt Absturz — Beleg: `qa/sec2.py`
- [x] Auf `/konto` steht die Adresse **nicht** mehr im HTML — Beleg: derselbe Lauf
- [x] Der Grund dafür ist die echte Prüfung beim Auth-Server statt nur im Cookie — Beleg: `src/lib/auth.ts:18` (`getUser()`)

#### EC-6 — Randleerzeichen im Passwort
- [x] Registrierung mit `"  mit leerzeichen  "` → `HTTP 303`; Anmeldung mit demselben Wert → `HTTP 303` — Beleg: `qa/ec.py`
- [x] Ohne die Leerzeichen schlägt die Anmeldung fehl — das Passwort wird also in **beiden** Wegen identisch behandelt, nicht beschnitten — Beleg: derselbe Lauf
- [x] Auch ein Passwort aus 12 Leerzeichen wird nach Länge angenommen — Beleg: derselbe Lauf und `src/lib/validation/auth.test.ts`

#### EC-7 — Kurze Passwörter bei der Anmeldung
- [x] 7 Anmeldeversuche mit dem 4-Zeichen-Passwort `kurz`: Versuche 1–5 „E-Mail-Adresse oder Passwort stimmt nicht.", **ab Versuch 6 gesperrt** — Beleg: `qa/brute.py`
- [x] **5 Zeilen gezählt** — die Versuche laufen nicht mehr an der Drosselung vorbei (im ersten Durchlauf: 0 Zeilen) — Beleg: derselbe Lauf
- [x] Die Meldung nennt die Passwortregel **nicht** mehr — Beleg: derselbe Lauf; `loginSchema` ohne Mindestlänge in `src/lib/validation/auth.ts:53`

---

## Security Audit

- [x] **Authentifizierung:** `/` und `/konto` ohne Sitzung → `HTTP 307 → /login`; Vorprüfung in `src/proxy.ts:86`, echte Prüfung in `src/lib/auth.ts:30` — Beleg: `qa/func.py`
- [x] **Autorisierung:** A kann B's Zeile weder lesen noch ändern noch löschen; abgemeldet gar kein Zugriff; `login_attempts` für niemanden erreichbar — Beleg: `qa/sec2.py`; Policies in `supabase/migrations/20260827120000_profiles.sql:23`
- [x] **Kein Privilegien-Aufstieg über die Datenbankfunktionen:** `delete_own_account` nimmt kein fälschbares Argument, `clear_own_login_attempts` liest die Adresse aus `auth.uid()` — Beleg: `qa/sec2.py` und `20260828100000_signup_throttle.sql:137`
- [x] **Eingabeprüfung XSS:** `"><script>alert(1)</script>@example.com` abgeschickt — kein unmaskiertes `<script>` in der Antwort, Adresse als ungültig abgewiesen — Beleg: `qa/sec.py`
- [x] **Eingabeprüfung SQL:** `a@example.com'; drop table public.profiles; --` abgeschickt — `profiles` existiert weiterhin, die Nutzlast wird als Text behandelt — Beleg: derselbe Lauf
- [x] **Brute Force auf ein einzelnes Konto:** ab dem 6. Fehlversuch gesperrt, auch bei wechselnder IP — Beleg: `qa/brute.py`, `qa/timing3.py`
- [x] **Keine Konto-Enumeration über den Meldungstext** — Beleg: `qa/brute.py`
- [x] **Keine Konto-Enumeration über die Antwortzeit** (0,03 % Median-Unterschied, überlappende Bereiche) — Beleg: `qa/timing3.py`
- [ ] **BUG-1 — die IP-gestützten Drosselungen sind vom Aufrufer abschaltbar.** Credential Stuffing und Massen-Registrierung damit unbegrenzt. Siehe unten.
- [x] **Keine Secrets im Client-Bundle:** `service_role`-JWT, `sb_secret`, `JWT_SECRET`, `postgresql://` ergeben **je 0 Treffer** in `.next/static` — Beleg: `grep -rlF` über das Build-Ergebnis
- [x] **Kein `service_role`-Schlüssel in der Anwendung:** die drei Fundstellen im Quellcode sind Kommentare — Beleg: `grep -rn "service_role" src/ supabase/`
- [x] **Nur zwei Werte erreichen den Browser:** `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Beleg: `grep -rhoE "NEXT_PUBLIC_[A-Z_]+" src/`
- [x] **Keine `.env`-Datei eingecheckt** außer `.env.local.example` — Beleg: `git ls-files | grep '^\.env'`
- [x] **Namen der Datenbankfunktionen erscheinen nicht im Client-Bundle** (je 0 Treffer) — Beleg: `grep -rlF … .next/static`
- [x] **Keine sensiblen Felder in Antworten:** `/konto` enthält weder Passwort noch Token noch die eigene Nutzer-ID — Beleg: `qa/sec.py`
- [x] **Zugangsdaten nie in der URL:** beide Formulare POST, keine Parameter in `location`, Passwort nie im HTML — Beleg: `qa/func.py`
- [x] **Security-Header vollständig** auf `/`, `/login`, `/signup`, `/konto`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` — Beleg: `curl -I` gegen den Produktions-Build
- [x] **Die Plattform bietet keinen Boden:** `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` ist im Auth-Container **nicht gesetzt** — `sign_in_sign_ups = 30` aus `config.toml` wird nicht angewendet. Damit ist die eigene Drosselung die einzige Schutzschicht, und BUG-1 wiegt entsprechend schwerer — Beleg: `docker exec supabase_auth_… env | grep RATE_LIMIT`
- [!] **NICHT VERIFIZIERT — Drosselung auf gewöhnlichen Endpunkten:** außer den Auth-Wegen gibt es in PROJ-1 keine, und dort ist sie fürs MVP optional.

### `[user]`-Aufgaben
- [x] `tasks.md` führt **keine** `[user]`-Aufgaben („Keine `[user]`-Aufgaben", Zeile 13). Alle Auth-Einstellungen liegen als `supabase/config.toml` im Repo und sind über den Auth-Container nachgeprüft (Mindestlänge, Sitzungsgrenzen). Es steht also keine offene Schutzmaßnahme auf einem Zugangsdaten-Pfad aus.

---

## Regression

- [x] `features/INDEX.md` führt **kein** Feature mit Status *Deployed* — PROJ-2 und PROJ-3 stehen auf *Roadmap*. Es gibt damit keine Nachbar-Features, die dieser Bau brechen könnte.
- [x] Nach dem EC-4-Test (Kong gestoppt und wieder gestartet) laufen Registrierung, Anmeldung und `/konto` unverändert — Beleg: Sanity-Lauf nach dem Neustart
- [x] Die im ersten Durchlauf behobenen Befunde sind unabhängig nachgemessen und halten: BUG-2 (Antwortzeit) → AC-18, BUG-3 (Registrierungs-Drosselung) → AC-17, BUG-4 (kurze Passwörter) → EC-7, BUG-5 (`src/lib/supabase/client.ts`) → Datei existiert nicht mehr, `git ls-files` bestätigt

---

## Automatisierte Tests

- `npm test`: **32 Tests, 3 Dateien, alle grün** (vorher 23)
  - `src/lib/validation/auth.test.ts` (11) und `src/components/auth/login-notice.test.tsx` (7) — unverändert
  - `src/lib/rate-limit.test.ts` (14) — **9 in diesem Durchlauf ergänzt**: die beiden Tore selbst waren bisher gar nicht getestet. Abgedeckt sind jetzt Durchlassen, Sperren samt Minutenrechnung, das Weiterreichen von Adresse und IP, der Aufruf des jeweils **richtigen** Tors, die Antwort als Liste wie als Einzelobjekt — und vor allem, dass die Drosselung bei einem Datenbankfehler **zufällt statt aufzugehen** (die Garantie, auf der EC-4 steht)
- **Rot-Nachweis erbracht** (drei Brüche, je zurückgenommen):
  - `unavailable` → `allowed` bei Datenbankfehler: **2 Tests rot**
  - `Math.ceil` → `Math.floor` in der Minutenrechnung: **2 Tests rot**
  - `signup_attempt_gate` → `login_attempt_gate` im Registrierungs-Tor: **1 Test rot**
  - danach wieder 32 grün, `git diff` auf `src/lib/rate-limit.ts` leer
- `npm run lint`: grün · `npm run build`: grün · `npx tsc --noEmit`: sauber

## E2E-Tests

- Status: **nicht ausgeführt** (`/e2e-tests` für die kritischen Abläufe)

---

## Nicht verifiziert in diesem Durchlauf

- [!] Darstellung in verschiedenen Browsern (Chrome / Firefox / Safari) — `/qa` läuft ohne Browser
- [!] Responsives Verhalten bei 375 px / 768 px / 1440 px — kein echter Viewport
- [!] Browser-Konsole und Netzwerk-Tab — kein DevTools
- [!] Ob der Browser geschützte Seiten aus dem bfcache zurückholt (AC-14) — die Voraussetzung `no-store` ist erfüllt, das Browser-Verhalten selbst nicht beobachtbar
- [!] Ob der Klick auf „Endgültig löschen" die Aktion auslöst (AC-15) — der Dialog wird erst per JavaScript gerendert; Code-Verdrahtung geprüft, Klick nicht
- [!] Das tatsächliche Doppelklick-Verhalten des Absende-Buttons (EC-1) — nur im Code belegt
- [!] Ablauf der Sitzung nach echten 8 bzw. 24 Stunden (EC-3) — der gleichwertige Fall (Sitzung entzogen) ist geprüft
- [!] Fokusreihenfolge, Tastaturbedienung, Screenreader-Ausgabe und Animationen — brauchen einen Browser
- [!] Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine

---

## Gefundene Fehler

### BUG-1: Die IP-Drosselungen lassen sich mit einem selbst gesetzten Kopf abschalten
- **Severity:** High
- **Betrifft:** AC-9, AC-17 · `src/lib/rate-limit.ts:28-36` (`clientIpFrom`)
- **Schritte (Variante A — rotierende IP):**
  1. 14 Anmeldeversuche mit je einer anderen E-Mail-Adresse, jede Anfrage mit einem anderen `X-Forwarded-For`
  2. Erwartet laut AC-9: ab dem 6. Versuch abgewiesen
  3. Tatsächlich: **14 von 14 durchgelassen**
  4. Dasselbe bei der Registrierung: **16 von 16 Konten angelegt** (AC-17 erwartet 10)
- **Schritte (Variante B — leerer erster Eintrag, noch einfacher):**
  1. Alle Anfragen mit dem **immer gleichen** Kopf `X-Forwarded-For: ,1.2.3.4` schicken
  2. `clientIpFrom` nimmt den ersten Eintrag, der ist leer, die Funktion fällt auf `x-real-ip` zurück und liefert `null`
  3. Mit `p_ip = null` überspringt `signup_attempt_gate` die Prüfung ganz (`20260828100000_signup_throttle.sql:100`), und `login_attempt_gate` wertet die IP-Regel nicht aus
  4. Tatsächlich: **14 von 14 Anmeldeversuchen durch, 14 von 14 Konten angelegt**, alle Zeilen mit `ip IS NULL`
  5. Belegt: gespeicherte IP bei `,1.2.3.4`, ` ,1.2.3.4`, `,` und `"  "` jeweils `(NULL)`
- **Ursache:** Die IP kommt aus einem Kopf, den der Aufrufer selbst schreibt, und es gibt kein Modell davon, welchem vorgelagerten Server zu trauen ist. `x-forwarded-for` wird von Proxys **angehängt**, der erste Eintrag ist deshalb im Regelfall der vom Client behauptete Wert — genau der, den der Code nimmt.
- **Warum das zählt:** AC-8 (je E-Mail-Adresse) hält weiterhin und begrenzt den gezielten Angriff auf **ein** Konto. Unbegrenzt sind die beiden anderen Szenarien, die `spec.md` ausdrücklich abdecken wollte: Credential Stuffing über viele Konten (AC-9) und massenhaftes Anlegen von Konten (AC-17). Erschwerend: Supabase' eigenes Limit, auf das sich das Design ursprünglich stützte, ist in diesem Stack **nicht gesetzt** — hinter der eigenen Drosselung liegt nichts.
- **Was es nicht ist:** kein Zugriff auf fremde Daten, keine Umgehung von RLS, kein Weg zu einem konkreten Konto. Die Drosselung fällt bei unbrauchbaren Werten korrekt **zu**, nicht auf.
- **Heutige Tragweite:** Die App ist nur lokal erreichbar; Deployment ist laut `docs/PRD.md` nicht Teil der Prüfung. Praktisch ausnutzbar ist das erst, wenn die App von außen erreichbar wird.
- **Richtung für die Behebung:** Nicht den ersten, sondern den vom vertrauenswürdigen Proxy gesetzten Eintrag verwenden (bei Vercel `x-vercel-forwarded-for`, sonst der **letzte** Eintrag bzw. der n-t-letzte bei bekannter Proxy-Tiefe) und einen leeren oder unbrauchbaren Wert nicht in „keine IP" übersetzen, sondern in „nicht vertrauenswürdig" — mit derselben Konsequenz wie eine Sperre.
- **Priorität:** Vor jedem öffentlichen Zugang zwingend. Für den lokalen Prüfungsbetrieb ohne Folgen.

### BUG-2: Auf dem Registrierungsformular steht „Die Anmeldung ist gerade nicht möglich"
- **Severity:** Low
- **Betrifft:** EC-4 · `src/lib/actions/auth.ts:37` (`UNAVAILABLE`), verwendet in `:153`
- **Schritte:** Datenbank anhalten, auf `/signup` ein Konto anlegen wollen → „Die **Anmeldung** ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal."
- **Warum es zählt:** Die Konstante ist zwischen Anmeldung und Registrierung geteilt. Wer gerade ein Konto anlegen will, liest von einer Anmeldung, die er nicht versucht hat. Rein sprachlich, kein Sicherheits- oder Datenproblem.
- **Priorität:** Nice to have

### BUG-3: Die Zusage „unter 500 ms je Antwort" hält nicht durchgängig
- **Severity:** Low
- **Betrifft:** AC-18, `spec.md` → Technical Requirements
- **Schritte:**
  1. 52 fehlgeschlagene Anmeldungen messen (26 registriert, 26 unbekannt), ohne Drosselungseinfluss
  2. Erwartet: jede Antwort unter 500 ms
  3. Tatsächlich: Median 364 ms, p90 ≈ 470 ms — aber **2 Antworten über 500 ms** (509 und 560 ms). In einem früheren Lauf mit mehr Hintergrundlast waren es 8 von 32, bis 1192 ms
- **Ursache:** `MIN_FAILURE_MS = 350` verbraucht 70 % des 500-ms-Budgets. Was an echter Arbeit (zwei Datenbankabfragen plus der Auth-Aufruf) darüber hinausgeht, schlägt direkt auf die Obergrenze durch. Der systematische Teil ist in Ordnung; die Ausreißer sind es nicht.
- **Einordnung:** Gemessen auf einem Entwicklungsrechner mit laufendem Docker und einem zweiten Supabase-Stack. Auf ruhigerer Hardware dürfte es seltener auftreten — die Reserve zwischen 350 und 500 ms ist aber konstruktiv knapp.
- **Priorität:** Im nächsten Durchgang bewerten — entweder die Untergrenze senken (z. B. 250 ms, solange die Bereiche noch überlappen) oder die Obergrenze in `spec.md` realistisch fassen.

### BUG-4: Die Registrierungssperre zählt Versuche, nicht angelegte Konten
- **Severity:** Low
- **Betrifft:** AC-17 · `src/lib/actions/auth.ts:143` (Tor vor dem Anlegen), `20260828100000_signup_throttle.sql:123`
- **Schritte:**
  1. Von einer IP 10-mal eine Registrierung mit einer **bereits vergebenen** Adresse abschicken — jede scheitert, **0** Konten entstehen
  2. Danach von derselben IP einen echten Erstversuch mit neuer Adresse
  3. Erwartet laut AC-17 („bereits 10 Konten angelegt"): geht durch
  4. Tatsächlich: abgewiesen mit „Von dieser Verbindung wurden gerade viele Konten angelegt." — obwohl von dieser IP kein einziges Konto angelegt wurde
- **Warum es zählt:** Zweierlei. Erstens weicht das Verhalten vom Wortlaut des AC ab. Zweitens kann sich ein Büro hinter einer gemeinsamen IP mit zehn Tippfehlern für eine Stunde selbst aussperren, und die Meldung nennt dafür einen Grund, der nicht stimmt.
- **Gegenrichtung:** Nur Erfolge zu zählen wäre schwächer — dann kostet ein Versuch nichts. Vertretbar wäre, weiter Versuche zu zählen und entweder den Wortlaut von AC-17 anzugleichen oder gescheiterte Versuche milder zu gewichten.
- **Priorität:** Im nächsten Durchgang — zusammen mit `/refine PROJ-1`, weil es auch den Text des AC betrifft

---

## Zusammenfassung

- **Acceptance Criteria:** 18 von 18 geprüft — **15 vollständig bestanden**, 3 mit Einschränkung:
  - **AC-9** und **AC-17** erfüllen ihren Wortlaut, sind aber durch BUG-1 vom Aufrufer abschaltbar
  - **AC-18** besteht in seinem Kern (Mediane 0,03 % auseinander, Bereiche überlappen), verfehlt aber die 500-ms-Zusage in Ausreißern (BUG-3)
- **Edge Cases:** 7 von 7 geprüft, alle bestanden (EC-1 nur im Code belegt)
- **Gefundene Fehler:** 4 — 0 kritisch, **1 hoch**, 0 mittel, 3 niedrig
- **Security:** **17 Prüfungen verifiziert, 1 nicht verifiziert** (Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine); eine der verifizierten Prüfungen ist als BUG-1 negativ ausgefallen
- **Automatisierte Tests:** 32 grün (9 neu), Rot-Nachweis erbracht; lint, build und tsc sauber
- **Production Ready:** **NEIN** — BUG-1 ist ein High-Befund und muss vor der Freigabe behoben werden

> „Production Ready: NEIN" heißt hier: **ein** hoher Befund steht offen. Der Rest des Features ist in
> gutem Zustand — die drei Befunde des ersten Durchlaufs, die tatsächlich Fehler waren, sind
> unabhängig nachgemessen und geschlossen, und die Liste „Nicht verifiziert" enthält nichts, was ohne
> Browser prüfbar gewesen wäre.

**Empfehlung:** BUG-1 zuerst — es ist der einzige Befund, der eine Zusage der Spec praktisch
aufhebt, und die Behebung betrifft eine einzige Funktion (`clientIpFrom`). BUG-4 danach, weil es
zusammen mit einem `/refine` am Wortlaut von AC-17 gelöst werden sollte. BUG-2 und BUG-3 sind
Feinschliff.

**Weiterhin offen (aus dem ersten Durchlauf, unverändert):**
- `docs/privacy.md` beschreibt nur die Anmelde-Drosselung, nicht die Registrierungs-Zählung → `/dsgvo PROJ-1`
- CAPTCHA auf der Registrierung bleibt zurückgestellt — BUG-1 zeigt, dass die IP-Grenze allein diese
  Lücke nicht schließt
