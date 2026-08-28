# QA-Testbericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-28 (vierter Durchlauf, nach der Behebung von BUG-4)
**App-Adresse:** `http://localhost:3000` — **Produktions-Build** (`npm run build && npm run start`), Supabase in Docker auf Port 55321
**Konfiguration:** Vorgabe, also ohne gesetztes `TRUSTED_PROXY_HOPS` (= 0, kein vertrauenswürdiger Proxy)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt nachgewiesen ·
> `[!] NICHT VERIFIZIERT` in diesem Durchlauf nicht prüfbar (mit Grund)

Alle Prüfungen liefen neu gegen die laufende App — nichts ist aus den Vorberichten übernommen.
Ausgangslage: Datenbank auf 0 Konten zurückgesetzt, Drosselungs-Zähler zwischen den Messungen
geleert. Prüfskripte im Scratchpad unter `qa/r4_*.py`.

---

## Was aus dem letzten Durchlauf geschlossen wurde

| Befund (3. Lauf) | Ergebnis dieses Laufs |
|---|---|
| **BUG-4 High** — der Klick auf „Endgültig löschen" löste nichts aus | **geschlossen.** Unabhängig nachgemessen: E2E 8 von 8 grün, Journey 4 auf Chrome **und** Mobile Safari. Gegenprobe: alten Zustand hergestellt → Journey 4 fällt an genau derselben Zeile, Behebung zurück → grün |
| **BUG-1 High** — fünf Anfragen sperren die Anmeldung für alle | **steht unverändert** (bewusst, gehört zu `/refine`) — in diesem Lauf erneut ausgelöst |
| **BUG-2 Medium** — die Drosselungs-Tore sind direkt aufrufbar | **steht unverändert** — fünf anonyme RPC-Aufrufe sperren ein fremdes Konto, erneut nachgewiesen |
| **BUG-3 Low** — AC-17 zählt Versuche statt angelegter Konten | **steht unverändert** — erneut nachgewiesen |

---

## Acceptance Criteria

### Registrierung

#### AC-1 — Konto anlegen, sofort angemeldet, landet auf `/`
- [x] `HTTP 303`, `location: /` (821 ms); danach `/` mit `HTTP 200` — Beleg: `qa/r4_func.py`
- [x] Auch über den Browser: Journey 1 der E2E-Suite, beide Projekte — Beleg: `tests/PROJ-1-accounts-auth.spec.ts`

#### AC-2 — Profilzeile entsteht ohne weiteren Schritt
- [x] Genau **eine** `profiles`-Zeile zur neuen Nutzer-ID — Beleg: `qa/r4_func.py`; Trigger in `20260827120000_profiles.sql:60`
- [x] Zusätzlich im Browser gegen die Datenbank geprüft — Beleg: E2E Journey 1 (`countProfiles`)

#### AC-3 — Passwort unter 10 Zeichen wird abgelehnt
- [x] „Dein Passwort braucht mindestens 10 Zeichen.", **0** Konten — Beleg: `qa/r4_func.py`
- [x] Dritte Prüfung in der Datenbank: `GOTRUE_PASSWORD_MIN_LENGTH=10` — Beleg: `docker exec supabase_auth_… env`
- [x] 9 abgelehnt, 10 angenommen — Beleg: `src/lib/validation/auth.test.ts`

#### AC-4 — Ungültiges E-Mail-Format wird abgelehnt
- [x] „Bitte gib eine gültige E-Mail-Adresse ein.", **0** Konten — Beleg: `qa/r4_func.py`

#### AC-5 — Adresse bereits vergeben
- [x] „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", danach weiterhin **ein** Konto — Beleg: `qa/r4_func.py`

### Anmeldung

#### AC-6 — Anmeldung mit richtigen Daten
- [x] `HTTP 303`, `location: /` (299 ms); `/konto` zeigt die eigene Adresse — Beleg: `qa/r4_func.py`
- [x] Im Browser bestätigt — Beleg: E2E Journey 2, beide Projekte

### Schutz vor automatisiertem Erraten

