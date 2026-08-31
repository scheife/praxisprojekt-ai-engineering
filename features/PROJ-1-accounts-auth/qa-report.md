# QA-Bericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-31 (achter Durchlauf, nach dem `/refine` vom 31.08.2026 und dem Build zu AC-19)
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf Port 55321
**App-URL:** `http://localhost:3100` — **nicht** die 3000 aus `.ai-eng-kit`
**Grundlage:** `spec.md` (19 AC, 7 EC) in der Fassung vom 31.08.2026 · `design.md` inkl. TD-27

> **Warum Port 3100.** Auf dieser Maschine hält der Dev-Server des produktiven alexmacht Business OS
> die 3000 besetzt (`/Users/scheife/Develop/03_alexmacht/buisness-os`, PID 97973). Der Prozess wurde
> **nicht** angefasst — die Trennung vom Business OS ist eine Rahmenbedingung des PRD. Ein Test gegen
> die 3000 hätte die falsche Anwendung geprüft und trotzdem ein Ergebnis gemeldet; genau dieser
> Fehler steht schon als Warnung in `playwright.config.ts`.
>
> **Wie geprüft wurde.** Die Server Actions über den echten Formularweg — GET der Seite, die
> versteckten `$ACTION_*`-Felder auslesen, multipart-POST auf dieselbe URL. Weiterleitungen wurden
> **nicht** gefolgt, damit Status, `Location` und `Set-Cookie` roh sichtbar bleiben. Datenbank­funktionen
> zusätzlich direkt geprüft, wo eine IP frei übergeben werden musste.
>
> **Der Server lief wieder OHNE `GATE_SECRET` auf der Kommandozeile.** Nur so ist belegt, dass der
> Wert aus `.env.local` kommt (T36).
>
> **Für AC-9 wurde der hinterlegte Abdruck des Tor-Geheimnisses vorübergehend getauscht** — vorher
> gesichert, danach byte-gleich zurückgeschrieben und mit einer echten Anmeldung nachgewiesen. Der
> Klartext in `.env.local` wurde dabei nie gelesen.

---

## Was dieser Durchlauf gegenüber dem letzten ändert

| Stand aus Lauf 7 | Stand jetzt |
|---|---|
| **AC-19 gab es noch nicht** — `/refine` vom 31.08.2026 hat es ergänzt, `/build` umgesetzt (T37–T39) | **Neu geprüft und erfüllt.** Genau eine Abmelde-Schaltfläche je angemeldeter Seite, im Header. Rot-Nachweis in diesem Lauf selbst geführt |
| **BUG-1 Low (AC-18, 500-ms-Zusage)** — als Vertragsfrage offen | **geschlossen.** AC-18 misst seit dem `/refine` als Perzentil am eingeschwungenen Build; die Messung erfüllt die neue Fassung mit Abstand (30 von 30 unter 500 ms, Maximum 371 ms) |
| `T24` war nicht überprüfbar — `.env.local.example` galt als für Claude nicht lesbar | **T24 erstmals verifiziert:** `TRUSTED_PROXY_HOPS=0` steht drin. Dabei fiel auf, dass **`GATE_SECRET` dort fehlt** → **BUG-1**, neu |
| Regression beschränkt auf PROJ-1 gegen sich selbst (PROJ-2 stand auf *Roadmap*) | **PROJ-2 ist jetzt gebaut und Approved** — und AC-19 greift in dessen Header ein. Deshalb erstmals echte Regression gegen PROJ-2: Ausgaben-Isolation, CSV-Export, alle 5 PROJ-2-Journeys |

---

## Acceptance Criteria

### Registrierung

