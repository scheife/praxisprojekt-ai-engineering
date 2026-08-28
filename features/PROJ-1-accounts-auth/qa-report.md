# QA-Bericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-28 (sechster Durchlauf, nach der Behebung von BUG-1 aus Lauf 5)
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf Port 55321
**Grundlage:** `spec.md` (18 AC, 7 EC) in der Fassung vom 28.08.2026 · `design.md` nach `/architecture`

> **Wie geprüft wurde.** Die Server Actions wurden über den echten Formularweg aufgerufen — GET der
> Seite, die versteckten `$ACTION_*`-Felder auslesen, multipart-POST auf dieselbe URL, ohne
> `Next-Action`-Kopf. Das ist derselbe Weg, den ein Browser ohne JavaScript geht, und damit der
> Produktionspfad statt eines Umwegs über die API. Weiterleitungen wurden **nicht** gefolgt, damit
> Status, `Location` und `Set-Cookie` roh sichtbar bleiben. Datenbankfunktionen wurden zusätzlich
> direkt geprüft, wo eine IP frei übergeben werden musste.

---

## Was dieser Durchlauf gegenüber dem letzten ändert

| Befund aus Lauf 5 | Stand jetzt |
|---|---|
| **BUG-1 Medium** — der Verlierer des Registrierungs-Rennens sah „Registrierung gerade nicht möglich" statt der Meldung aus AC-5 | **geschlossen.** 3 von 3 Rennen: genau ein Gewinner (HTTP 303 → `/`), der Verlierer bekommt „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", je genau ein Konto in `auth.users` |
| **BUG-2 Medium** — die Drosselungs-Tore sind direkt aufrufbar | **steht unverändert**, bewusst (TD-25) — in diesem Lauf erneut ausgelöst |
| — | **Neu gefunden: BUG-1 Low** — bei nicht erreichbarer Datenbank dauert die Antwort 60 Sekunden, bevor die Meldung erscheint |

**Zusätzlich geprüft, weil dieser Durchlauf es erstmals konnte:** die drei Commits seit Lauf 5
enthalten neben der EC-2-Behebung zwei rein gestalterische Änderungen (Schein hinter der Auth-Karte,
größere Wortmarke). Deren CSS und Markup wurden gegen den ausgelieferten Stylesheet geprüft — das
**Aussehen** selbst bleibt ungeprüft, siehe *Not Verified In This Run*.

---

## Acceptance Criteria

### Registrierung

- [x] **AC-1** — Registrierung mit gültigen Daten → HTTP 303, `Location: /`, Sitzungs-Cookie `sb-127-auth-token` gesetzt · *Evidenz: Formular-POST auf `/signup`, danach `select … from auth.users`*
- [x] **AC-2** — Profilzeile entsteht ohne weiteren Schritt · *Evidenz: `select u.email, (p.id is not null) from auth.users u left join public.profiles p on p.id=u.id` → `t`*
- [x] **AC-3** — Passwort mit 8 Zeichen → „Dein Passwort braucht mindestens 10 Zeichen." am Feld, kein Konto · *Evidenz: Formular-POST; `auth.users` unverändert (nur `demo` + das Konto aus AC-1)*
- [x] **AC-4** — kaputtes E-Mail-Format → „Bitte gib eine gültige E-Mail-Adresse ein." am Feld, kein Konto · *Evidenz: Formular-POST mit `keine-email`*
- [x] **AC-5** — vergebene Adresse → „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", kein zweites Konto · *Evidenz: Formular-POST, Kontostand vorher/nachher gleich*

### Anmeldung

- [x] **AC-6** — richtige Zugangsdaten → HTTP 303, `Location: /`, Sitzungs-Cookie gesetzt; `/konto` zeigt danach die eigene Adresse · *Evidenz: Formular-POST, danach GET `/konto` mit dem Cookie*

### Schutz vor automatisiertem Erraten

