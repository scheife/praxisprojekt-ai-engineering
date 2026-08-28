# QA-Bericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-28 (fünfter Durchlauf, nach der Umsetzung des `/refine`)
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf Port 55321
**Grundlage:** `spec.md` (18 AC, 7 EC) in der Fassung vom 28.08.2026 · `design.md` nach `/architecture`

> **Wie geprüft wurde.** Die Server Actions wurden über den echten Formularweg aufgerufen — GET der
> Seite, die versteckten `$ACTION_*`-Felder auslesen, multipart-POST auf dieselbe URL. Das ist
> derselbe Weg, den ein Browser ohne JavaScript geht, und damit der Produktionspfad statt eines
> Umwegs über die API. Datenbankfunktionen wurden zusätzlich direkt geprüft, wo eine IP frei
> übergeben werden musste.

---

## Was dieser Durchlauf gegenüber dem letzten bestätigt

| Befund aus Lauf 4 | Stand jetzt |
|---|---|
| **BUG-1 High** — fünf Anfragen sperren die Anmeldung für alle | **geschlossen.** Fünf Fehlversuche auf frei erfundene Adressen, danach echte Anmeldung → HTTP 303, angemeldet. Gegenprobe: alter Funktionsstand in einer Transaktion wiederhergestellt → sperrt 900 s, `rollback` |
| **BUG-3 Low** — AC-17 zählt Versuche statt angelegter Konten | **geschlossen** — durch `/refine` am Vertrag und die neue Meldung. Elf Versuche auf eine bereits vergebene Adresse (kein Konto entsteht) lösen die Sperre aus |
| **BUG-2 Medium** — die Drosselungs-Tore sind direkt aufrufbar | **steht unverändert**, bewusst (TD-25) — in diesem Lauf erneut ausgelöst |
| **BUG-3 (Lauf 4) — AC-18 reißt in Ausreißern über 500 ms** | **in diesem Lauf nicht reproduziert.** 30 Messungen seriell und 36 unter Last (4 und 8 parallel): kein einziger Wert ≥ 500 ms, Maximum 399 ms. Der frühere Befund stammt aus einer Messung gegen `next dev` |

---

## Acceptance Criteria

### Registrierung

- [x] **AC-1** — Registrierung mit gültigen Daten → HTTP 303, Konto angelegt, Sitzungs-Cookie gesetzt · *Evidenz: Formular-POST auf `/signup`, danach `select … from auth.users`*
- [x] **AC-2** — Profilzeile entsteht ohne weiteren Schritt · *Evidenz: `select u.email, (p.id is not null) from auth.users u left join public.profiles p …` → `t`*
- [x] **AC-3** — Passwort mit 9 Zeichen → „Dein Passwort braucht mindestens 10 Zeichen." am Feld, kein Konto · *Evidenz: Formular-POST; `auth.users` unverändert*
- [x] **AC-4** — kaputtes E-Mail-Format → „Bitte gib eine gültige E-Mail-Adresse ein." am Feld · *Evidenz: Formular-POST mit `keine-email`*
- [x] **AC-5** — vergebene Adresse → „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", kein zweites Konto · *Evidenz: Formular-POST, Kontostand vorher/nachher gleich*

### Anmeldung

- [x] **AC-6** — richtige Zugangsdaten → HTTP 303 mit Sitzungs-Cookie `sb-127-auth-token`; `/konto` zeigt die eigene Adresse · *Evidenz: Formular-POST, danach GET `/konto`*

### Schutz vor automatisiertem Erraten