- [x] **AC-1** — gültige Daten → HTTP 303, `Location: /`, Sitzungs-Cookie `sb-127-auth-token` gesetzt · *Evidenz: Formular-POST auf `/signup`, 243 ms*
- [x] **AC-2** — Profilzeile entsteht ohne weiteren Schritt · *Evidenz: `left join public.profiles` auf das angelegte Konto → `hat_profil = t`, `profil_id_gleich = t`*
- [x] **AC-3** — Passwort mit 8 Zeichen → „Dein Passwort braucht mindestens 10 Zeichen." am Feld · *Evidenz: Antwort nach 28 ms (vor dem Tor), `select` auf `auth.users` → kein Konto angelegt*
- [x] **AC-4** — kaputtes E-Mail-Format → „Bitte gib eine gültige E-Mail-Adresse ein." am Feld, kein Konto · *Evidenz: dieselbe Abfrage, 0 Zeilen*
- [x] **AC-5** — vergebene Adresse → „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", kein zweites Konto

### Anmeldung

- [x] **AC-6** — richtige Zugangsdaten → HTTP 303, `Location: /`, Sitzungs-Cookie gesetzt · *Evidenz: Formular-POST, 251 ms; `/konto` zeigt danach die eigene Adresse*

### Schutz vor automatisiertem Erraten

- [x] **AC-7** — unbekannte Adresse und falsches Passwort ergeben denselben Satz „E-Mail-Adresse oder Passwort stimmt nicht." · *Evidenz: beide Wege einzeln, Meldungsmengen identisch und einelementig*
- [x] **AC-8** — 5 Fehlversuche je Adresse in 15 Min → der 6. abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." · *Evidenz: 8 Formular-POSTs, Versuch 6–8 gesperrt; danach unverändert **5** gezählte Zeilen — Weiterhämmern verlängert die Sperre nicht*
- [x] **AC-9** — die IP-Regel greift nur hinter erklärtem Proxy; ohne ihn trägt allein AC-8 · *Evidenz vierteilig:*
  - *(a) 5 Fehlversuche auf erfundene Adressen sperren die echte Anmeldung **nicht** → HTTP 303*
  - *(b) mit `p_ip` direkt: 5 Adressen von `203.0.113.7` → 6. Aufruf `(t, 900)`; `198.51.100.9` kommt durch (`f, 0`)*
  - *(c) ohne IP (`p_ip = NULL`): 7 Aufrufe auf 7 Adressen → **kein einziger** gesperrt, kein gemeinsamer Eimer*
  - *(d) gefälschter `X-Forwarded-For` (wechselnde IP) plus `X-Real-IP`: `ip`-Spalte bleibt in allen 7 Zeilen leer, gesperrt wird erst der 6. Versuch über die Adress-Regel*
- [x] **AC-10** — beide Formulare tragen `method="POST"` · *Evidenz: `<form … method="POST">` auf `/login` und `/signup`; keine Fundstelle, an der E-Mail, Passwort oder Token in eine URL geschrieben werden*
- [x] **AC-17** — 10 Registrierungsversuche je Herkunft in 60 Min, **gezählt werden Versuche** · *Evidenz: 12 Formular-POSTs auf eine vergebene Adresse — Versuch 11 und 12 gesperrt mit „Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in 60 Minuten erneut."; genau 10 gezählte `signup`-Zeilen, Kontenzahl unverändert 2. Zusätzlich an der Funktion: 11 Versuche ohne IP auf 11 verschiedene Adressen → der 11. `(t, 3600)`, der gemeinsame Eimer trägt also*
- [x] **AC-18** — Antwortzeiten ununterscheidbar **und** zügig · *Evidenz: 15 Messungen je Gruppe am aufgewärmten Produktions-Build, Zähler vor jeder Messung geleert → Median **358 ms gegen 358 ms = 0,00 %**, Bereiche 356–363 und 356–371 ms überlappen, **30 von 30 unter 500 ms** (Vorgabe ≥ 95 %), keine über 1 s, Maximum 371 ms*

### Zugriffsschutz

- [x] **AC-11** — abgemeldet: `/`, `/konto` und `/konto/export` → HTTP 307, `Location: /login`
- [x] **AC-12** — angemeldet: `/login` und `/signup` → HTTP 307, `Location: /`; die geschützten Seiten liefern demselben Cookie 200
- [x] **AC-13** — Konto A bekommt die Daten von B auch an der Datenbank-Schnittstelle vorbei nicht · *Evidenz mit zwei echten Konten und ihren JWTs: A liest `profiles` → nur die eigene Zeile; gezielt auf Bs ID → `[]`; UPDATE → `[]`; DELETE → `permission denied`; `login_attempts` angemeldet → HTTP 403, ohne Anmeldung → HTTP 401; `profiles` anonym → HTTP 401*