#### AC-7 — Fehlermeldung verrät nicht, ob die Adresse existiert
- [x] Bekannte und unbekannte Adresse ergeben denselben Satz — Beleg: `qa/r4_func.py`
- [x] Auch ein zu kurzes Passwort ergibt diesen Satz, nicht die Passwortregel — Beleg: `qa/r4_func.py`, EC-7

#### AC-8 — 5 Fehlversuche je E-Mail-Adresse in 15 Minuten
- [x] Ab Versuch 6 gesperrt mit Restzeit; genau **5** Zeilen nach 7 Versuchen — Beleg: `qa/r4_func.py`
- [x] Auch das richtige Passwort wird während der Sperre abgelehnt — Beleg: derselbe Lauf

#### AC-9 — 5 Fehlversuche je IP-Adresse in 15 Minuten
- [x] Wie spezifiziert erfüllt: 6 Versuche mit verschiedenen Adressen → ab dem 6. gesperrt — Beleg: `qa/r4_func.py`
- [ ] **BUG-1 — in der Vorgabe-Konfiguration gibt es keine IP-Granularität.** Alle Anfragen teilen einen Eimer, fünf Fehlversuche sperren alle. Siehe BUG-1.

#### AC-10 — Zugangsdaten erscheinen nie in der URL
- [x] Beide Formulare `method="POST"` — Beleg: HTML von `/login` und `/signup`
- [x] Fehlanmeldung: kein `location`, Passwort **nicht** im HTML — Beleg: `qa/r4_func.py` mit `GEHEIM-nicht-echt`

#### AC-17 — 10 Registrierungen je IP-Adresse in 60 Minuten
- [x] 13 Registrierungen → **10 angelegt**, danach abgewiesen — Beleg: `qa/r4_func.py`
- [ ] **BUG-3 — gezählt werden Versuche, nicht angelegte Konten.** Siehe BUG-3.

#### AC-18 — Antwortzeit verrät nicht, ob eine Adresse registriert ist
- [x] **Mediane deckungsgleich:** 361,1 ms gegen 360,1 ms — Unterschied **0,26 %**, Vorgabe < 10 % — Beleg: je n=24
- [x] **Wertebereiche überlappen:** 356–400 ms gegen 356–427 ms — Beleg: derselbe Lauf
- [x] **Jede Antwort unter 500 ms:** 0 von 48 darüber, langsamste 427 ms — Beleg: derselbe Lauf
- **Hinweis, kein Bug:** Die Reserve bleibt konstruktiv knapp (350 ms Untergrenze, ~150 ms für die Arbeit). Im zweiten Lauf, unter mehr Maschinenlast, lagen 2 von 52 Antworten darüber. Bei zwei ruhigen Läufen in Folge kein Befund.

### Zugriffsschutz

#### AC-11 — Abgemeldet führt `/` auf `/login`
- [x] `/` und `/konto` abgemeldet: je `307 → /login` — Beleg: `qa/r4_func.py`
- [x] Im Browser bestätigt — Beleg: E2E Journeys 1 und 3

#### AC-12 — Angemeldet führen `/login` und `/signup` auf `/`
- [x] beide `307 → /` — Beleg: `qa/r4_func.py`; im Browser bestätigt in E2E Journey 2

#### AC-13 — Die Datenbank liefert fremde Daten nicht aus
- [x] A liest `profiles` → genau die eigene Zeile — Beleg: `qa/r4_sec.py`
- [x] A fragt B gezielt ab → `[]` — Beleg: derselbe Lauf
- [x] A überschreibt B per `PATCH` → `204`, B **unverändert** (0 Zeilen betroffen) — Beleg: Wert vorher/nachher
- [x] A löscht B → `403`, B weiterhin vorhanden — Beleg: derselbe Lauf
- [x] Abgemeldet: `401` — Beleg: derselbe Lauf
- [x] `login_attempts` weder angemeldet (`403`) noch abgemeldet (`401`) lesbar — Beleg: derselbe Lauf

### Abmelden