- [x] **AC-7** — unbekannte Adresse und falsches Passwort ergeben denselben Satz „E-Mail-Adresse oder Passwort stimmt nicht." · *Evidenz: beide Wege einzeln abgeschickt, Meldungsmenge identisch und einelementig*
- [x] **AC-8** — 5 Fehlversuche je Adresse in 15 Min → der 6. wird abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." · *Evidenz: 7 Formular-POSTs auf dieselbe Adresse — Versuch 1–5 abgelehnt, 6 und 7 gesperrt; danach unverändert 5 Zeilen in `login_attempts`, Weiterhämmern verlängert die Sperre also nicht*
- [x] **AC-9** — die IP-Regel greift nur hinter erklärtem Proxy; **ohne ihn trägt allein AC-8, und kein Versuch wandert in einen gemeinsamen Zähler** · *Evidenz dreiteilig:*
  - *(a) 5 Fehlversuche auf frei erfundene Adressen sperren eine echte Anmeldung **nicht** → HTTP 303. Die Aussperrung aus Lauf 4 bleibt geschlossen*
  - *(b) mit `p_ip` direkt an `login_attempt_gate`: 5 verschiedene Adressen von `203.0.113.7` → der 6. Aufruf `(t, 900)`; eine andere IP kommt unverändert durch*
  - *(c) ohne IP (`p_ip = NULL`): 7 Aufrufe auf 7 verschiedene Adressen → **kein einziger** gesperrt, es entsteht kein gemeinsamer Eimer*
  - *(d) gefälschter `X-Forwarded-For` mit wechselnder IP hilft nicht: die `ip`-Spalte bleibt leer, gesperrt wird erst der 6. Versuch über die Adress-Regel*
- [x] **AC-10** — beide Formulare tragen `method="POST"`; E-Mail und Passwort erscheinen in keiner URL · *Evidenz: `<form … encType="multipart/form-data" method="POST">` im ausgelieferten HTML von `/login` und `/signup`*
- [x] **AC-17** — 10 Registrierungsversuche je Herkunft in 60 Min, **gezählt werden Versuche**; der 11. wird abgelehnt · *Evidenz: 12 Formular-POSTs auf eine **bereits vergebene** Adresse — kein einziges Konto entsteht, Versuch 1–10 melden „schon ein Konto", 11 und 12 sind gesperrt: „Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in 60 Minuten erneut." Die Meldung spricht von Versuchen und nennt „diese Verbindung" nicht*
- [x] **AC-18** — Antwortzeiten ununterscheidbar, unter 500 ms · *Evidenz: 15 Messungen je Gruppe, Zähler vor jeder Messung geleert → Median 360 ms (registriert) gegen 360 ms (unbekannt) = **0,17 %** Abweichung; Bereiche 355–363 und 356–364 ms überlappen; 0 von 30 Antworten ≥ 500 ms. Unter Last (je 3 Runden mit 4 und 8 parallel, 36 Messungen) Maximum 398 ms, ebenfalls 0 über der Grenze*

### Zugriffsschutz

- [x] **AC-11** — abgemeldet: `/` und `/konto` → HTTP 307, `Location: /login` · *Evidenz: `curl -i`*
- [x] **AC-12** — angemeldet: `/login` und `/signup` → HTTP 307, `Location: /`; die geschützten Seiten liefern demselben Cookie 200 · *Evidenz: GET mit Sitzungs-Cookie*
- [x] **AC-13** — Konto A bekommt die Daten von B auch an der Datenbank-Schnittstelle vorbei nicht · *Evidenz mit zwei echten Konten und ihren JWTs: A liest `profiles` → nur die eigene Zeile; gezielte Abfrage auf Bs ID → `[]`; UPDATE auf Bs Zeile → `[]`; DELETE → `permission denied`; INSERT einer Zeile für B → `permission denied`; `login_attempts` auch angemeldet → HTTP 403. Zusätzlich: `delete_own_account` von A aufgerufen löscht **nur** A, B bleibt bestehen*

### Abmelden

- [x] **AC-14** — Abmelden beendet die Sitzung: HTTP 303 → `/login?reason=signed-out`, Sitzungs-Cookie wird geleert; geschützte Seiten tragen `Cache-Control: no-store, must-revalidate`, der Zurück-Button holt die Kontoseite also nicht aus dem Verlauf · *Evidenz: Formular-POST auf das Abmelde-Formular + `curl -I`; Zurück-Button durch E2E Journey 3 (`page.goBack()`, 8/8 grün in diesem Lauf)*
  - *Nachgeprüft: Wer das **alte** Cookie danach erneut schickt, bekommt HTTP 200 — aber **keinen** geschützten Inhalt. Der Rumpf enthält `NEXT_REDIRECT;replace;/login?reason=session-expired;307` samt `meta http-equiv="refresh"`, weder die E-Mail-Adresse noch „Konto löschen". Der 200er ist die Streaming-Antwort von Next.js, nicht ausgelieferter Inhalt*