### Abmelden

- [x] **AC-14** — Abmelden → HTTP 303 auf `/login?reason=signed-out`, alle vier Sitzungs-Cookies geleert · *Evidenz: Formular-POST auf den Header-Knopf. Zurück-Button: das **alte** Cookie liefert auf `/` ein 307 auf `/login?reason=session-expired`, auf `/konto` eine 200-Streaming-Antwort, deren Rumpf **weder die E-Mail-Adresse noch „Konto löschen"** enthält, nur `NEXT_REDIRECT;replace;/login?reason=session-expired`. Alle vier Routen tragen `Cache-Control: no-store, must-revalidate`*
- [x] **AC-19** — **genau eine** Schaltfläche „Abmelden" je angemeldeter Seite, und sie steht im gemeinsamen Header · *Evidenz doppelt:*
  - *ausgeliefertes HTML, beide Seiten: `/` → 1 Treffer an Position 15206, zwischen den Header-Grenzen 13780/15735 und **vor** `<main>` (15744); `/konto` → 1 Treffer an 17069, Header 16305/17598, `<main>` bei 17607. Das Wort „Abmelden" kommt im ganzen Dokument je genau **einmal** vor*
  - *E2E Journey 3 prüft `toHaveCount(1)` auf `/` und `/konto` sowie `toHaveCount(0)` innerhalb von `main`*

### Kontolöschung und Aufbewahrung

- [x] **AC-15** — Löschung entfernt Konto, Profil **und alle zugehörigen Daten**; erneute Anmeldung schlägt fehl · *Evidenz: B löscht sich per RPC → HTTP 204; Konten 3→2, Profile 3→2, **Ausgaben 1→0** (die Löschweitergabe aus dem Datenmodell trägt); erneute Anmeldung als B → `invalid_credentials`; **A bleibt unberührt** (HTTP 200). Die Funktion nimmt kein Argument, `has_function_privilege('anon', …)` → `f`. Dialogweg durch E2E Journey 4*
- [x] **AC-16** — Zeilen älter als 24 h werden gelöscht, `login` **und** `signup` · *Evidenz: drei Zeilen eingefügt (2× 25 h alt, 1× 1 h) → `cleanup_login_attempts()` meldet 2, übrig bleibt die frische. `pg_cron`-Job `cleanup-login-attempts | 0 * * * * | active = t`*

**19 von 19 Acceptance Criteria erfüllt.**

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt genau ein Konto · *Evidenz: zwei gleichzeitige Registrierungen → 1 Konto. Der benannte Schutz ist der gesperrte Knopf: `disabled={isPending}`, `src/components/auth/signup-form.tsx:96` (Anmeldung ebenso, `login-form.tsx:89`). E2E Journey 1*
- [x] **EC-2** — beim Rennen gewinnt genau eine Registrierung, die andere erhält die Meldung aus AC-5 · *Evidenz: **3 Rennen** mit gemeinsamer Barriere → jedes Mal ein 303 und ein „Diese E-Mail-Adresse hat schon ein Konto."; je Adresse genau 1 Zeile in `auth.users`*
- [x] **EC-3** — Sitzungsgrenzen gesetzt (`timebox = "24h"`, `inactivity_timeout = "8h"`, `supabase/config.toml:287,289`); die Hinweiszeilen werden ausgeliefert · *Evidenz: `/login?reason=session-expired` → „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.", `?reason=deleted` → „Dein Konto ist gelöscht. Alles Gute!". `signed-out` ist bewusst ein Toast (`login-notice.tsx:20`) und steht deshalb nicht im HTML*
- [x] **EC-4** — bei angehaltener Datenbank je Weg eine eigene, verständliche Meldung · *Evidenz: `docker pause` auf **nur** den auslage-DB-Container → `/login` „Die Anmeldung ist gerade nicht möglich…", `/signup` „Die Registrierung ist gerade nicht möglich…", je 4 Messungen in **2,01–2,08 s** statt 60 s (die Frist aus TD-34 greift). Das eingegebene Passwort taucht im Antwortrumpf **nicht** auf, die Adresse bleibt stehen. Container danach wieder `healthy`, Anmeldung wieder 303*
- [x] **EC-5** — nach dem Löschen im ersten Tab liefert der zweite keinen geschützten Inhalt mehr · *Evidenz: Konto per RPC gelöscht (HTTP 204), dann mit dem alten Cookie `/` → 307 auf `/login?reason=session-expired`, `/konto` → 200 mit `NEXT_REDIRECT` und ohne E-Mail-Adresse. Kein „Application error", kein 500er*
- [x] **EC-6** — Randleerzeichen im Passwort werden bei Registrierung und Anmeldung identisch behandelt · *Evidenz: Registrierung mit `"  MitLeerzeichen1  "` → 303; Anmeldung **mit** → 303; **ohne** → „E-Mail-Adresse oder Passwort stimmt nicht."*
- [x] **EC-7** — kurze Rateversuche zählen zur Drosselung, die Meldung nennt die Passwortregel nicht · *Evidenz: Anmeldung mit `abc` → „E-Mail-Adresse oder Passwort stimmt nicht." und eine gezählte Zeile in `login_attempts`*