#### AC-14 — Abmelden beendet die Sitzung, Zurück-Button stellt nichts wieder her
- [x] `303 → /login?reason=signed-out`, Sitzungen in der Datenbank **1 → 0** — Beleg: `qa/r4_func.py`
- [x] Danach `/` wieder `307 → /login` — Beleg: derselbe Lauf
- [x] `Cache-Control: no-store, must-revalidate` auf allen vier Routen im Produktions-Build — Beleg: `qa/r4_func.py`
- [x] Im Browser bestätigt, inklusive Zurück-Button: nach dem Abmelden steht die Adresse nicht mehr auf der Seite — Beleg: E2E Journey 3 (`page.goBack()`)
- [x] Die Reihenfolge stimmt: erst abmelden, dann weiterleiten — Beleg: `src/lib/actions/account.test.ts`

### Kontolöschung und Aufbewahrung

#### AC-15 — Konto löschen entfernt alles, erneute Anmeldung schlägt fehl
- [x] **Der Weg über die Oberfläche funktioniert jetzt** — der Kern der Behebung: Dialog öffnen, „Abbrechen" lässt das Konto bestehen, „Endgültig löschen" entfernt es, Weiterleitung auf `/login?reason=deleted` mit Bestätigungstext, erneute Anmeldung schlägt fehl — Beleg: E2E Journey 4, **beide Projekte**
- [x] Datenbankseitig: Konten `0`, Profile `0`, Sitzungen `0`, Drosselungszeilen `0` — Beleg: `qa/r4_sec.py`
- [x] Konto A bleibt unversehrt — Beleg: derselbe Lauf
- [x] Abgemeldet nicht aufrufbar: `401`; untergeschobene fremde ID: `404 PGRST202` — Beleg: derselbe Lauf
- [x] Der Auslöser steht im ausgelieferten HTML, der Dialoginhalt erwartungsgemäß nicht (Radix rendert ihn erst beim Öffnen) — Beleg: angemeldetes `/konto`
- [x] `AlertDialogAction` ist restlos ersetzt — nur noch als Prosa im erklärenden Kommentar, nicht importiert, nicht im JSX — Beleg: `grep -nE "<\s*AlertDialogAction"` → kein Treffer
- [x] Der Fehlerfall meldet und **meldet nicht ab** — der Zweig, der vor der Behebung gar nicht erreichbar war — Beleg: `src/lib/actions/account.test.ts`

#### AC-16 — Drosselungsdaten nach 24 Stunden gelöscht
- [x] Drei Zeilen (zwei 25 Std alt, eine davon `signup` mit `ip = NULL`): `cleanup_login_attempts()` löscht **2** — Beleg: `qa/r4_sec.py`
- [x] Stündlicher Job aktiv: `cleanup-login-attempts | 0 * * * * | aktiv=true` — Beleg: `cron.job`

---

## Edge Cases

#### EC-1 — Doppelklick auf „Registrieren"
- [x] **Echt geprüft, nicht mehr nur im Code belegt:** zwei Klicks in Folge auf „Konto anlegen" erzeugen **genau ein** Konto, in der Datenbank nachgezählt, und die Person sieht keinen Fehler — Beleg: E2E Journey 1, beide Projekte
- [x] Der Absende-Button ist während der Übertragung gesperrt — Beleg: `src/components/auth/signup-form.tsx:96`

#### EC-2 — Zwei gleichzeitige Registrierungen mit derselben Adresse
- [x] Garantie in der Datenbank: `users_email_partial_key` — Beleg: `pg_indexes`
- [x] Die unterlegene Anfrage erhält die Meldung aus AC-5 — Beleg: `qa/r4_func.py`

#### EC-3 — Sitzung läuft ab
- [x] Sitzung entzogen → `307 → /login?reason=session-expired`, Hinweiszeile wird gezeigt — Beleg: `qa/r4_sec.py`
- [x] Grenzen gesetzt: `INACTIVITY_TIMEOUT=8h`, `TIMEBOX=24h` — Beleg: `docker exec … env`
- [!] **NICHT VERIFIZIERT:** Ablauf nach echten 8 bzw. 24 Stunden — geprüft ist der gleichwertige Fall.

