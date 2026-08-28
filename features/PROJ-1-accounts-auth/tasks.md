# PROJ-1 Tasks — Konto & Anmeldung

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Das ist der geordnete, nachverfolgbare Bauplan —
> die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: die Dateien der Aufgabe sind disjunkt zu jeder anderen `[P]`-Aufgabe
> derselben Ebene, `/build` kann sie also in einen eigenen Subagenten geben.
> **Ebenen laufen nacheinander** (jede ist eine Schranke). **Innerhalb** einer Ebene läuft parallel,
> was `[P]` trägt. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette
> AC → Task → Test.
> Eigentümer: `/tasks` legt diese Datei an; `/build` hakt ab. Kein Statusfeld hier — der Status des
> Features lebt ausschließlich in `features/INDEX.md`.

**Auth-Einstellungen sind keine `[user]`-Aufgaben.** Alles, was dieses Feature an
Auth-Einstellungen braucht, steht in `supabase/config.toml` im Repo und ist damit eine normale
Bauaufgabe (T4).

**Eine `[user]`-Aufgabe kam später dazu:** T24 in Ebene 7 — eine Zeile in `.env.local.example`.
Sie ist **keine fehlende Schutzmaßnahme**: die sichere Vorgabe (`TRUSTED_PROXY_HOPS = 0`, Kopf
wird nicht gelesen) gilt auch ohne die Datei. Es geht allein darum, die Variable dort zu
dokumentieren, wo die Regel in `.claude/rules/security.md` sie erwartet — Claude darf in diese
Datei nicht schreiben.

---

## Level 1 — Daten, Schema, Fundament

<!-- Fundament: Datenbank, Migrationen, gemeinsame Bausteine. Läuft zuerst, weil alles andere auf dem
     Datenvertrag aufsetzt. Alle sechs Aufgaben schreiben in disjunkte Dateien. -->

- [x] **T1** [P]  Migration: Tabelle `profiles` (id, created_at), RLS an, Lese- und Änderungs-Policy nur für die eigene Zeile, Trigger auf `auth.users` legt die Profilzeile an  · files: `supabase/migrations/20260827120000_profiles.sql`  · → AC-2, AC-13
- [x] **T2** [P]  Migration: Tabelle `login_attempts` (email, ip, attempted_at), RLS an und **bewusst keine Policy**, keine Rechte für die öffentlichen Rollen, Indizes; dazu drei Funktionen mit erhöhten Rechten — Sperre prüfen (5 Versuche / 15 Min je E-Mail und je IP, mit Restzeit), Fehlversuch festhalten, älter als 24 Stunden löschen; stündlicher `pg_cron`-Job  · files: `supabase/migrations/20260827120100_login_attempts.sql`  · → AC-8, AC-9, AC-16
- [x] **T3** [P]  Migration: Funktion `delete_own_account` mit erhöhten Rechten — löscht ausschließlich das Konto der aufrufenden Person aus `auth.users`, Profil und Drosselungszeilen laufen mit  · files: `supabase/migrations/20260827120200_delete_own_account.sql`  · → AC-15
- [x] **T4** [P]  `config.toml`: `minimum_password_length = 10`, `[auth.sessions]` mit `inactivity_timeout = "8h"` und `timebox = "24h"`  · files: `supabase/config.toml`  · → AC-3, EC-3
  - **Hand-off:** Nach dieser Änderung `supabase stop && supabase start` — sonst gilt weiter der alte Wert.
- [x] **T5** [P]  `@supabase/ssr` installieren; Browser-Client und Server-Client anlegen (Sitzung in Cookies, nicht im Browser-Speicher); den bisherigen Client `src/lib/supabase.ts` ablösen  · files: `package.json`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase.ts`  · → AC-1, AC-6
- [x] **T6** [P]  Fundament der Oberfläche: Farb-Tokens nach `docs/design-system.md` als deckende HSL-Tripel, Wurzel-Layout (`lang="de"`, Dark fest, Space Grotesk + Open Sans über `next/font/google`, Toaster unten rechts, Titel „auslage."), Komponente `Wordmark`, Sicherheits-Header  · files: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/wordmark.tsx`, `next.config.ts`  · → AC-1, AC-6 · zusätzlich Regel `.claude/rules/security.md` (Security Headers — bewusst ohne AC-Zuordnung, weil `spec.md` dazu kein Kriterium führt)