**7 von 7 Edge Cases erfüllt.**

---

## Security Audit

- [x] **Authentifizierungs-Umgehung** — `/`, `/konto` und `/konto/export` ohne Sitzung → je HTTP 307 auf `/login`, kein Inhalt
- [x] **Autorisierung über Kontogrenzen** — siehe AC-13; der gezielte Zugriff auf eine fremde ID liefert `[]` statt eines Fehlers, der die Existenz verriete
- [x] **Autorisierung auf den Ausgaben (PROJ-2, Regression)** — B legt eine Ausgabe an; A liest die Gesamtliste → `[]`, gezielt auf Bs `user_id` → `[]`, DELETE auf Bs Zeilen → `[]` und die Zeile ist danach **noch da**; anonym → HTTP 401
- [x] **Die Drosselungs-Tore bleiben fremdsteuerbar geschlossen** · *Evidenz sechsfach: 10 anonyme Aufrufe mit geratenem Geheimnis → **10× HTTP 401** und **0 Zeilen** in `login_attempts`, die echte Anmeldung danach → HTTP 303 · angemeldet ohne gültiges Geheimnis → HTTP 403 · Registrierungs-Tor anonym → HTTP 401 · die alte zweiargumentige Signatur existiert nicht mehr → `PGRST202` · `private.gate_secret` über die API → HTTP 404 · `set_gate_secret` → `PGRST202`*
- [x] **Ein falsches Geheimnis zählt auch nichts** — 10 Direktaufrufe der Funktion mit falschem Wert → 10× `gate secret mismatch`, danach **0 Zeilen** in `login_attempts`
- [x] **Das Geheimnis erreicht den Browser nicht** — *stärker geprüft als bisher: alle 13.033 druckbaren Zeichenketten ab Länge 16 aus `.next/static` und `public/` wurden SHA-256-gehasht und gegen den in der Datenbank hinterlegten Abdruck verglichen → **kein Treffer**. Der Klartext musste dafür nicht gelesen werden.* Ergänzend: 0 Treffer für `GATE_SECRET` in `.next/static` (die 4 in `.next/server` sind der Variablenname im Server-Code), 0 für `TRUSTED_PROXY_HOPS`
- [x] **Keine weiteren Secrets im Bundle** — 0 Treffer in `.next/static` für `service_role`, `sb_secret` und das JWT-Secret. Der Service-Role-Schlüssel kommt **im ganzen Repo nicht vor** (TD-6 hält). Nur zwei `NEXT_PUBLIC_`-Variablen im Code, beide sollen öffentlich sein
- [x] **Injection** — 5 Nutzlasten × 2 Wege (`x'; drop table public.login_attempts;--`, `' or '1'='1`, `<script>`, `"><img src=x onerror=…>`, und eine, die `private.set_gate_secret()` unterzuschieben versucht) · *Evidenz: alle scheitern an der Schema-Prüfung; `to_regclass('public.login_attempts')` unverändert, kein Konto entsteht, **der hinterlegte Abdruck ist unverändert**. Die Rückschreibung ins Formular ist maskiert: kein `<img`-Tag im Dokument, kein Attributausbruch, nur `&lt;img …&gt;`. `dangerouslySetInnerHTML` kommt im eigenen Quellcode nicht vor*
- [x] **Brute Force auf Zugangsdaten** — 6. Anmeldeversuch gesperrt, 11. Registrierungsversuch gesperrt; nach 8 Anmeldeversuchen unverändert 5 gezählte Zeilen
- [x] **Kontoexistenz wird nicht verraten (Anmeldung)** — gleiche Meldung *und* gleiche Antwortzeit (0,00 % Median-Abweichung), siehe AC-7 und AC-18
- [x] **Massenhaftes Anlegen von Konten** — durch AC-17 begrenzt, auch ohne erkennbare IP
- [x] **Zugangsdaten in der URL** — beide Formulare POSTen; keine Fundstelle im Code, die E-Mail, Passwort oder Token in eine URL schreibt
- [x] **Sicherheits-Header** — alle vier auf **allen fünf** Routen (`/`, `/konto`, `/login`, `/signup`, `/konto/export`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] **`.env`-Dateien im Repo** — nur `.env.local.example` ist versioniert; `.gitignore` deckt `.env` und `.env.*` ab
- [!] **Drosselung eines gewöhnlichen Endpunkts** — NOT VERIFIED: `/konto/export` (der einzige `route.ts` im Projekt, gehört zu PROJ-2) hat **keine** eigene Drosselung; 25 Aufrufe ohne Sitzung ergaben 25× HTTP 307, also nur den Zugriffsschutz. `design.md` (TD-22) entscheidet das ausdrücklich so — dort werden keine Zugangsdaten geprüft, und wer angemeldet ist, ruft nur eigene Zeilen ab. Für ein MVP vertretbar, aber **nicht als bestandene Prüfung** verbucht