#### EC-4 — Datenbank nicht erreichbar
- [x] Im dritten Durchlauf mit gestopptem Kong geprüft: eigene Meldung je Strecke, kein 5xx, Passwortfeld leer, keine Zugangsdaten in der URL, Drosselung fällt zu.
- [x] In **diesem** Lauf über den Code-Zweig bestätigt statt über einen erneuten Ausfall: `passLoginGate`/`passSignupGate` liefern bei Datenbankfehlern `unavailable`, und die Kontolöschung meldet ohne abzumelden — Beleg: `src/lib/rate-limit.test.ts`, `src/lib/actions/account.test.ts`

#### EC-5 — Konto in einem anderen Tab gelöscht
- [x] Nach der Löschung führt die nächste Aktion im anderen Tab auf `/login?reason=session-expired` — Beleg: `qa/r4_sec.py`

#### EC-6 — Randleerzeichen im Passwort
- [x] Registrierung und Anmeldung mit `"  mit leerzeichen  "` beide `303`; ohne die Leerzeichen schlägt die Anmeldung fehl — Beleg: `qa/r4_sec.py`

#### EC-7 — Kurze Passwörter bei der Anmeldung
- [x] Ab dem 6. Versuch gesperrt, **5 Zeilen gezählt**, Meldung nennt die Passwortregel nicht — Beleg: `qa/r4_func.py`

---

## Security Audit