- [x] **AC-7** — unbekannte Adresse und falsches Passwort ergeben denselben Satz „E-Mail-Adresse oder Passwort stimmt nicht." · *Evidenz: je 15 Messungen, Meldungsmenge beider Gruppen identisch und einelementig*
- [x] **AC-8** — 5 Fehlversuche je Adresse in 15 Min → der 6. wird abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." · *Evidenz: 6 Formular-POSTs auf dieselbe Adresse*
- [x] **AC-9** — die IP-Regel greift nur hinter erklärtem Proxy; **ohne ihn trägt allein AC-8, und kein Versuch wandert in einen gemeinsamen Zähler** · *Evidenz: (a) 5 Fehlversuche auf erfundene Adressen sperren eine echte Anmeldung **nicht** (HTTP 303); (b) mit `p_ip` direkt: 5 Adressen von `203.0.113.7` → 6. gesperrt, andere IP kommt durch; (c) gefälschter `X-Forwarded-For` mit wechselnder IP hilft nicht — ab dem 6. Versuch gesperrt*
- [x] **AC-10** — beide Formulare tragen `method="POST"`; E-Mail und Passwort erscheinen in keiner URL · *Evidenz: `<form … method="POST">` im ausgelieferten HTML von `/login` und `/signup`*
- [x] **AC-17** — 10 Registrierungsversuche je Herkunft in 60 Min, **gezählt werden Versuche**; der 11. wird abgelehnt, die Meldung spricht von Versuchen · *Evidenz: 11 Formular-POSTs auf eine **bereits vergebene** Adresse — kein einziges Konto entsteht, der 11. wird gesperrt: „Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in 60 Minuten erneut."*
- [x] **AC-18** — Antwortzeiten ununterscheidbar, unter 500 ms · *Evidenz: Median 361 ms (registriert) gegen 358 ms (unbekannt) = **0,8 %** Abweichung, Bereiche 357–377 und 355–388 ms überlappen, 0 von 30 Antworten ≥ 500 ms; unter Last (4 und 8 parallel, 36 Messungen) Maximum 399 ms*

### Zugriffsschutz

- [x] **AC-11** — abgemeldet: `/` und `/konto` → HTTP 307, `Location: /login` · *Evidenz: `curl -i`*
- [x] **AC-12** — angemeldet: `/login` und `/signup` → HTTP 307, `Location: /` · *Evidenz: GET mit Sitzungs-Cookie*
- [x] **AC-13** — Konto A bekommt die Daten von B auch an der Datenbank-Schnittstelle vorbei nicht · *Evidenz: A liest `profiles` → nur die eigene Zeile; gezielte Abfrage auf Bs ID → `[]`; UPDATE auf B → `[]`; DELETE → `permission denied`; ohne Anmeldung → `permission denied for table profiles`*

### Abmelden

- [x] **AC-14** — Abmelden beendet die Sitzung (HTTP 303), `/konto` danach → 307 auf `/login`; geschützte Seiten tragen `Cache-Control: no-store, must-revalidate`; der Zurück-Button holt die Kontoseite nicht zurück · *Evidenz: Formular-POST + `curl -I`; Zurück-Button durch E2E Journey 3 (`page.goBack()`, 8/8 grün in diesem Lauf)*

### Kontolöschung und Aufbewahrung

- [x] **AC-15** — Löschung entfernt Konto, Profil und Sitzung; erneute Anmeldung schlägt fehl · *Evidenz: RPC → HTTP 204; `auth.users` 0, `profiles` 0; erneute Anmeldung → `invalid_credentials`. Die Funktion nimmt **kein Argument** (`pg_get_function_identity_arguments` leer) — ein fremdes Konto ist nicht adressierbar. Dialogweg zusätzlich durch E2E Journey 4 belegt*
- [x] **AC-16** — Zeilen älter als 24 h werden gelöscht, `login` **und** `signup` · *Evidenz: drei Zeilen eingefügt (25 h alt ×2, 1 h alt ×1) → nach `cleanup_login_attempts()` bleibt nur die frische. Stündlicher `pg_cron`-Job `0 * * * *` vorhanden; keine Rechte für `anon`/`authenticated` auf die Aufräumfunktion*