**14 Prüfungen verifiziert, 1 NOT VERIFIED.** Keine davon negativ.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **164 Tests in 14 Dateien, alle grün** (Lauf 7: 72 in 5 Dateien; der Zuwachs kommt aus PROJ-2).
- **Lint:** `npm run lint` ohne Befund. **Build:** `npm run build` erfolgreich.
- **Neue Tests in diesem QA-Lauf:** keine — und das ist eine Entscheidung, keine Auslassung. AC-19 ist
  eine Aussage über die **Zusammensetzung einer Seite** („genau eine Schaltfläche, und zwar im
  Header"). Isolierte Logik, die sich in Vitest sinnvoll fassen ließe, entsteht dabei nicht; ein
  Unit-Test müsste das Rendern der Seite nachbauen und würde am Ende die Nachbildung prüfen statt
  das Produkt. Die Zusicherung gehört dorthin, wo sie hingehört: in E2E Journey 3.
- **Rot-Nachweis für die AC-19-Zusicherung — in diesem Lauf selbst geführt, nicht aus dem
  Build-Bericht übernommen.** Der zweite Abmelde-Knopf wurde testweise in `src/app/konto/page.tsx`
  zurückgebaut und Journey 3 erneut ausgeführt: der Test fällt an Zeile 126 mit
  `locator resolved to 2 elements — unexpected value "2"` — genau der Fehler, den AC-19 verhindern
  soll. Danach zurückgesetzt, Arbeitsbaum sauber (`git status` leer), Journey 3 wieder grün.

## E2E Tests

**18 von 18 grün** (Chromium und Mobile Safari, 1,1 min) — als Regression gegen den eigenen Dev-Server
auf Port 3200.

- [x] Journey 1: Registrieren (AC-11, AC-1, AC-2, EC-1) — `tests/PROJ-1-accounts-auth.spec.ts`
- [x] Journey 2: Anmelden (AC-6, AC-12)
- [x] Journey 3: **Genau ein Abmelden** und Schließen des Bereichs (AC-14, **AC-19**, AC-11)
- [x] Journey 4: Konto löschen über den Dialog (AC-15)
- [x] PROJ-2 Journeys 1–5 (AC-1 bis AC-27, EC-10, EC-11) — `tests/PROJ-2-expenses-monthly-overview.spec.ts`

## Regression

**Erstmals mit einem echten Nachbarn.** `features/INDEX.md` führt weiterhin kein Feature als
*Deployed*, aber PROJ-2 steht auf *Approved* — und AC-19 greift in **dessen** Header ein. Das ist die
Stelle, an der eine Änderung von PROJ-1 ein fremdes Feature beschädigen könnte, deshalb wurde dort
besonders geprüft:

- Der Header selbst ist **unverändert** (`git show e125ec0 --stat`: `app-header.tsx` nicht angefasst).
  Entfernt wurde nur der zweite Knopf aus der Konto-Karte; `LogoutButton` und die `logout()`-Action
  bleiben, und der Header rief seit PROJ-2 schon dieselbe Action auf — es gab nie einen zweiten Weg.
- `LogoutButton` ist **kein toter Code**: `app-header.tsx:3,43` verwendet die Komponente weiter.
- Alle 5 PROJ-2-Journeys grün, darunter der CSV-Export (AC-27) und „Niemand sieht die Zahlen einer
  anderen Person" (AC-24).
- Ausgaben-Isolation zusätzlich direkt an der Datenschnittstelle geprüft (siehe Security).
- Die Kontolöschung nimmt die Ausgaben mit (AC-15: 1 → 0), die Kette aus dem Datenmodell hält.

PROJ-1 gegen sich selbst: alle 19 AC und 7 EC in diesem Lauf neu geprüft, nichts aus Lauf 7 übernommen.

---

## Not Verified In This Run

- [!] **Drosselung eines gewöhnlichen Endpunkts** — `/konto/export` hat keine; bewusst so entschieden (TD-22), aber nicht als Prüfung bestanden.
- [!] **Ein vollständiger Neuaufbau der Datenbank** (`supabase db reset`) — nicht ausgeführt, weil er das Demo-Konto **und den hinterlegten Abdruck des Tor-Geheimnisses** löschen würde; letzteren könnte ich ohne den Klartext aus `.env.local` nicht wiederherstellen. Die acht Migrationen sind einzeln sauber eingespielt, die Kette von null wurde nicht durchgespielt.
- [!] **Wie die Seiten aussehen** — Markup und CSS sind geprüft, das Bild nicht. Insbesondere ist **nicht** geprüft, ob der Abmelde-Knopf im Header optisch gut sitzt, seit die Konto-Karte nur noch die E-Mail-Adresse trägt.
- [!] **Darstellung auf verschiedenen Bildschirmbreiten** (375 / 768 / 1440 px) — kein Viewport in `/qa`. Die E2E-Suite läuft immerhin in Mobile Safari (iPhone 13), prüft dort aber Verhalten, nicht Layout.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Alles, was die Entwicklerwerkzeuge braucht** — Konsolenausgaben, Netzwerk-Tab, berechnete Stile.
- [!] **Rein clientseitige Interaktionen** — Fokusführung im Löschdialog, Tastaturbedienung, Animationen. Für AC-19 relevant: dass die **eine** verbleibende Schaltfläche mit der Tastatur erreichbar ist, wurde nicht geprüft.
- [!] **Der tatsächliche Ablauf der Sitzung nach 8 bzw. 24 Stunden** (EC-3) — geprüft sind die gesetzten Werte und die Hinweiszeile, nicht das Verstreichen der Zeit.
- [!] **Der Klartext in `.env.local`** — die Datei ist für Claude gesperrt und wurde nicht gelesen. Dass der Wert dort steht und trägt, ist indirekt belegt (Server ohne `GATE_SECRET` gestartet, Anmeldung funktioniert); dass er dort in einer *bestimmten Form* steht, nicht.

---

## Bugs

### BUG-1: `GATE_SECRET` fehlt in `.env.local.example`

- **Severity:** Medium · **Status:** **behoben am 31.08.2026** · **Betrifft:** AC-8, AC-9, AC-17 (Einrichtung, nicht Laufzeit)
- **Was passiert:** `src/lib/rate-limit.ts:128` liest `process.env.GATE_SECRET`. Die Variable ist
  **nicht** in `.env.local.example` dokumentiert — dort steht nur `TRUSTED_PROXY_HOPS=0` (aus T24).
  Wer das Projekt frisch auscheckt und der Beispieldatei folgt, bekommt eine Anwendung, in der
  **Anmeldung und Registrierung vollständig gesperrt sind**: die Tore fallen ohne passendes
  Geheimnis absichtlich zu (fail closed, TD-26), und der einzige Hinweis ist eine Zeile im
  Server-Log. Aus der Beispieldatei allein ist weder ersichtlich, dass die Variable existiert, noch
  dass ohne sie nichts geht.
- **Warum das ein Befund ist und keine Kleinigkeit:** Es ist genau das, was die Planung selbst
  verlangt hat, und an zwei Stellen schriftlich:
  - `design.md:512` — „Beide gehören ohne `NEXT_PUBLIC_`-Präfix in `.env.local.example`" (die
    Tabelle darüber führt `TRUSTED_PROXY_HOPS` **und** `GATE_SECRET`).
  - `tasks.md:167` — „`GATE_SECRET` gehört als Platzhalter in dieselbe Datei und damit in dieselbe
    Hand-off."
  Dazu die Projektregel in `.claude/rules/security.md` → *Code Review Triggers*: „Any **new
  environment variable** must be documented in the example env file."
  T24 hat nur die eine Variable abgedeckt; für die zweite wurde nie eine Aufgabe angelegt.