- [x] **Authentifizierung:** `/` und `/konto` ohne Sitzung → `307 → /login` — Beleg: `qa/r4_func.py`
- [x] **Autorisierung:** A erreicht B's Zeile weder lesend noch schreibend noch löschend — Beleg: `qa/r4_sec.py`
- [x] **Kein Privilegien-Aufstieg über die Lösch-Funktion:** kein fälschbares Argument, abgemeldet `401` — Beleg: `qa/r4_sec.py`; zusätzlich unit-getestet (`rpc` wird mit genau einem Argument gerufen)
- [x] **Eingabeprüfung XSS und SQL:** beide Nutzlasten abgewiesen bzw. als Text behandelt — Beleg: `qa/r4_sec.py`
- [x] **Brute Force auf ein Konto:** ab dem 6. Fehlversuch gesperrt — Beleg: `qa/r4_func.py`
- [x] **Massen-Registrierung:** auf 10 je Eimer und Stunde begrenzt — Beleg: `qa/r4_func.py`
- [x] **Keine Konto-Enumeration** über Meldungstext oder Antwortzeit — Beleg: `qa/r4_func.py`, AC-18
- [ ] **BUG-1 — Denial of Service auf die Anmeldung.** In diesem Lauf erneut ausgelöst.
- [ ] **BUG-2 — die Drosselungs-Tore sind ein unauthentifiziertes Schreibwerkzeug.** In diesem Lauf erneut ausgelöst.
- [x] **Keine Secrets im Client-Bundle:** `service_role`-JWT, `sb_secret`, `JWT_SECRET`, `postgresql://` und **`TRUSTED_PROXY_HOPS`** je **0 Treffer** in `.next/static` — Beleg: `grep -rlF`
- [x] **Namen der Datenbankfunktionen nicht im Bundle** (je 0 Treffer) — Beleg: derselbe Scan
- [x] **Nur zwei Werte erreichen den Browser:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Beleg: `grep -rhoE`
- [x] **Keine sensiblen Felder in Antworten:** `/konto` ohne Passwort, Token und Nutzer-ID — Beleg: `qa/r4_sec.py`
- [x] **Keine `.env`-Datei eingecheckt** außer `.env.local.example` — Beleg: `git ls-files`
- [x] **Fehlermeldungen verraten keine Interna:** die Datenbankmeldung wird nicht durchgereicht — Beleg: `src/lib/actions/account.test.ts` („verrät im Fehlerfall nichts über die Ursache")
- [x] **Security-Header vollständig** auf allen vier Routen — Beleg: `qa/r4_func.py`
- [!] **NICHT VERIFIZIERT — Drosselung auf gewöhnlichen Endpunkten:** außer den Auth-Wegen gibt es in PROJ-1 keine.

### `[user]`-Aufgaben
- [x] **Keine offenen.** T24 ist abgehakt, `TRUSTED_PROXY_HOPS=0` steht in `.env.local.example`, ohne `NEXT_PUBLIC_`-Präfix und mit 0 Treffern im Bundle — Beleg: `git show HEAD:.env.local.example`

---

## Regression

- [x] `features/INDEX.md` führt **kein** Feature mit Status *Deployed*; PROJ-2 und PROJ-3 stehen auf *Roadmap*
- [x] Alle 18 AC und 7 EC in diesem Lauf neu geprüft — die Behebung von BUG-4 hat nichts gebrochen
- [x] Die E2E-Suite lief vollständig als Regression: **8 von 8 grün** (vorher 6 von 8) — Beleg: `npm run test:e2e`
- [x] Die drei bewusst offenen Befunde sind unverändert reproduzierbar — Beleg: eigener Nachweis-Lauf je Befund

---

## Automatisierte Tests

- `npm test`: **45 Tests, 4 Dateien, alle grün** (vorher 38)
  - `src/lib/validation/auth.test.ts` (11), `src/components/auth/login-notice.test.tsx` (7), `src/lib/rate-limit.test.ts` (20)
  - **`src/lib/actions/account.test.ts` (7) — in diesem Durchlauf ergänzt.** Abmelden und Kontolöschung hatten bis hierher keinen einzigen Test, und ausgerechnet der Fehlerzweig der Löschung war bis zur Behebung von BUG-4 **toter Code**: Der Dialog schloss sich beim Klick, also konnte die Meldung nie erscheinen. Abgedeckt sind jetzt: Abmelden beendet die Sitzung vor der Weiterleitung · die Löschung ruft die Datenbankfunktion **ohne fälschbares Argument** · ohne Anmeldung wird gar nicht erst gelöscht · bei einem Datenbankfehler erscheint eine Meldung und es wird **nicht** abgemeldet · die Datenbankmeldung wird nicht durchgereicht
- **Rot-Nachweis erbracht, für alle sieben neuen Tests einzeln** (sieben Brüche, je zurückgenommen): Fehlerzweig entfernt · Anmeldeprüfung entfernt · global statt lokal abgemeldet · falsches Weiterleitungsziel · Argument an die Löschfunktion gegeben · Datenbankmeldung durchgereicht · Abmelden weggelassen. Danach wieder 45 grün, `git diff` auf `src/lib/actions/account.ts` leer.
- `npm run lint`: grün · `npm run build`: grün · `npx tsc --noEmit`: sauber

## E2E-Tests

**8 von 8 grün** — `npm run test:e2e`, Desktop Chrome und Mobile Safari (iPhone 13), `tests/PROJ-1-accounts-auth.spec.ts`.

| Journey | AC / EC | Chrome | Mobile Safari |
|---|---|---|---|
| 1 — Registrieren führt aus dem gesperrten Bereich hinein | AC-11, AC-1, AC-2, EC-1 | ✅ | ✅ |
| 2 — Anmelden bringt die eigene Adresse auf die Kontoseite | AC-6, AC-12 | ✅ | ✅ |
| 3 — Abmelden schließt den geschützten Bereich wieder | AC-14, AC-11 | ✅ | ✅ |
| 4 — Konto löschen über den Bestätigungsdialog | AC-15 | ✅ | ✅ |

Die Drosselung (AC-8, AC-9, AC-17) ist bewusst **nicht** abgedeckt, solange BUG-1 offen ist.
Die Suite leert vor jedem Lauf Testkonten und Drosselungs-Zähler und läuft mit `workers: 2` —
beides sind Zugeständnisse an BUG-1 und an `next dev` unter Last, dokumentiert in `tests/helpers.ts`.

---

## Nicht verifiziert in diesem Durchlauf

- [!] **Visuelle** Darstellung und Layout — die E2E-Suite belegt, dass die Abläufe in Chromium und WebKit **funktionieren**, auch auf iPhone-13-Viewport (390 px); ob es dort gut *aussieht*, prüft sie nicht
- [!] Firefox — von der Suite nicht abgedeckt
- [!] Responsives Aussehen bei 768 px und 1440 px — keine Messpunkte
- [!] Browser-Konsole und Netzwerk-Tab — kein DevTools in `/qa`
- [!] Ob der Browser geschützte Seiten aus dem bfcache holt — die Voraussetzung `no-store` ist erfüllt, das Browser-Verhalten selbst nicht beobachtbar
- [!] Ablauf der Sitzung nach echten 8 bzw. 24 Stunden (EC-3)
- [!] Fokusreihenfolge, Tastaturbedienung und Screenreader-Ausgabe
- [!] Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine

---

## Gefundene Fehler

### BUG-1: Fünf Anfragen sperren die Anmeldung für alle Nutzer:innen
- **Severity:** High · **Status:** offen, bewusst nach `/refine` verschoben
- **Betrifft:** AC-9 · `src/lib/rate-limit.ts` (Vorgabe `TRUSTED_PROXY_HOPS = 0`) mit `20260828120000_ip_bucket_not_skip.sql`
- **Schritte:** Fünfmal `/login` mit einer frei erfundenen Adresse aufrufen; danach meldet sich eine beliebige echte Person mit ihrem **richtigen** Passwort an → „Zu viele Fehlversuche." In diesem Lauf erneut ausgelöst.
- **Ursache:** Ohne erklärten Proxy wird der fälschbare `X-Forwarded-For`-Kopf zu Recht nicht gelesen — damit hat aber jede Anfrage dieselbe (leere) IP, und die Eimer-Semantik zählt sie gemeinsam. AC-9 hat in dieser Konfiguration keine Granularität.
- **Tragweite:** Ein unangemeldeter Angreifer legt die Anmeldung der gesamten App für 15 Minuten still und hält das mit fünf Anfragen alle 15 Minuten aufrecht. Die Registrierung ebenso: 10 Konten pro Stunde für die gesamte App.
- **Kein Rückschritt:** Vor der Behebung des Bypass teilten sich alle Anfragen ohne Kopf den Eimer `::1` — derselbe Effekt war schon erreichbar.
- **Heute:** nur lokal erreichbar, Deployment laut `docs/PRD.md` nicht vorgesehen.
- **Richtung:** die IP-Regel beim **Anmelden** ohne erklärten Proxy aussetzen und dort auf AC-8 je Adresse vertrauen, während die Registrierungs-Regel den gemeinsamen Eimer behält · oder beim Start laut werden, wenn `TRUSTED_PROXY_HOPS=0` auf Produktion trifft.

### BUG-2: Die Drosselungs-Tore lassen sich direkt aufrufen und mit fremden Werten füllen
- **Severity:** Medium · **Status:** offen, bewusst nach `/refine` verschoben
- **Betrifft:** AC-8, AC-9, AC-17 · `grant execute … to anon` auf beiden Toren
- **Schritte:** Ohne Anmeldung, nur mit dem öffentlichen `anon`-Schlüssel, fünfmal `POST /rest/v1/rpc/login_attempt_gate` mit `{"p_email":"<Adresse des Opfers>"}` → das Opfer kommt mit dem richtigen Passwort nicht mehr hinein. In diesem Lauf erneut ausgelöst. Ebenso `signup_attempt_gate` mit einer fremden IP.
- **Was daran neu ist:** Die Kontosperre allein ist auch über die App erreichbar (Kehrseite von AC-8). Der direkte Aufruf ist billiger — ohne Formularlast und ohne die 350 ms aus AC-18 — und erlaubt zusätzlich, **fremde IP-Eimer** zu füllen, was die App selbst niemandem gestattet.
- **`TRUSTED_PROXY_HOPS=1` hilft hier nicht:** Der Angreifer umgeht die App und wählt `p_ip` frei.
- **Die Spannung:** Das Recht lässt sich nicht einfach entziehen — die App ruft die Tore selbst als `anon` auf, und einen `service_role`-Schlüssel gibt es nach TD-6 bewusst nicht.

### BUG-3: Die Registrierungssperre zählt Versuche, nicht angelegte Konten
- **Severity:** Low · **Status:** offen, gehört mit `/refine` an den Wortlaut von AC-17
- **Schritte:** 10 Registrierungen mit einer bereits vergebenen Adresse (0 Konten entstehen), danach ein echter Erstversuch → abgewiesen. In diesem Lauf erneut ausgelöst.

---

## Behoben und bestätigt

### BUG-4 (3. Lauf): Der Klick auf „Endgültig löschen" löste nichts aus — **geschlossen**
- **Ursache war:** `AlertDialogAction` ist bei Radix ein `DialogPrimitive.Close`; der Klick schloss den Dialog und hängte das darin liegende Formular aus, bevor React das Absenden verarbeiten konnte.
- **Behebung:** ein gewöhnlicher `Button type="submit"` statt `AlertDialogAction`.
- **Unabhängig bestätigt:** E2E Journey 4 grün auf beiden Projekten; Gegenprobe mit wiederhergestelltem altem Zustand fiel an genau der erwarteten Zeile.
- **Nebengewinn:** Der Fehlerzweig der Löschung ist jetzt überhaupt erreichbar — vorher toter Code. Er ist in diesem Lauf unit-getestet worden.

---

## Beobachtung (kein Fehler): AC-8 erlaubt gezielte Kontosperren — konstruktionsbedingt

Eine Drosselung, die **das Konto** nach fünf Fehlversuchen sperrt, lässt sich von jedem missbrauchen,
der die Adresse kennt. Das ist keine Abweichung von der Spec, sondern genau das, was AC-8 verlangt,
und die bekannte Kehrseite jedes Account-Lockout-Verfahrens. Übliche Gegenmittel wären, zu verzögern
statt zu sperren, oder ab einer Schwelle ein CAPTCHA zu verlangen (in `spec.md` zurückgestellt).

---

## Zusammenfassung

- **Acceptance Criteria:** 18 von 18 geprüft — **16 vollständig bestanden**, 2 mit Einschränkung:
  - **AC-9** — erfüllt den Wortlaut, aber ohne erklärten Proxy fehlt die IP-Granularität (BUG-1)
  - **AC-17** — erfüllt den Wortlaut, zählt aber Versuche statt Konten (BUG-3)
- **AC-15 ist jetzt vollständig bestanden** — der Weg über die Oberfläche eingeschlossen
- **AC-18** besteht vollständig, einschließlich der 500-ms-Zusage
- **Edge Cases:** 7 von 7 bestanden — EC-1 ist jetzt echt geprüft
- **Gefundene Fehler:** 3 — 0 kritisch, **1 hoch**, 1 mittel, 1 niedrig. **Keiner davon ist neu**; alle drei standen schon im dritten Bericht und wurden bewusst nach `/refine` verschoben
- **Behoben und bestätigt:** BUG-4 aus dem dritten Lauf
- **Security:** **17 Prüfungen verifiziert, 1 nicht verifiziert** (Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine); zwei der verifizierten sind als BUG-1 und BUG-2 negativ ausgefallen
- **`[user]`-Aufgaben:** keine offen
- **Tests:** 45 Unit-/Integrationstests grün (7 neu, alle einzeln rot nachgewiesen) · **E2E 8 von 8 grün** · lint, build, tsc sauber
- **Production Ready:** **NEIN** — BUG-1 ist ein High-Befund

> „Production Ready: NEIN" heißt: ein hoher Befund steht offen — und er steht offen, weil so
> entschieden wurde, nicht weil er übersehen wird. Es heißt **nicht**, dass alles geprüft wurde: die
> Liste „Nicht verifiziert" bleibt offen und betrifft vor allem das **Aussehen** der Oberfläche.

**Empfehlung:** `/refine PROJ-1`. Alle drei verbliebenen Befunde sind Vertrags- vor Codefragen:
AC-9 verspricht eine Granularität je IP-Adresse, die es ohne vorgelagerten Server nicht geben kann;
AC-17 beschreibt eine Zählung, die der Code nicht macht; und ob eine Kontosperre überhaupt das
richtige Mittel ist, entscheidet BUG-2 mit. Wenn der Vertrag steht, ist der Bau danach klein.

**Weiterhin offen (unverändert):**
- `docs/privacy.md` beschreibt nur die Anmelde-Drosselung, nicht die Registrierungs-Zählung → `/dsgvo PROJ-1`
- CAPTCHA auf der Registrierung bleibt zurückgestellt — es wäre zugleich das Gegenmittel gegen die
  in der Beobachtung beschriebene Kontosperre