### Kontolöschung und Aufbewahrung

- [x] **AC-15** — Löschung entfernt Konto und Profil, erneute Anmeldung schlägt fehl · *Evidenz: Konto über die App angelegt, `delete_own_account` mit dem eigenen JWT → HTTP 204; danach `auth.users` 0 und die Profilzeile weg; erneute Anmeldung → `invalid_credentials`. Die Funktion nimmt **kein Argument** (`pg_get_function_identity_arguments` leer) und ist für `anon` gesperrt (`has_function_privilege` → `false`, unangemeldeter Aufruf → HTTP 401). Der Dialogweg zusätzlich durch E2E Journey 4*
- [x] **AC-16** — Zeilen älter als 24 h werden gelöscht, `login` **und** `signup` · *Evidenz: drei Zeilen eingefügt (25 h alt: je eine `login` und eine `signup`; 1 h alt: eine) → nach `cleanup_login_attempts()` bleibt nur die frische. Stündlicher `pg_cron`-Job `cleanup-login-attempts | 0 * * * *` vorhanden; `anon` und `authenticated` haben auf die Aufräumfunktion keine Rechte*

**18 von 18 Acceptance Criteria erfüllt.**

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt genau ein Konto · *Evidenz: zwei gleichzeitig abgeschickte Registrierungen → 1 Konto in `auth.users`. Der eigentliche Schutz ist der während des Absendens gesperrte Knopf (`disabled={isPending}`, `src/components/auth/signup-form.tsx:96`), der die zweite Anfrage im Browser gar nicht erst entstehen lässt — belegt durch E2E Journey 1*
- [x] **EC-2** — **behoben.** Beim Rennen zweier Registrierungen auf dieselbe Adresse gewinnt genau eine, die andere erhält die Meldung aus AC-5 · *Evidenz: 3 Rennen mit je zwei zeitgleich abgeschickten POSTs (gemeinsame `threading.Barrier`, Formularseiten vorher geholt) → jedes Mal ein 303 auf `/` und ein „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an."; `auth.users` zeigt je Adresse genau 1 Zeile*
- [x] **EC-3** — Sitzungsgrenzen gesetzt (`timebox = "24h"`, `inactivity_timeout = "8h"`); `/login?reason=session-expired` zeigt „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." · *Evidenz: `supabase/config.toml:277,279`; `curl` auf `/login?reason=session-expired` und `?reason=deleted` („Dein Konto ist gelöscht. Alles Gute!")*
- [x] **EC-4** — bei angehaltener Datenbank erscheint je Weg eine eigene, verständliche Meldung; das Passwort taucht in der Antwort nicht auf und liegt wegen POST auch nicht in der URL · *Evidenz: `docker pause` in zwei Varianten (DB + Auth, und nur DB) → `/login`: „Die Anmeldung ist gerade nicht möglich…", `/signup`: „Die Registrierung ist gerade nicht möglich…"; Passwort nicht im Antwortrumpf. Das Passwortfeld trägt keinen `defaultValue` und der Aktionszustand führt das Passwort nie mit — es ist nach jedem Fehler strukturell leer* · **aber: die Antwort braucht dafür 60 Sekunden → BUG-1 (Low)**
- [x] **EC-5** — nach dem Löschen im ersten Tab liefert der zweite **keinen** geschützten Inhalt mehr · *Evidenz: Tab 2 vor der Löschung zeigt die eigene Adresse; nach der Löschung enthält die Antwort weder die Adresse noch „Konto löschen", sondern `NEXT_REDIRECT;replace;/login?reason=session-expired` samt `meta refresh`. Kein Absturz*
- [x] **EC-6** — Randleerzeichen im Passwort werden bei Registrierung und Anmeldung identisch behandelt · *Evidenz: Registrierung mit `"  MitLeerzeichen1  "` → 303; Anmeldung **mit** Leerzeichen → 303; **ohne** → „E-Mail-Adresse oder Passwort stimmt nicht."*
- [x] **EC-7** — kurze Rateversuche zählen zur Drosselung, die Meldung nennt die Passwortregel nicht · *Evidenz: Anmeldung mit dem Passwort `abc` → „E-Mail-Adresse oder Passwort stimmt nicht." und eine gezählte Zeile in `login_attempts`, kein Schema-Fehler*