- **Reproduktion:** Repository frisch klonen, `.env.local` allein nach `.env.local.example` befüllen,
  `npm run dev` → jede Anmeldung und jede Registrierung endet mit „Die Anmeldung ist gerade nicht
  möglich…", obwohl Supabase läuft und die Zugangsdaten stimmen.
- **Warum Medium und nicht High:** Keine laufende Installation ist betroffen — die bestehende
  Umgebung hat den Wert, alle 19 AC sind damit erfüllt. Es ist auch **keine** Sicherheitslücke: das
  Zufallen ohne Geheimnis ist die bewusst gewählte, sichere Richtung. Was fehlt, ist die
  Dokumentation einer Pflichtvariablen — der Schaden trifft die nächste Einrichtung, nicht den
  Betrieb. **Damit blockiert der Befund die Freigabe nicht** (nur Critical und High tun das), er
  steht aber als erste Aufgabe danach.
- **Nicht zu verwechseln mit einer offenen `[user]`-Aufgabe auf dem Zugangsdaten-Pfad** — das wäre
  ein High-Befund. T24 und T36 sind beide erledigt **und in diesem Lauf verifiziert**; der Schutz ist
  vorhanden und wirkt. Für die Beispieldatei wurde schlicht nie eine zweite Aufgabe angelegt.