> **Die Dateinamen der Migrationen sind fest vergeben**, nicht über `supabase migration new` erzeugt.
> Drei parallele Subagenten würden sich sonst um Zeitstempel streiten, und die Reihenfolge entscheidet,
> in welcher die Migrationen laufen: `profiles` → `login_attempts` → `delete_own_account`.

---

## Level 2 — Serverseitige Bausteine

<!-- Bausteine, die die Server Actions in Ebene 3 benutzen. Setzt auf den Clients aus T5 auf. -->

- [x] **T7** [P]  Sitzungsprüfung: holt die angemeldete Person beim Auth-Server ab (nicht aus dem Cookie), leitet ohne Person auf `/login?reason=session-expired`  · files: `src/lib/auth.ts`  · → AC-11, EC-3, EC-5
- [x] **T8** [P]  `proxy.ts` (in Next.js 16 die frühere `middleware.ts`): Sitzungs-Cookies auffrischen, abgemeldet von `/` und `/konto` auf `/login`, angemeldet von `/login` und `/signup` auf `/`, geschützte Antworten mit `Cache-Control: no-store`  · files: `src/proxy.ts`  · → AC-11, AC-12, AC-14
- [x] **T9** [P]  Zod-Schemata für Anmeldung und Registrierung: E-Mail-Format, höchstens 254 Zeichen, kleingeschrieben und randbereinigt; Passwort 10 bis 72 Zeichen, **ohne** Randbereinigung  · files: `src/lib/validation/auth.ts`  · → AC-3, AC-4, EC-6
- [x] **T10** [P]  Drosselung anbinden: IP aus `x-forwarded-for` bzw. `x-real-ip` lesen (fehlt sie, greift nur die Adress-Regel), Sperre vor dem Prüfen der Zugangsdaten abfragen, Fehlversuche auch für unbekannte Adressen festhalten, Restzeit in aufgerundete Minuten umrechnen  · files: `src/lib/rate-limit.ts`  · → AC-7, AC-8, AC-9

---

## Level 3 — Server Actions

<!-- Der eigentliche Auth-Flow. Verschickt per POST, damit Zugangsdaten nie in der Adresszeile landen. -->

- [x] **T11** [P]  Anmelden und Registrieren: Schema-Prüfung, Drosselung davor, Supabase Auth aufrufen, Zähler bei Erfolg löschen, Weiterleitung auf `/`; **eine einzige** Fehlermeldung für unbekannte Adresse und falsches Passwort; „schon vergeben" bei doppelter Registrierung; verständliche Meldung bei nicht erreichbarer Datenbank  · files: `src/lib/actions/auth.ts`  · → AC-1, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, EC-2, EC-4
- [x] **T12** [P]  Abmelden (Sitzung beenden, Weiterleitung auf `/login`) und Konto löschen (Datenbankfunktion aufrufen, abmelden, Weiterleitung auf `/login?reason=deleted`)  · files: `src/lib/actions/account.ts`  · → AC-14, AC-15, EC-5

---

## Level 4 — Oberfläche

<!-- Setzt auf dem Server-Vertrag aus Ebene 3 auf. Vier Aufgaben, vier disjunkte Dateisätze. -->