**18 von 18 Acceptance Criteria erfüllt.**

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt genau ein Konto · *Evidenz: zwei gleichzeitige Registrierungen → 1 Konto in `auth.users`; im Browser zusätzlich durch den während des Absendens gesperrten Button (E2E Journey 1)*
- [ ] **EC-2** — **FEHLGESCHLAGEN.** Genau ein Konto entsteht, aber der Verlierer des Rennens sieht **nicht** die Meldung aus AC-5, sondern „Die Registrierung ist gerade nicht möglich." → **BUG-1**
- [x] **EC-3** — Sitzungsgrenzen gesetzt (`timebox = "24h"`, `inactivity_timeout = "8h"`); `/login?reason=session-expired` zeigt „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." · *Evidenz: `supabase/config.toml:277,279`; `curl` auf `/login?reason=session-expired`*
- [x] **EC-4** — bei angehaltener Datenbank erscheint je Weg eine eigene, verständliche Meldung; das Passwort taucht in der Antwort nicht auf und liegt wegen POST auch nicht in der URL · *Evidenz: `docker pause` auf DB- und Auth-Container → `/login`: „Die Anmeldung ist gerade nicht möglich…", `/signup`: „Die Registrierung ist gerade nicht möglich…"; Passwort nicht im Antwortrumpf*
- [x] **EC-5** — nach dem Löschen im ersten Tab liefert der zweite **keinen** geschützten Inhalt mehr, sondern die Weiterleitung auf `/login?reason=session-expired` · *Evidenz: Auth-Server lehnt das gelöschte Konto ab (403 `user_not_found`); die Antwort enthält `NEXT_REDIRECT;replace;/login?reason=session-expired;307` samt `meta http-equiv="refresh"`, und weder die Adresse noch „Konto löschen" stehen darin. Kein Absturz*
- [x] **EC-6** — Randleerzeichen im Passwort werden bei Registrierung und Anmeldung identisch behandelt · *Evidenz: Registrierung mit `"  MitLeerzeichen1  "` → 303; Anmeldung **mit** Leerzeichen → 303; **ohne** → abgelehnt*
- [x] **EC-7** — kurze Rateversuche zählen zur Drosselung, die Meldung nennt die Passwortregel nicht · *Evidenz: 6 Anmeldeversuche mit dem Passwort `abc` → 5 Zeilen in `login_attempts`, der 6. gesperrt, Meldung durchgehend „E-Mail-Adresse oder Passwort stimmt nicht."*

**6 von 7 Edge Cases erfüllt.**

---

## Security Audit