- **Warum nicht Low:** Die Folge ist kein Schönheitsfehler, sondern der vollständige Ausfall des
  Feature-Kerns in einer frischen Umgebung, und eine ausdrücklich formulierte Projektregel wird
  verletzt.
- **Nachtrag vom 31.08.2026 — behoben (T40).** `.env.local.example` trägt jetzt die
  Platzhalter-Zeile `GATE_SECRET=your_gate_secret_here`, darüber als Kommentar: dass beide Hälften
  nötig sind (Wert in `.env.local`, derselbe Wert per `select private.set_gate_secret('…');` in der
  Datenbank), dass ohne sie Anmeldung und Registrierung absichtlich stillstehen, und warum das
  `NEXT_PUBLIC_`-Präfix hier fehlen muss. Damit steht die Variable dort, wo `design.md:512`,
  `tasks.md:167` und `.claude/rules/security.md` sie verlangen.
- **Am Code war nichts zu ändern, und an der Umgebung nichts nachzutragen.** Die Beispieldatei wird
  zur Laufzeit von niemandem gelesen; sie dokumentiert nur. Dass die bestehende Installation den Wert
  bereits hat, ist in diesem Lauf zusätzlich belegt: `GATE_SECRET` ist **nicht** in der
  Shell-Umgebung gesetzt, und die Anmeldung ging trotzdem durch — der Wert kann also nur aus
  `.env.local` stammen (Datei zuletzt am 29.08.2026 geändert, dem Tag von TD-26).