- [x] **T13** [P]  `/login` und `LoginForm`: zentrierte Karte ohne Rahmen, Wortmarke darüber, Feldfehler am Feld und Sammelzeile darüber, Hinweiszeile bei `?reason=session-expired` und `?reason=deleted`, Passwortfeld wird bei jedem Fehler geleert, Button während des Absendens gesperrt  · files: `src/app/login/page.tsx`, `src/components/auth/login-form.tsx`  · → AC-6, AC-7, AC-8, AC-9, AC-10, AC-12, EC-3, EC-4
- [x] **T14** [P]  `/signup` und `SignupForm`: dieselbe Kartenform, Hilfetext „mindestens 10 Zeichen", Feld- und Sammelfehler, Button während des Absendens gesperrt (das ist der Doppelklick-Schutz)  · files: `src/app/signup/page.tsx`, `src/components/auth/signup-form.tsx`  · → AC-1, AC-3, AC-4, AC-5, AC-12, EC-1
- [x] **T15** [P]  `/` als geschützte Platzhalterseite: Wortmarke, ein Satz, Link auf `/konto` — PROJ-2 ersetzt später den Inhalt, der Zugriffsschutz der Route bleibt  · files: `src/app/page.tsx`  · → AC-11
- [x] **T16** [P]  `/konto`: Karte „Konto" mit E-Mail-Adresse (Skeleton beim Laden) und Abmelden-Button, Karte „Konto löschen" mit Bestätigungsdialog auf Basis von `alert-dialog`  · files: `src/app/konto/page.tsx`, `src/components/account/logout-button.tsx`, `src/components/account/delete-account-dialog.tsx`  · → AC-11, AC-14, AC-15

---

## Level 5 — Durchstich

- [x] **T17**  Einmal am Stück durchklicken: Registrieren → `/konto` → Abmelden → Anmelden → fünf Fehlversuche bis zur Sperre → Konto löschen. Danach `npm run lint` und `npm run build` grün  · files: —  · → alle AC

---

## Level 6 — Nachbesserung nach dem QA-Durchlauf

<!-- Ergänzt am 28.08.2026. Die Arbeit war zum Zeitpunkt dieses Eintrags bereits erledigt und
     gegen einen Produktions-Build verifiziert; die Aufgaben stehen hier, damit AC-17, AC-18 und
     EC-7 nicht ohne Task in der Kette hängen. -->

- [x] **T18**  Migration: Spalte `kind` auf `login_attempts`, neues Tor `signup_attempt_gate` (10 Registrierungen je IP in 60 Minuten), `login_attempt_gate` und `clear_own_login_attempts` auf `kind='login'` eingegrenzt  · files: `supabase/migrations/20260828100000_signup_throttle.sql`  · → AC-17, AC-16
- [x] **T19**  Registrierungs-Tor anbinden und Fehlschläge der Anmeldung auf mindestens 350 ms bremsen, damit die Antwortzeit nicht verrät, ob eine Adresse registriert ist  · files: `src/lib/rate-limit.ts`, `src/lib/actions/auth.ts`  · → AC-17, AC-18
- [x] **T20**  Beim Anmelden keine Passwort-Mindestlänge mehr prüfen, damit kurze Rateversuche gezählt werden und die Meldung die Regel nicht preisgibt  · files: `src/lib/validation/auth.ts`, `src/lib/validation/auth.test.ts`  · → EC-7, AC-8, AC-7

---

## Level 7 — Nachbesserung nach dem zweiten QA-Durchlauf

<!-- Ergänzt am 28.08.2026 nach dem zweiten /qa-Lauf. BUG-1 war der einzige High-Befund:
     die IP-gestützten Regeln ließen sich vom Aufrufer abschalten. Die Behebung hat zwei
     Hälften, Datenbank und Anwendung — beide sind nötig, keine genügt allein. -->