**7 von 7 Edge Cases erfüllt.**

> **Eine Spannung zwischen EC-1 und EC-2, die keine Lücke ist.** Serverseitig beschreiben beide
> dasselbe Rennen: EC-1 sagt „die Person sieht keinen Fehler", EC-2 sagt „die andere erhält die
> Meldung aus AC-5". Beides gilt gleichzeitig nur, weil der gesperrte Knopf die zweite Anfrage im
> Browser verhindert — EC-1 ist damit eine Zusage über die Oberfläche, EC-2 eine über den Server.
> Wer das Formular ohne JavaScript zweimal absendet, bekommt die AC-5-Meldung. Das ist die richtige
> Antwort, aber es ist eine Antwort auf EC-2, nicht auf EC-1.

---

## Security Audit

- [x] **Authentifizierungs-Umgehung** — geschützte Routen ohne Sitzung → 307 auf `/login`, kein Inhalt · *Evidenz: `curl -i` auf `/` und `/konto`*
- [x] **Autorisierung über Kontogrenzen** — siehe AC-13; der gezielte Zugriff auf eine fremde ID liefert `[]` statt eines Fehlers, der die Existenz verriete
- [x] **Zugriff ohne jede Anmeldung** — `profiles` und `login_attempts` antworten dem öffentlichen Schlüssel mit `permission denied` (HTTP 401) · *Evidenz: `curl` auf `/rest/v1/profiles` und `/rest/v1/login_attempts` nur mit `apikey`*
- [x] **`delete_own_account` ist nicht anonym aufrufbar** — `has_function_privilege('anon', …)` → `false`, unangemeldeter RPC → HTTP 401 `permission denied for function delete_own_account`
- [x] **Injection** — 4 XSS- und SQL-Nutzlasten (u. a. `x'; drop table public.login_attempts;--` und `"><script>alert(document.cookie)</script>`) an **beide** Wege · *Evidenz: alle scheitern an der Schema-Prüfung, kein Konto entsteht, `login_attempts` existiert unverändert; die Rückschreibung ins Formular ist escaped (`&lt;img src=x onerror=alert(1)&gt;`), kein rohes Markup in der Antwort*
- [x] **Brute Force auf Zugangsdaten** — greift: 6. Anmeldeversuch gesperrt, 11. Registrierungsversuch gesperrt; Weiterhämmern verlängert die Sperre **nicht** (nach 25 Aufrufen unverändert 5 gezählte Zeilen und 900 s Restzeit)
- [x] **Kontoexistenz wird nicht verraten (Anmeldung)** — gleiche Meldung *und* gleiche Antwortzeit, siehe AC-7 und AC-18
- [x] **Massenhaftes Anlegen von Konten** — durch AC-17 begrenzt, auch ohne erkennbare IP (gemeinsamer Eimer, TD-23)
- [x] **Secrets im ausgelieferten Bundle** — kein `service_role`, kein `sb_secret`, kein `SERVICE_ROLE`, kein `TRUSTED_PROXY_HOPS`, kein JWT-Secret in `.next/static` (je 0 Treffer); auch der service_role-JWT nicht (Suche nach `InNlcnZpY2Vfcm9sZSI` → 0) · *einziger `service_role`-Treffer im Quellcode ist ein Kommentar in `src/lib/actions/account.ts:25`, der seine Abwesenheit erklärt*
- [x] **Zugangsdaten in der URL** — beide Formulare POSTen; keine Zugangsdaten in Query-Strings · *Evidenz: Formular-Markup, siehe AC-10*
- [x] **Sicherheits-Header** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` auf allen vier Routen · *Evidenz: `curl -I` auf `/`, `/login`, `/signup`, `/konto`*
- [x] **`.env`-Dateien im Repo** — nur `.env.local.example` ist versioniert; `.gitignore` deckt `.env` und `.env.*` ab · *Evidenz: `git ls-files | grep -i '\.env'`*
- [ ] **Die Drosselungs-Tore sind unauthentifiziert aufrufbar** — **BUG-2**, bewusst offen (TD-25). In diesem Lauf erneut ausgelöst
- [!] **Drosselung gewöhnlicher Endpunkte** — NOT VERIFIED: PROJ-1 hat außer den Auth-Wegen keine eigenen Endpunkte (`find src/app -name 'route.ts'` → keine Treffer)

**13 Prüfungen verifiziert, 1 NOT VERIFIED.** Eine der verifizierten ist als BUG-2 negativ ausgefallen.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **63 Tests in 5 Dateien, alle grün** (vorher 57).
  - **In diesem Durchlauf ergänzt: 6 Tests in `src/lib/actions/auth.test.ts`.** Die Lücke war eine
    echte: **AC-18 hing an einer einzigen Zahl** (`MIN_FAILURE_MS = 350`) und an keinem Test. Wer sie
    beim Aufräumen entfernt, bricht den Seitenkanal-Schutz wieder auf — und die bestehenden
    Wortlaut-Tests aus AC-7 wären trotzdem grün geblieben, weil der Meldungstext sich nicht ändert.
    Abgedeckt sind jetzt: alle vier Fehlschlagswege der Anmeldung halten den Boden ein
    (Schema-Ablehnung · falsche Zugangsdaten · gesperrt · Datenbank nicht erreichbar), die
    **geglückte** Anmeldung wird ausdrücklich **nicht** gebremst, und Supabase' eigener HTTP 429
    wird als Fehlversuchs-Sperre erklärt statt als falsches Passwort.
  - **Rot-Nachweis geführt** (drei Runden, jeder der 6 neuen Tests war mindestens einmal rot):
    `MIN_FAILURE_MS` auf `0` → 4 rot (die „bremst NICHT"-Zusage blieb korrekt grün) · den
    429-Zweig entfernt → 1 rot · den Boden auch auf den Erfolgsweg gelegt → 1 rot. Danach jeweils
    aus der Sicherung wiederhergestellt, 63 grün, `git diff` zeigt nur die neue Testdatei.
- **Lint:** `npm run lint` ohne Befund.
- **Build:** `npm run build` erfolgreich (Next.js 16.3.3, Turbopack).

## E2E Tests

**8 von 8 grün** (Chromium und Mobile Safari, 36,0 s) — die bestehende Suite aus `/e2e-tests`, in
diesem Lauf als Regression gegen den **Produktions-Server** ausgeführt. Journeys: Registrieren ·
Anmelden · Abmelden inkl. Zurück-Button · Konto löschen über den Bestätigungsdialog.

Die Drosselung (AC-8, AC-9, AC-17) ist dort weiterhin bewusst nicht abgedeckt — sie wird gezielt
gegen die Datenbankfunktionen geprüft, wo eine IP frei übergeben werden kann.

## Regression

`features/INDEX.md` führt **kein** Feature mit Status *Deployed*; PROJ-2 und PROJ-3 stehen auf
*Roadmap*. Es gibt daher keine fremden Features, die brechen könnten. Die Regression von PROJ-1 gegen
sich selbst ist oben abgedeckt: alle 18 AC und alle 7 EC in diesem Lauf neu geprüft, 63 Unit-Tests,
8 E2E.

**Die drei Commits seit Lauf 5 einzeln nachgezogen:**

| Commit | Was geprüft wurde |
|---|---|
| `98b5114` EC-2-Behebung | Das Rennen selbst (3 Läufe, oben) · dass ein **echter** Ausfall weiterhin nicht als „Adresse vergeben" ausgegeben wird — bei angehaltener Datenbank meldet `/signup` korrekt „Die Registrierung ist gerade nicht möglich." · dass die Wiederholung den Ausfall nicht verdoppelt: die 60 Sekunden entstehen schon im Tor davor, `signUp` wird dabei gar nicht erreicht |
| `0b4a953` Schein hinter der Karte | Die fünf neuen Regeln sind im ausgelieferten Stylesheet vorhanden; `opacity: 0` steht **ausschließlich** im `from` der Keyframes — die drei Treffer außerhalb sind vorbestehende Tailwind-Hilfsklassen (`.opacity-0`, `.md:opacity-0`, Sidebar), keine davon liegt auf den Auth-Seiten. Die `prefers-reduced-motion`-Regel, die die Verzögerung zurücksetzt, steht **nach** der globalen Regel und greift damit |
| `643c971` größere Wortmarke | `text-4xl` konsistent auf allen fünf Stellen (`/`, `/login`, `/signup`, `/konto`, `konto/loading`); die Wortmarke ist überall direktes Flex-Kind und damit blockifiziert — `transform` und `mb-8` aus `.auth-enter` greifen also tatsächlich |

---

## Not Verified In This Run

- [!] **Wie die neuen Gestaltungsänderungen aussehen** — der Schein hinter der Karte und die größere Wortmarke wurden als CSS und Markup geprüft, **nicht** als Bild. Ob die Karte damit wirklich „schwebt", ist eine Sichtprüfung, die `/qa` nicht leisten kann.
- [!] **Darstellung auf verschiedenen Bildschirmbreiten** (375 / 768 / 1440 px) — kein Viewport in `/qa`. Die E2E-Suite läuft immerhin auf einem iPhone-13-Profil und ist grün, prüft aber Abläufe, keine Gestaltung.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Alles, was die Entwicklerwerkzeuge braucht** — Konsolenausgaben, Netzwerk-Tab, berechnete Stile.
- [!] **Rein clientseitige Interaktionen** — Fokusführung im Löschdialog, Tastaturbedienung, der tatsächliche Ablauf der Einblende-Animationen.
- [!] **`T24` (`[user]`): die Zeile `TRUSTED_PROXY_HOPS=0` in `.env.local.example`** — die Datei ist in dieser Sitzung nicht lesbar (Zugriff verweigert), der Haken stammt aus einem früheren Lauf. **Die Schutzwirkung selbst ist verifiziert**, denn sie hängt nicht an der Datei: ohne gesetzte Variable gilt die sichere Vorgabe `0`, und der gefälschte `X-Forwarded-For` wurde nachweislich ignoriert. Offen ist allein die Dokumentationszeile.
- [!] **Der tatsächliche Ablauf der Sitzung nach 8 bzw. 24 Stunden** (EC-3) — geprüft sind die gesetzten Werte und die Hinweiszeile, nicht das Verstreichen der Zeit.
- [!] **Drosselung gewöhnlicher Endpunkte** — PROJ-1 hat keine.

---

## Bugs

### BUG-1: Bei nicht erreichbarer Datenbank dauert die Antwort 60 Sekunden

- **Severity:** Low · **Status:** offen · **Betrifft:** EC-4 · `src/lib/rate-limit.ts` (der Tor-Aufruf vor der Anmeldung)
- **Was passiert:** Ist die Datenbank angehalten, erscheint zwar die richtige, verständliche Meldung
  („Die Anmeldung ist gerade nicht möglich…" bzw. „Die Registrierung ist gerade nicht möglich…") —
  aber erst nach **rund 60 Sekunden**. Bis dahin dreht sich nur der Absende-Knopf.
- **Reproduktion:** `docker pause supabase_db_praxisprojekt-ai-engineering`, dann `/login` oder
  `/signup` absenden. 4 von 4 Messungen zwischen 60,0 und 60,1 Sekunden.
- **Ursache:** Der Drosselungs-Aufruf (`passLoginGate` / `passSignupGate`) geht als erstes an die
  Datenbank und läuft dort in die Zeitüberschreitung des HTTP-Clients. Der Supabase-Client bringt
  für diesen Aufruf keine kürzere eigene Frist mit.
- **Warum nur Low:** EC-4 verlangt eine verständliche Meldung, kein Zeitlimit — und die Meldung
  kommt. Die 500-ms-Zusage aus den Technical Requirements gilt ausdrücklich „auch bei aktivierter
  Drosselung", nicht bei ausgefallener Datenbank. Kein Datenverlust, kein Sicherheitsproblem.
- **Warum trotzdem gemeldet:** Hinter einem üblichen vorgelagerten Server mit 30- bis 60-sekündiger
  Frist bekäme die Person statt der freundlichen Meldung einen Gateway-Fehler zu sehen — dann hielte
  EC-4 im Betrieb nicht mehr, was es hier lokal hält. Eine eigene, kurze Frist auf dem Tor-Aufruf
  würde es lösen. Der Befund ist **nicht** neu in diesem Durchlauf: er bestand schon vorher und war
  nur nie gemessen worden. Die EC-2-Behebung verdoppelt ihn **nicht** — `signUp` wird in diesem Fall
  gar nicht erst erreicht.

### BUG-2: Die Drosselungs-Tore lassen sich unauthentifiziert aufrufen

- **Severity:** Medium · **Status:** offen — **bewusst**, siehe `design.md` TD-25 und die Open
  Questions in `spec.md`
- **Betrifft:** AC-8, AC-9, AC-17 · `grant execute … to anon` auf beiden Toren
  (`has_function_privilege('anon', 'public.login_attempt_gate(text,inet)', 'execute')` → `true`)
- **Was passiert:** Fünf anonyme Aufrufe von `login_attempt_gate` mit einer fremden Adresse sperren
  deren Anmeldung für 15 Minuten. In diesem Lauf erneut ausgelöst: nach fünf RPC-Aufrufen antwortete
  das Formular auch bei **richtigem** Passwort mit „Zu viele Fehlversuche."
- **Warum Medium und nicht High:** Dieselbe Sperre lässt sich ohnehin über das Anmeldeformular
  auslösen — fünf Absendungen mit der fremden Adresse genügen. Der RPC-Weg macht es billiger, nicht
  erst möglich. Zudem **verlängert Weiterhämmern die Sperre nicht** (nachgemessen: nach 25 Aufrufen
  unverändert 5 Zeilen und 900 s Restzeit), die Aussperrung ist also auf 15 Minuten je Angriffswelle
  begrenzt.
- **Zu schließen vor dem ersten öffentlichen Zugang.** Der Weg dorthin ist ein Geheimnis, das App und
  Datenbank teilen und das nicht im Repo liegt; `service_role` scheidet nach TD-6 aus.

---

## Beobachtung ohne Bug-Status

**Die Kontosperre aus AC-8 ist für jede:n auslösbar, der eine E-Mail-Adresse kennt** — das ist keine
Lücke in der Umsetzung, sondern eine Eigenschaft der Regel selbst: Wer je Konto drosselt, gibt damit
jedem die Möglichkeit, dieses Konto 15 Minuten lang zu blockieren. Ein CAPTCHA vor dem Formular wäre
die Gegenmaßnahme; es steht in `spec.md` als offene Frage. Gehört dem Produkt vorgelegt, nicht dem
Code: Die Alternative wäre, Fehlversuche nur je IP zu zählen — und genau das hat sich in Lauf 4 als
schlechter erwiesen.

---

## Summary

- **Acceptance Criteria:** **18 von 18 erfüllt**
- **Edge Cases:** **7 von 7 erfüllt** — EC-2 in diesem Lauf geschlossen
- **Bugs:** 0 Critical · 0 High · **1 Medium** (BUG-2, bekannt und bewusst offen) · **1 Low** (BUG-1, neu gemessen, vorbestehend)
- **Behoben und in diesem Lauf bestätigt:** BUG-1 (Medium, EC-2) aus Lauf 5
- **Security:** **13 Prüfungen verifiziert, 1 NOT VERIFIED**; eine der verifizierten ist als BUG-2
  negativ ausgefallen
- **Tests:** 63 Unit-/Integrationstests grün (6 neu, Rot-Nachweis geführt) · 8 von 8 E2E grün ·
  Lint und Build grün
- **Production Ready:** **JA** — kein Critical- oder High-Befund, und alle 18 AC wurden in diesem
  Lauf tatsächlich gegen die laufende Anwendung ausgeführt.

**Das „JA" ist eine Aussage über gefundene Fehler, nicht über vollständige Abdeckung.** Zwei Befunde
stehen offen, und die Liste unter *Not Verified In This Run* ist nicht leer — insbesondere wurde
**gar nicht geprüft, wie die Seiten aussehen**: weder auf verschiedenen Bildschirmbreiten noch in
anderen Browsern, und die beiden Gestaltungs-Commits dieses Durchgangs sind nur als CSS geprüft, nicht
als Bild. BUG-2 gehört vor dem ersten öffentlichen Zugang geschlossen.