---

## Beobachtung ohne Bug-Status

**Die Kontosperre aus AC-8 bleibt für jede:n auslösbar, der eine E-Mail-Adresse kennt** — über das
Anmeldeformular, fünf Absendungen. Keine Lücke in der Umsetzung, sondern eine Eigenschaft der Regel:
Wer je Konto drosselt, gibt jedem die Möglichkeit, dieses Konto 15 Minuten zu blockieren. Der billige
direkte Weg ist seit TD-26 zu. Die Gegenmaßnahme wäre ein CAPTCHA; steht in `spec.md` als offene Frage.

**Die Testlücke aus Lauf 7 besteht unverändert.** Dass ein abgelehnter Tor-Aufruf **keine Zeile**
schreibt, ist eine Eigenschaft der Datenbankfunktion; Vitest ersetzt den Supabase-Client, die
E2E-Suite deckt die Drosselung bewusst nicht ab. In diesem Lauf wieder live nachgewiesen (10
Angriffsaufrufe → 0 Zeilen), aber kein automatischer Test bewacht sie. Ein dauerhafter Wächter
bräuchte einen Testweg gegen die echte Datenbank, den das Projekt heute nicht hat.

**Die Konto-Karte trägt jetzt nur noch die E-Mail-Adresse.** Das ist die bewusste Folge von AC-19
(TD-27) und inhaltlich richtig — aber es ist eine sehr leere Karte, und wie sie wirkt, konnte hier
nicht beurteilt werden (siehe *Not Verified*). Eine Frage ans Produkt, kein Fehler.

---

## Summary

- **Acceptance Criteria:** **19 von 19 erfüllt**, 0 nicht verifiziert
- **Edge Cases:** **7 von 7 erfüllt**
- **Bugs:** 0 Critical · 0 High · 1 Medium · 0 Low — **BUG-1 noch am selben Tag behoben** (T40), damit steht aus diesem Durchlauf **kein** Befund mehr offen
- **Geschlossen:** BUG-1 Low aus Lauf 7 (AC-18) — durch das `/refine`, die Messung erfüllt die neue Fassung
- **Security:** **14 Prüfungen verifiziert, 1 NOT VERIFIED**, keine negativ
- **Tests:** 164 Unit-/Integrationstests grün · 18 von 18 E2E grün · Lint und Build grün · Rot-Nachweis für AC-19 in diesem Lauf geführt
- **Production Ready:** **JA** — kein Critical- und kein High-Befund, alle 19 AC in diesem Lauf gegen
  die laufende Anwendung ausgeführt, und der eine Medium-Befund ist behoben.

**Das „JA" ist eine Aussage über gefundene Fehler, nicht über vollständige Abdeckung.**

- **Der Medium-Befund ist geschlossen** (BUG-1, T40) — nachgewiesen ist die ergänzte Zeile in
  `.env.local.example`, nicht ein erneut durchgespieltes Aufsetzen aus dem leeren Verzeichnis.
- **Die Liste unter *Not Verified In This Run* ist nicht leer.** Insbesondere wurde **nicht geprüft,
  wie die Seiten aussehen** — weder auf verschiedenen Bildschirmbreiten noch in anderen Browsern als
  Chromium und WebKit. Gerade bei AC-19 ist das relevant: Dass **genau eine** Schaltfläche im Markup
  steht, ist bewiesen; dass sie im Header gut sitzt und die nun fast leere Konto-Karte trägt, ist
  eine Frage ans Auge und offen.
- **Ein vollständiger Neuaufbau der Datenbank aus den Migrationen wurde bewusst nicht durchgespielt.**