- [x] **T21**  Migration: beide Tore behandeln „keine erkennbare IP" als **eigenen Eimer** statt als Freifahrtschein (`ip is not distinct from p_ip`). Vorher übersprang `signup_attempt_gate` die Prüfung bei fehlender IP ganz und `login_attempt_gate` ließ die IP-Regel aus — das war die Hälfte von BUG-1, die in der Datenbank saß  · files: `supabase/migrations/20260828120000_ip_bucket_not_skip.sql`  · → AC-9, AC-17
- [x] **T22**  `clientIpFrom` liest `x-forwarded-for` nur noch, wenn ein vertrauenswürdiger Proxy davorsteht (`TRUSTED_PROXY_HOPS`, Vorgabe `0`), und nimmt dann den `n`-ten Eintrag **von rechts** statt den ersten. Ohne Proxy wird der Kopf gar nicht gelesen  · files: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`  · → AC-9, AC-17
- [x] **T23**  Eigene Meldung für die Registrierung, wenn die Datenbank nicht erreichbar ist — bisher las man dort von einer „Anmeldung", die man nicht versucht hat (BUG-2)  · files: `src/lib/actions/auth.ts`  · → EC-4
- [ ] **T24** `[user]`  `TRUSTED_PROXY_HOPS=0` in `.env.local.example` dokumentieren  · **where:** `.env.local.example`, unter den Supabase-Variablen · Der Schreibzugriff auf diese Datei ist für Claude gesperrt; der genaue Textblock steht im Build-Bericht  · → AC-9, AC-17

> **Nicht in diesem Durchgang behoben, mit Absicht:**
> - **BUG-3** (die 500-ms-Zusage aus AC-18 reißt in Ausreißern) — die Untergrenze von 350 ms
>   verursacht die Ausreißer *nicht*: `notFasterThanFloor` schläft nur, solange noch Zeit übrig
>   ist, und tut bei 509 ms echter Arbeit gar nichts mehr. Sie zu senken änderte an den
>   Ausreißern nichts. Das ist eine Frage an den Vertrag, nicht an den Code → `/refine`.
> - **BUG-4** (die Registrierungssperre zählt Versuche statt angelegter Konten) — betrifft den
>   Wortlaut von AC-17 und gehört deshalb zuerst in ein `/refine`, nicht in einen Build.

---

## Abdeckung

| AC / EC | Aufgaben |
|---|---|
| AC-1 | T5, T6, T11, T14 |
| AC-2 | T1 |
| AC-3 | T4, T9, T14 |
| AC-4 | T9, T11, T14 |
| AC-5 | T11, T14 |
| AC-6 | T5, T6, T11, T13 |
| AC-7 | T10, T11, T13 |
| AC-8 | T2, T10, T11, T13 |
| AC-9 | T2, T10, T11, T13, T21, T22 |
| AC-10 | T11, T13, T14 |
| AC-11 | T7, T8, T15, T16 |
| AC-12 | T8, T13, T14 |
| AC-13 | T1 |
| AC-14 | T8, T12, T16 |
| AC-15 | T3, T12, T16 |
| AC-16 | T2, T18 |
| AC-17 | T18, T19, T21, T22 |
| AC-18 | T19 |
| EC-1 | T14 |
| EC-2 | T11 |
| EC-3 | T4, T7, T13 |
| EC-4 | T11, T13, T23 |
| EC-5 | T7, T12 |
| EC-6 | T9 |
| EC-7 | T20 |

Alle 18 AC und alle 7 EC sind abgedeckt. Umgekehrt trägt jede Aufgabe mindestens eine AC-Referenz —
mit einer benannten Ausnahme: die Sicherheits-Header in T6 kommen aus `.claude/rules/security.md`,
nicht aus einem Acceptance Criterion. Das steht dort ausdrücklich, statt sie an ein AC zu hängen, zu
dem sie nicht gehören.

---

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen
  ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema (L1) → Bausteine (L2)
  → Actions (L3) → Oberfläche (L4).
- **`[P]` verlangt disjunkte Dateien.** Keine zwei `[P]`-Aufgaben derselben Ebene nennen denselben
  Pfad. Geprüft: L1 sechs disjunkte Sätze, L2 vier, L3 zwei, L4 vier.
- **Warum T7 bis T10 nicht in derselben Ebene wie T11/T12 stehen:** die Server Actions importieren
  alle vier. Lägen sie zusammen, bekäme ein paralleler Agent eine Datei zu sehen, die es noch nicht
  gibt.
- **T17 ist bewusst nicht `[P]`** — es ist die Integration, nicht ein weiterer Baustein.