- [x] **Authentifizierungs-Umgehung** — geschützte Routen ohne Sitzung → 307 auf `/login`, kein Inhalt · *Evidenz: `curl -i` auf `/` und `/konto`*
- [x] **Autorisierung über Kontogrenzen** — siehe AC-13; auch der gezielte Zugriff auf eine fremde ID liefert `[]` statt eines Fehlers, der die Existenz verriete
- [x] **Zugriff ohne jede Anmeldung** — `profiles` und `login_attempts` antworten dem öffentlichen Schlüssel mit `permission denied` (HTTP 401) · *Evidenz: `curl` auf `/rest/v1/profiles` und `/rest/v1/login_attempts` nur mit `apikey`*
- [x] **Injection** — XSS- und SQL-Nutzlasten scheitern an der Schema-Prüfung, nichts wird gespeichert, `login_attempts` unverändert vorhanden · *Evidenz: 4 Nutzlasten inkl. `x'; drop table public.login_attempts;--`; Rückschreibung ins Formular ist escaped (`&lt;img src=x onerror=alert(1)&gt;`), kein rohes Markup*
- [x] **Brute Force auf Zugangsdaten** — greift: 6. Anmeldeversuch gesperrt, 11. Registrierungsversuch gesperrt; Weiterhämmern verlängert die Sperre **nicht** (nach 20 zusätzlichen Aufrufen unverändert 900 s Restzeit, weiterhin 5 gezählte Zeilen)
- [x] **Kontoexistenz wird nicht verraten (Anmeldung)** — gleiche Meldung *und* gleiche Antwortzeit, siehe AC-7 und AC-18
- [x] **Massenhaftes Anlegen von Konten** — durch AC-17 begrenzt, auch ohne erkennbare IP (gemeinsamer Eimer, TD-23)
- [x] **Secrets im ausgelieferten Bundle** — kein `service_role`-JWT, kein `sb_secret`, kein `TRUSTED_PROXY_HOPS` in `.next/static`; nur `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` im Code · *Evidenz: `grep -rl` über `.next/static` und `.next/server`; einziger `service_role`-Treffer im Quellcode ist ein Kommentar in `src/lib/actions/account.ts:25`, der seine Abwesenheit erklärt*
- [x] **Zugangsdaten in der URL** — beide Formulare POSTen; keine Zugangsdaten in Query-Strings · *Evidenz: Formular-Markup, siehe AC-10*
- [x] **Sicherheits-Header** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` auf allen vier Routen · *Evidenz: `curl -I`*
- [x] **`.env`-Dateien im Repo** — nur `.env.local.example` ist versioniert · *Evidenz: `git ls-files | grep -i '\.env'`*
- [ ] **Die Drosselungs-Tore sind unauthentifiziert aufrufbar** — **BUG-2**, bewusst offen (TD-25). In diesem Lauf erneut ausgelöst
- [!] **Drosselung gewöhnlicher Endpunkte** — NOT VERIFIED: PROJ-1 hat außer den Auth-Wegen keine eigenen Endpunkte

**13 Prüfungen verifiziert, 1 NOT VERIFIED.** Eine der verifizierten ist als BUG-2 negativ ausgefallen.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **52 Tests in 5 Dateien, alle grün** (vorher 45).
  - **In diesem Durchlauf ergänzt: `src/lib/actions/auth.test.ts` (7 Tests).** Die Lücke war eine echte:
    AC-7 und AC-17 machen **den Wortlaut** zur Zusage, und für den Wortlaut gab es keinen einzigen
    Test — er wäre beim nächsten Umformulieren still gebrochen. Abgedeckt sind jetzt: die
    Registrierungssperre spricht von Versuchen und nennt weder „Konten angelegt" noch „diese
    Verbindung" · Singular/Plural bei der Restzeit · eine gesperrte Registrierung legt gar kein Konto
    an (`signUp` wird nicht aufgerufen) · unbekannte Adresse und falsches Passwort ergeben denselben
    Satz · ein kurzes Passwort verrät die Passwortregel nicht und läuft durchs Tor statt am Schema zu
    scheitern · getrennte Meldungen je Weg bei nicht erreichbarer Datenbank.
  - **Rot-Nachweis geführt** (drei Runden, jeder der 7 neuen Tests war mindestens einmal rot): alter
    Meldungstext wiederhergestellt → 2 rot · Pluralisierung und Gate-Abbruch entfernt, Anmeldung
    unterscheidet nach Adresse → 4 rot · `LOGIN_UNAVAILABLE` geändert und Mindestlänge beim Anmelden
    zurückgedreht → 4 rot (darunter auch der bestehende EC-7-Test). Danach jeweils wiederhergestellt,
    52 grün, Arbeitsbaum sauber.
- **Lint:** `npm run lint` ohne Befund.
- **Build:** `npm run build` erfolgreich.

## E2E Tests

**8 von 8 grün** (Chromium und Mobile Safari, 43,9 s) — die bestehende Suite aus `/e2e-tests`, in
diesem Lauf als Regression gegen den **Produktions-Server** ausgeführt. Journeys: Registrieren ·
Anmelden · Abmelden inkl. Zurück-Button · Konto löschen über den Bestätigungsdialog.

Die Drosselung (AC-8, AC-9, AC-17) ist dort weiterhin bewusst nicht abgedeckt — sie wird gezielt
gegen die Datenbankfunktionen geprüft, wo eine IP frei übergeben werden kann.

## Regression

`features/INDEX.md` führt **kein** Feature mit Status *Deployed*; PROJ-2 und PROJ-3 stehen auf
*Roadmap*. Es gibt daher keine fremden Features, die brechen könnten. Die Regression von PROJ-1 gegen
sich selbst ist oben abgedeckt: alle 18 AC und 7 EC in diesem Lauf neu geprüft, 52 Unit-Tests, 8 E2E.

---

## Not Verified In This Run

- [!] **Darstellung auf verschiedenen Bildschirmbreiten** (375 / 768 / 1440 px) — kein Viewport in `/qa`. Die E2E-Suite läuft immerhin auf einem iPhone-13-Profil und ist grün, prüft aber Abläufe, keine Gestaltung.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Alles, was die Entwicklerwerkzeuge braucht** — Konsolenausgaben, Netzwerk-Tab, berechnete Stile.
- [!] **Rein clientseitige Interaktionen** — Fokusführung im Löschdialog, Tastaturbedienung, Animationen.
- [!] **`T24` (`[user]`): die Zeile `TRUSTED_PROXY_HOPS=0` in `.env.local.example`** — die Datei ist in dieser Sitzung nicht lesbar (Berechtigung gesperrt), der Haken stammt aus einem früheren Lauf. **Die Schutzwirkung selbst ist verifiziert**, denn sie hängt nicht an der Datei: ohne gesetzte Variable gilt die sichere Vorgabe `0`, und der gefälschte `X-Forwarded-For` wurde nachweislich ignoriert. Offen ist nur die Dokumentationszeile.
- [!] **Der tatsächliche Ablauf der Sitzung nach 8 bzw. 24 Stunden** (EC-3) — geprüft sind die gesetzten Werte und die Hinweiszeile, nicht das Verstreichen der Zeit.
- [!] **Drosselung gewöhnlicher Endpunkte** — PROJ-1 hat keine.

---

## Bugs

### BUG-1: Beim Registrierungs-Rennen erscheint die falsche Meldung

- **Severity:** Medium · **Status:** offen · **Betrifft:** EC-2 · `src/lib/actions/auth.ts:191`
- **Was passiert:** Treffen zwei Registrierungen mit derselben Adresse gleichzeitig ein, entsteht
  korrekt **genau ein** Konto — die Datenintegrität hält. Der Verlierer sieht aber
  „Die Registrierung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal."
  statt der in EC-2 ausdrücklich zugesagten Meldung aus AC-5
  („Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.").
- **Reproduktion:** Zwei gleichzeitige POSTs auf `/signup` mit derselben, noch freien Adresse.
  3 von 3 Läufen identisch.
- **Ursache, im Auth-Log nachgelesen statt vermutet:** Supabase Auth antwortet im Rennen mit
  **HTTP 500 / `error_code: unexpected_failure`**; darunter liegt
  `duplicate key value violates unique constraint "users_email_partial_key"` (SQLSTATE 23505).
  Der Zweig im Code prüft auf `error.code === 'user_already_exists' || error.status === 422` —
  beides trifft hier nicht zu, also fällt der Fall in den allgemeinen `SIGNUP_UNAVAILABLE`-Zweig.
  Der sequentielle Fall (Adresse war schon vorher vergeben) liefert dagegen sauber 422 und ist
  deshalb nie aufgefallen.
- **Warum nicht höher eingestuft:** Kein Datenverlust, kein zweites Konto, kein Sicherheitsproblem.
  Ein zweiter Versuch zeigt sofort die richtige Meldung. Es trifft nur, wer zweimal in derselben
  Sekunde absendet.
- **Warum trotzdem ein Bug:** EC-2 sagt die AC-5-Meldung wörtlich zu, und der Kommentar an genau
  dieser Codestelle behauptet, der Fall werde hier abgefangen. Er wird es nicht.

### BUG-2: Die Drosselungs-Tore lassen sich unauthentifiziert aufrufen

- **Severity:** Medium · **Status:** offen — **bewusst**, siehe `design.md` TD-25 und die Open
  Questions in `spec.md`
- **Betrifft:** AC-8, AC-9, AC-17 · `grant execute … to anon` auf beiden Toren
- **Was passiert:** Fünf anonyme Aufrufe von `login_attempt_gate` mit einer fremden Adresse sperren
  deren Anmeldung für 15 Minuten. In diesem Lauf erneut ausgelöst: nach fünf RPC-Aufrufen antwortete
  das Formular mit „Zu viele Fehlversuche."
- **Warum Medium und nicht High:** Dieselbe Sperre lässt sich ohnehin über das Anmeldeformular
  auslösen — fünf Absendungen mit der fremden Adresse genügen. Der RPC-Weg macht es billiger, nicht
  erst möglich. Zudem **verlängert Weiterhämmern die Sperre nicht** (nachgemessen: nach 20
  zusätzlichen Aufrufen unverändert 900 s Restzeit), die Aussperrung ist also auf 15 Minuten je
  Angriffswelle begrenzt.
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
- **Edge Cases:** **6 von 7 erfüllt** — EC-2 fehlgeschlagen (BUG-1)
- **Bugs:** 0 Critical · 0 High · **2 Medium** (BUG-1 neu, BUG-2 bekannt und bewusst offen) · 0 Low
- **Behoben und in diesem Lauf bestätigt:** BUG-1 (High) und BUG-3 (Low) aus Lauf 4
- **Security:** **13 Prüfungen verifiziert, 1 NOT VERIFIED**; eine der verifizierten ist als BUG-2
  negativ ausgefallen
- **Tests:** 52 Unit-/Integrationstests grün (7 neu, Rot-Nachweis geführt) · 8 von 8 E2E grün ·
  Lint und Build grün
- **Production Ready:** **JA** — kein Critical- oder High-Befund, und alle 18 AC wurden in diesem
  Lauf tatsächlich gegen die laufende Anwendung ausgeführt.

**Das „JA" ist eine Aussage über gefundene Fehler, nicht über vollständige Abdeckung.** Zwei Medium-
Befunde stehen offen, und die Liste unter *Not Verified In This Run* ist nicht leer — insbesondere
wurde die Darstellung auf verschiedenen Bildschirmbreiten und in anderen Browsern nicht geprüft, und
BUG-2 gehört vor dem ersten öffentlichen Zugang geschlossen.
