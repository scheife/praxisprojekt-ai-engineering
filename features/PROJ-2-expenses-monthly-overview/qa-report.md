# QA-Testergebnisse — PROJ-2 Ausgaben & Monatsübersicht

**Getestet:** 2026-08-31
**App-URL:** `http://localhost:3000` (`next dev`) und `http://localhost:3100` (Produktions-Build, `next start`) — beide gegen das lokale Supabase auf `127.0.0.1:55321`
**Tester:** QA Engineer (KI)

> Legende: `[x]` in diesem Durchlauf geprüft (mit Nachweis) · `[ ] BUG` als fehlerhaft bestätigt · `[!] NICHT GEPRÜFT` in diesem Durchlauf nicht prüfbar (mit Grund)

**Wie geprüft wurde.** `/qa` arbeitet **ohne Browser**. Geprüft wurde deshalb gegen (a) die
laufende Anwendung über HTTP mit echten Sitzungs-Cookies zweier Konten, (b) die Datenbank direkt
über PostgREST und `psql` — also **am Anwendungscode vorbei**, genau wie ein Angreifer es täte,
(c) die Testsuiten und (d) den Quelltext. Alles, was einen echten Browser braucht — Fokus,
Dialoge, Toasts, Filterklicks, Darstellung auf verschiedenen Bildschirmbreiten — steht unter
*Nicht geprüft in diesem Durchlauf*.

**Testsuite:** `npm test` → **164 Tests, 14 Dateien, alle grün** (vorher 146; `/qa` hat 15 ergänzt, die Behebung von BUG-1 weitere 3).

**Nachtrag 2026-08-31:** BUG-1 wurde nach diesem Durchlauf behoben und die Behebung mit echten
Abrufen gegen den Produktions-Build nachgeprüft. Die betroffenen Zeilen unten sind entsprechend
aktualisiert; alles andere steht unverändert aus dem ursprünglichen Durchlauf.

---

---

## Zweiter Durchlauf — 01.09.2026 (nach `/refine`, `/architecture`, `/tasks`, `/build`)

**Getestet:** 2026-09-01 · **App-URL:** `http://localhost:3300` (`next dev`) gegen das lokale
Supabase auf `127.0.0.1:55321` · **Testsuite:** `npm test` → **242 Tests, 18 Dateien, alle grün**
(vorher 214) · **E2E als Regression:** `npx playwright test` → **28 von 28 grün** in Chromium und
Mobile Safari

**Was dieser Durchlauf prüft.** Der `/refine` vom 01.09.2026 hat **EC-4 neu gefasst** (gilt jetzt
für Lesen *und* Schreiben, für Datenbank *und* Auth-Server, mit einer Frist von zwei Sekunden) und
**EC-12 ergänzt**. Geprüft werden diese beiden Kriterien vollständig, dazu Sicherheit und Regression.
Die übrigen 30 AC und 10 EC stehen unverändert aus dem ersten Durchlauf — sie wurden hier **nicht
erneut einzeln durchgespielt**, sondern über die beiden Suiten und gezielte Stichproben abgesichert.
Das ist ausdrücklich gesagt, damit niemand mehr Abdeckung annimmt, als dieser Lauf hergibt.

**Wie geprüft wurde.** Über HTTP mit einer echten Sitzung, die über den echten Registrierungsweg
entstanden ist (`$ACTION_*`-Felder, multipart-POST) — also **mit einer anderen Methode als der
`/build`-Lauf**, der den Browser benutzt hat. Der Ausfall wurde zweimal wirklich herbeigeführt:
einmal `docker pause` auf den Datenbank-Container, einmal **nur** auf PostgREST, damit die Anmeldung
prüfbar bleibt. Die Prüfbahnen (Sicherheit, Regression) liefen nacheinander, nicht über Subagenten.

### EC-4 — Datenbank oder Auth-Server antwortet nicht

- [x] **Lesen, Seite `/`** — `docker pause` auf die Datenbank, angemeldete Sitzung: **HTTP 200 nach
  2,12 s** (vorher 50,4 s), Meldung „Wir erreichen deine Daten gerade nicht", Knopf „Erneut
  versuchen", `role="alert"`, Kopfzeile steht · *Nachweis: `curl -b cookies.txt -w '%{time_total}'`,
  drei Wiederholungen 2,05–2,12 s*
- [x] **Lesen, Seite `/konto`** — HTTP 200 nach 2,39 s mit derselben Meldung · *Nachweis: ebenso*
- [x] **Export `/konto/export`** — **HTTP 503** nach 2,02 s, `text/plain; charset=utf-8`, Rumpf
  „Wir erreichen deine Daten gerade nicht. Das liegt nicht an dir — versuch es in einem Moment noch
  einmal." · *Nachweis: `curl -w '%{http_code} %{content_type}'`*
- [x] **Nach dem Freigeben** — `docker unpause`, sofort wieder HTTP 200 in 0,34 s, normale Ansicht
- [ ] **BUG** **Lesen, wenn NUR der Datenzugriff steht** — siehe **BUG-4** (hochgestuft auf High).
  Bleibt der Auth-Server erreichbar und fällt nur PostgREST aus, greift die Sitzungsprüfung nicht,
  die Monatsabfrage wirft, und es gibt **keinen Fehlerzustand**: Die Person sieht dauerhaft das
  Ladegerüst, sichtbarer Text nur „auslage." · *Nachweis: `docker pause supabase_rest_…`, HTTP 200
  nach 4,46 s, `grep` auf die Meldung = 0 Treffer, Server-Log `⨯ Error: {"message":"Error:
  auslage/unreachable: …"} digest: '3984802547@E394'`*
- [ ] **BUG** **Die Frist gilt je Aufruf, nicht je Anfrage** — siehe **BUG-6** (Medium). Gemessen
  4,1 s beim POST und 4,5 s beim Lesen mit zwei Abfragen, gegen die zugesagten „höchstens 2 Sekunden"
- [!] **NICHT GEPRÜFT — Schreibweg zur Laufzeit.** „Eingegebene Werte bleiben im Formular stehen"
  ist Zustand im Browser und über HTTP nicht beobachtbar; die RSC-Kodierung der Formularfelder ließ
  sich mit `curl` nicht nachbauen (die Action **ist** erreichbar — sie hat mit Feldfehlern geantwortet,
  siehe Sicherheitsteil). Abgedeckt durch **drei Unit-Tests** in `src/lib/actions/expenses.test.ts`
  (nichts geschrieben, kein Kursdienst gerufen, Meldung zurückgegeben) und indirekt durch PROJ-3
  Journey 3, wo die Eingaben nach einer formularweiten Fehlermeldung nachweislich stehen bleiben

### EC-12 — Anmeldung nicht feststellbar

- [x] **Keine Weiterleitung auf `/login`** — bei angehaltener Datenbank antwortet `/` mit **HTTP 200
  und leerem `redirect_url`**, die Adresse bleibt stehen · *Nachweis: `curl -w '%{http_code} %{redirect_url}'`
  ohne `-L` → `200 ''`; mit `-L` → `num_redirects: 0`*
- [x] **Eigener Zustand statt Leer- oder Feldfehler** — `UnavailableNotice` mit `role="alert"`,
  Satz und Schaltfläche im ausgelieferten Markup · *Nachweis: `grep` auf `Erneut versuchen` = 1*
- [x] **Der Rahmen bleibt stehen** — Kopfzeile im Markup vorhanden · *Nachweis: `grep auslage` = 1*
- [x] **„Nicht angemeldet" wird weiterhin unterschieden** — ohne Sitzung und bei angehaltener
  Datenbank leitet `/` unverändert mit **307 auf `/login`**. Die Vorprüfung fragt niemanden, wenn
  kein Sitzungs-Cookie da ist · *Nachweis: `curl` ohne Cookie während des Ausfalls*
- [x] **Der Unterschied ist im Code verankert, nicht geraten** — `isUnreachable` prüft die eigene
  Markierung aus `deadlineFetch` **und** `AuthRetryableFetchError`; eine beantwortete Ablehnung
  (`AuthApiError` 401, PostgREST `42501`, `23505`) fällt nicht darunter ·
  *Nachweis: `src/lib/supabase/deadline.ts:78`, sieben Tests in `deadline.test.ts`*
- [!] **NICHT GEPRÜFT — der Knopf „Erneut versuchen".** Er ruft `router.refresh()`; ein Klick braucht
  einen Browser. Im Markup vorhanden und korrekt benannt, die Wirkung ist ungeprüft

### Sicherheit (Red Team, zweiter Durchlauf)

- [x] **Zugriffsschutz** — `/`, `/konto`, `/konto/export` ohne Sitzung je **HTTP 307 → `/login`**
  · *Nachweis: `curl -o /dev/null -w '%{http_code} %{redirect_url}'` je Route*
- [x] **Row Level Security** — `expenses`, `profiles`, `login_attempts` mit **gültigem anon-Schlüssel**
  direkt gegen PostgREST: alle drei **HTTP 401 / `42501`** · *Nachweis: `curl http://127.0.0.1:55321/rest/v1/<t>`
  mit `apikey` und `Authorization: Bearer`, Schlüssel aus `npx supabase status`*
- [x] **Keine Zugangsdaten in der Adresse** — `/login`, `/signup` und die Erfassungszeile tragen alle
  drei `method="POST"` im ausgelieferten Markup · *Nachweis: `grep '<form[^>]*>'` je Seite*
- [x] **Keine Secrets im Client** — `service_role` und `GATE_SECRET` kommen weder im Markup noch in
  `.next/static` vor (0 Dateien) · *Nachweis: `grep -rl` über das Bundle*
- [x] **Serverseitige Eingabeprüfung** — die Server Action, direkt über `Next-Action` aufgerufen,
  antwortet auf leere Felder mit `{"status":"error","fieldErrors":{…}}` statt zu schreiben ·
  *Nachweis: `curl -X POST -H "Next-Action: 60e660f5…"`, Antwortrumpf im Protokoll*
- [x] **Drosselung beim Anmelden (Regression auf PROJ-1)** — nach **6 Fehlversuchen** greift die
  Sperre, 5 Versuche protokolliert. Meine Änderung am gemeinsamen Client (Frist, abgeschaltete
  Wiederholversuche) hat sie nicht beschädigt · *Nachweis: Schleife über 12 POSTs auf `/login`,
  danach `select count(*) from login_attempts`*
- [x] **Die Frist schwächt den Zugriffsschutz nicht** — die Vorprüfung lässt zwar durch, die Seite
  dahinter zeigt aber keine Daten, und RLS liefert bei stehender Datenbank ohnehin nichts ·
  *Nachweis: der Ausfalltest oben — HTTP 200, aber ausschließlich die Meldung im Markup*
- [!] **NICHT GEPRÜFT** — Zugriff quer über **zwei angemeldete** Konten: In diesem Lauf entstand keine
  zweite Sitzung, und die Ausgabe von Konto A ließ sich über `curl` nicht anlegen (siehe EC-4 oben).
  Der erste Durchlauf hat diesen Fall mit zwei echten Sitzungen geprüft; hier steht er offen

### Regression

- [x] **Unit-/Integrationstests** — 242 von 242 grün, 18 Dateien · *Nachweis: `npm test`*
- [x] **E2E-Suite** — 28 von 28 grün in Chromium und Mobile Safari, also PROJ-1, PROJ-2 und PROJ-3
  vollständig · *Nachweis: `npx playwright test`*
- [x] **Normalbetrieb unbeeinträchtigt** — `/` mit Sitzung lädt in **0,34–0,56 s**; die Frist greift
  im Alltag nicht · *Nachweis: `curl -w '%{time_total}'` bei laufender Datenbank*
- [x] **Anmeldung und Registrierung** — Registrierung über den echten Formularweg erzeugt 4
  `sb-`-Cookies und eine gültige Sitzung · *Nachweis: `curl -c cookies.txt`, danach `/` → HTTP 200*


---

## Dritter Durchlauf — 01.09.2026 (Verifikation der Behebung von BUG-4)

**Getestet:** 2026-09-01 · **App-URL:** `http://localhost:3300` (`next dev`) · **Testsuite:**
`npm test` → **246 Tests, 19 Dateien, alle grün** (vorher 242) · **E2E:** `E2E_PORT=3400 npx
playwright test` → **28 von 28 grün** in Chromium und Mobile Safari

> **Warum Port 3400 statt 3200.** Auf 3200 lief während dieses Laufs ein **fremder** Dev-Server
> (Titel `alex macht. · …`). `reuseExistingServer` hätte ihn stillschweigend übernommen und die
> Suite hätte die falsche Anwendung geprüft — genau die Falle, vor der `playwright.config.ts`
> warnt. Der Lauf wurde deshalb auf einen freien Port gelegt.

**Umfang.** Dieser Lauf prüft **eine** Sache unabhängig nach: ob die Behebung von BUG-4 hält. Dazu
Sicherheit und Regression. Die übrigen Kriterien stehen aus den ersten beiden Durchläufen.

### BUG-4 — behoben und verifiziert

- [x] **Der Fall, der den Befund ausgelöst hat** — `docker pause` auf **nur** PostgREST, Auth läuft
  weiter, angemeldete Sitzung: **HTTP 200 nach 2,27 s**, **null Umleitungen**, Meldung „Wir erreichen
  deine Daten gerade nicht", Knopf „Erneut versuchen", `role="alert"` · *Nachweis: `curl -b
  cookies.txt -w "%{http_code} %{time_total} %{num_redirects}"` → `200 2.265297 0`; `grep` auf
  Meldung, Knopf und `role="alert"` je 1 Treffer*
- [x] **Der sichtbare Text ist nicht mehr bloß „auslage."** — nach Entfernen aller Tags:
  `auslage. auslage . auslage . Konto Abmelden Wir erreichen deine Daten gerade nicht. Das liegt
  nicht an dir — versuch es in einem M…` · *Nachweis: dasselbe Markup, Tags entfernt*
- [x] **Der Rahmen bleibt stehen** — Kopfzeile mit „Konto" und „Abmelden" im Markup · *Nachweis: ebenso*
- [x] **Nach dem Freigeben** — `docker unpause`, sofort wieder HTTP 200 in **0,23 s**
- [x] **Nur ein Nichterreichen wird abgefangen** — jeder andere Fehler fliegt weiter, statt fälschlich
  als „gerade nicht erreichbar" zu erscheinen · *Nachweis: `src/components/expenses/month-view.tsx:36`
  (`if (!isUnreachable(error)) throw error`) und der Test „reicht jeden ANDEREN Fehler weiter" in
  `month-view.test.tsx`, der einen `42501`-Fehler durchreichen lässt*
- [x] **Keine weitere Stelle mit derselben Lücke** — `/konto` liest **keine** Daten (nur die
  Sitzung), `/konto/export` fängt den Fall bereits ab (HTTP 503), und der Schreibpfad meldet bei
  einem Datenbankfehler `SAVE_FAILED` („Das Speichern hat gerade nicht geklappt …") — verständlich im
  Sinne von EC-4 · *Nachweis: `grep` nach Abfragen in `src/app/konto/page.tsx` (keine Treffer),
  `src/lib/actions/expenses.ts:258`*

### BUG-6 — unverändert offen

- [ ] **BUG** Erneut gemessen, Zustand unverändert: **GET / 2,09 s · POST / 4,07 s** bei angehaltener
  Datenbank. Die Frist gilt weiter je Aufruf, nicht je Anfrage · *Nachweis: `curl -w "%{time_total}"`
  je einmal GET und POST während `docker pause`*

### Sicherheit (Stichproben nach der Änderung)

- [x] **Zugriffsschutz** — `/`, `/konto`, `/konto/export` ohne Sitzung je **HTTP 307** · *Nachweis: `curl`*
- [x] **Erfassungszeile weiterhin POST** — `method="POST"` im ausgelieferten Markup · *Nachweis: `grep`*
- [x] **Keine Secrets im Client** — 0 Treffer für `service_role` und `GATE_SECRET` in `.next/static`
- [!] **NICHT GEPRÜFT** — die vollständige Angriffsliste. Dieser Lauf hat nur die Prüfungen wiederholt,
  die die geänderte Datei berühren könnte. Der zweite Durchlauf hat die volle Liste abgearbeitet
  (RLS mit gültigem anon-Schlüssel, Drosselung, serverseitige Eingabeprüfung); dort steht sie mit
  Nachweisen

### Regression

- [x] **Unit-/Integrationstests** — 246 von 246 grün, 19 Dateien (4 neue in `month-view.test.tsx`)
  · *Nachweis: `npm test`*
- [x] **E2E-Suite** — 28 von 28 grün in beiden Browsern, also PROJ-1, PROJ-2 und PROJ-3
  · *Nachweis: `E2E_PORT=3400 npx playwright test`*
- [x] **Normalbetrieb unbeeinträchtigt** — `/` mit Sitzung in **0,23 s** · *Nachweis: `curl` nach `docker unpause`*
- [x] **Rot-Nachweis der neuen Tests** — im Bau geführt: `catch` entfernt → 2 Tests rot; jeden Fehler
  abfangen statt nur das Nichterreichen → 1 Test rot; danach alle vier grün

## Vierter Durchlauf — 01.09.2026 (nach `/refine`, `/architecture`, `/tasks`, `/build` der Ebene 11)

**Getestet:** 2026-09-01 · **App-URL:** `http://localhost:3300` (`next dev`) gegen das lokale
Supabase auf `127.0.0.1:55321` · **Testsuite:** `npm test` → **247 Tests, 19 Dateien, alle grün**
(vorher 246) · **E2E als Regression:** `npm run test:e2e` → **28 von 28 grün** in Chromium und
Mobile Safari · **Ausfall-Zusicherung:** `npm run test:outage` → **grün**

**Was dieser Durchlauf prüft.** Der zweite `/refine` vom 01.09.2026 hat **EC-4 auf zwei Zahlen
umgestellt** — höchstens 2 Sekunden je Aufruf, höchstens 5 Sekunden je Anfrage — und `/build` hat
dazu die Ebene 11 gebaut: **T28** (die Ausfall-Zusicherung) und **T29** (die strukturelle
Zusicherung). Geprüft werden deshalb: die neue Fassung von EC-4 an der laufenden Anwendung, die
beiden neuen Zusicherungen selbst, der Verbleib von **BUG-6**, dazu Sicherheit und Regression.
Die 30 AC und die übrigen 11 EC wurden **nicht einzeln neu durchgespielt** — sie sind über beide
Suiten, die Datenbankprüfungen unten und gezielte Stichproben abgesichert. Das steht hier, damit
niemand mehr Abdeckung annimmt, als dieser Lauf hergibt.

**Wie geprüft wurde.** Der Ausfall wurde **viermal wirklich herbeigeführt** (`docker pause`),
getrennt nach „nur PostgREST steht" und „die Datenbank steht, die Anmeldung hängt mit dran".
Gemessen wurde mit **zwei unabhängigen Methoden**: über HTTP mit `curl` und echter Sitzung, und
über einen gesteuerten Browser, der die **wirkliche Server Action** auslöst und sowohl die
vollständige Antwort als auch das Erscheinen der Meldung stoppt. Die Prüfbahnen liefen
nacheinander, nicht über Subagenten.

### EC-4 — die zwei Zahlen, an der laufenden Anwendung gemessen

Alle Messwerte gegen die **Zusage von 5 Sekunden je Anfrage**. Warmgelaufene Route (die
Erstübersetzung durch `next dev` ist keine Wartezeit auf eine Gegenstelle und hatte frühere
Messungen verfälscht).

| Weg | Gegenstelle aus | Messwerte | Grenze |
|---|---|---|---|
| `GET /` | nur PostgREST | 3,19 s · 2,58 s · 2,29 s | 5 s ✓ |
| `POST /` | nur PostgREST | 2,12 s · 2,16 s · 2,26 s | 5 s ✓ |
| `GET /` | Datenbank **und** Auth | 2,08 s · 2,06 s · 2,10 s | 5 s ✓ |
| `POST /` | Datenbank **und** Auth | 2,04 s · 2,06 s · 2,07 s | 5 s ✓ |

- [x] **Höchstens 5 Sekunden je Anfrage** — **erfüllt auf allen vier Wegen.** Der höchste gemessene
  Wert ist **3,19 s**, also 64 % des Budgets · *Nachweis: `curl -w '%{time_total}'` mit echter
  Sitzung, je drei Läufe, bei `docker pause` auf `supabase_rest_…` bzw. `supabase_db_…`*
- [x] **Echte Server Action, nicht nur ein einfacher POST** — der Erfassen-Knopf im gesteuerten
  Browser geklickt, beide Zahlen gestoppt: **vollständige POST-Antwort 2,31 s / Meldung sichtbar
  2,34 s** (nur PostgREST) und **2,08 s / 2,17 s** (alles aus) · *Nachweis: Playwright-Skript mit
  `waitForResponse` + `resp.body()`, Messung ab Klick*
- [x] **Höchstens 2 Sekunden je Aufruf** — die Abbrüche liegen durchweg bei 2,04–2,10 s, also genau
  an der Frist · *Nachweis: die Messreihe oben; die Frist selbst in `src/lib/supabase/deadline.ts:18`
  (`DEADLINE_MS = 2000`) und in `src/lib/supabase/deadline.test.ts`*
- [x] **Verständliche Meldung statt Hängen** — „Wir erreichen deine Daten gerade nicht" und „Erneut
  versuchen" im ausgelieferten HTML, auf beiden Ausfallarten · *Nachweis: `grep` auf den
  `curl`-Rumpf*
- [x] **Normalbetrieb unbeeinträchtigt** — `GET /` 0,10 s, `POST /` 0,09 s (je drei Läufe)
  · *Nachweis: dieselbe Messreihe vor dem `docker pause`*

> **Warum es besser läuft, als `design.md` rechnet — und was das bedeutet.** Die Entwurfstabelle
> führt den POST-Weg mit **4,07 s** und begründet ihn mit **zwei** Sitzungsprüfungen (TD-32).
> Gemessen wurden jetzt **2,08 s**. Die Ursache steht im Code: Meldet `requireUser()` ein
> Nichterreichen, kehrt die Action **sofort mit der formularweiten Meldung zurück und ruft
> `refresh()` gar nicht erst auf** (`src/lib/actions/expenses.ts:198-201`, ebenso `:277-280` und
> `:361-364`). Der Seitenneuaufbau, der die zweite Prüfung tragen würde, findet im Ausfall also
> nicht statt — es bleibt bei **einer** Wartestation. Die Zusage hat damit mehr Luft als der Entwurf
> annimmt. Als **BUG-7 (Low)** festgehalten, weil die veraltete Zahl die Sicherheitsreserve
> unterschätzt und künftige Entwürfe unnötig eng führt.

### EC-12 — „nicht erreichbar" bleibt von „nicht angemeldet" unterschieden

- [x] **Keine Weiterleitung auf `/login` im Ausfall** — bei stehender Datenbank **und** stehendem
  Auth-Server antwortet `/` mit **HTTP 200** und **leerem `redirect_url`**
  · *Nachweis: `curl -w 'redirect_url=[%{redirect_url}] http=%{http_code}'` → `redirect_url=[] http=200`*
- [x] **Der Unterschied hält in die Gegenrichtung** — ohne Sitzung leiten `/`, `/konto` und
  `/konto/export` weiterhin mit **307 auf `/login`** um, ein gefälschtes Cookie auf
  `/login?reason=session-expired` · *Nachweis: `curl -o /dev/null -w '%{http_code} %{redirect_url}'`*

### Die beiden neuen Zusicherungen (T28, T29)

- [x] **T28 läuft und misst wirklich** — `npm run test:outage` grün; die Zusicherung hält PostgREST
  bzw. die Datenbank selbst an und meldet **2387 ms (Schreiben ohne Datenzugriff) · 2416 ms (Lesen
  ohne Datenzugriff) · 2397 ms (Schreiben ohne alles)** gegen die Grenze von 5000 ms
  · *Nachweis: Ausgabe des Laufs*
- [x] **T28 ist wirklich aus dem Alltagslauf ausgeschlossen** — `npm run test:e2e` führt **28** Tests
  aus, `tests/outage.spec.ts` ist nicht darunter; der `grepInvert`-Schalter greift also
  · *Nachweis: Testliste des Laufs, `playwright.config.ts:31`*
- [x] **T28 gibt die Container auch im Fehlerfall frei** — beide `docker pause` stehen in einem
  `try/finally` · *Nachweis: `tests/outage.spec.ts:84-96` und `:112-120`; nach dem Lauf sind alle
  sechs Container `Up`, keiner `Paused`*
- [x] **T29 kann rot werden** — nachgewiesen, nicht angenommen: `Promise.all` in `MonthView`
  probeweise durch zwei aufeinanderfolgende `await` ersetzt → der Test fällt mit
  „expected 'vi.fn()' to be called at least once" (`month-view.test.tsx:104`); danach
  zurückgesetzt, Baum wieder sauber · *Nachweis: `npx vitest run src/components/expenses/month-view.test.tsx`*
- [x] **Die Eigenschaft, die T29 schützt, ist da** — beide Abfragen laufen über `Promise.all`
  · *Nachweis: `src/components/expenses/month-view.tsx:20`*

### Sicherheit (Red Team, vierter Durchlauf)

Vollständig durchgespielt, nicht als Stichprobe. Zwei frische Konten A und B, Zugriff **am
Anwendungscode vorbei** direkt gegen PostgREST mit gültigen Zugangs-Token.

- [x] **Zugriffsschutz ohne Sitzung** — `/`, `/konto`, `/konto/export`, `/?monat=…` antworten alle
  mit **307 auf `/login`** · *Nachweis: `curl` je Route*
- [x] **AC-24 quer über zwei Konten** — A **liest** B's Zeile → `[]`; A **ändert** sie → `[]`;
  A **löscht** sie → `[]`; B's Zeile ist danach unverändert vorhanden
  · *Nachweis: `GET`/`PATCH`/`DELETE` auf `/rest/v1/expenses?id=eq.<B>` mit A's Bearer-Token*
- [x] **Fremdzuschreibung beim Anlegen** — A legt eine Ausgabe mit **B's `user_id`** an →
  `42501 new row violates row-level security policy` · *Nachweis: `POST /rest/v1/expenses`*
- [x] **Ohne Anmeldung gar kein Zugriff** — `anon` auf `expenses` → `42501 permission denied for
  table expenses` · *Nachweis: `curl` nur mit `apikey`*
- [x] **`login_attempts` bleibt für jeden Client verschlossen** — auch als **angemeldete** Person →
  `42501 permission denied for table login_attempts` · *Nachweis: `curl` mit gültigem Bearer-Token*
- [x] **AC-10 / AC-29 / AC-30 am Anwendungscode vorbei** — erfundene Kategorie →
  `expenses_category_known`; Betrag 10.000.000,00 € → `expenses_amount_cents_range`; Datum
  31.12.1999 → `expenses_spent_on_not_ancient`; alle drei `23514` · *Nachweis: drei `POST` direkt
  gegen PostgREST*
- [x] **EC-1 auf Datenbankebene** — dieselbe Vorgangskennung zweimal → **201**, dann **409**
  · *Nachweis: zwei `POST` mit identischem `client_token`*
- [x] **Einschleusung (XSS und SQL) in die Notiz** — Nutzlast
  `<script>alert(1)</script> ' OR 1=1--` gespeichert und ausgeliefert: im HTML **escaped**
  (`&lt;script&gt;` bzw. `<script>`), **kein** roher `<script>`-Block; die
  SQL-Zeichenfolge bleibt Text · *Nachweis: `grep` auf den ausgelieferten Seitenrumpf*
- [x] **Keine Server-Geheimnisse im Client-Bundle** — `.next/static` nach `sb_secret_`,
  `service_role`, `SERVICE_ROLE`, `JWT_SECRET`, `GATE_SECRET` und dem Dienst-Token durchsucht:
  **null Treffer** · *Nachweis: `grep -rl` je Muster nach `npm run build`*
- [x] **Keine Zugangsdaten in der Adresse** — kein `method="get"` in `src/app` oder
  `src/components`; alle Formulare laufen über Server Actions (`<form action={…}>`)
  · *Nachweis: `grep -rn`; dazu der E2E-Test „Die Erfassungszeile wird als POST ausgeliefert"*
- [x] **Sicherheits-Kopfzeilen** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000;
  includeSubDomains` · *Nachweis: `curl -D -` auf `/`*
- [x] **Export gibt nichts preis, was nicht der Person gehört** — Kopfzeilen `text/csv;
  charset=utf-8`, `attachment; filename="auslage-export-2026-09-01.csv"`, `Cache-Control:
  no-store, must-revalidate`, `X-Content-Type-Options: nosniff` · *Nachweis: `curl -D -` auf
  `/konto/export`*
- [!] **Drosselung auf den Ausgaben-Wegen** — **nicht vorhanden, bewusst** (TD-22): PROJ-2 prüft
  keine Zugangsdaten, alles liegt hinter PROJ-1s Anmeldung und zusätzlich hinter RLS. Kein Befund,
  aber auch **keine bestandene Prüfung**

### Regression

- [x] **Unit-/Integrationstests** — **247 von 247 grün**, 19 Dateien (+1 gegenüber dem dritten Lauf:
  die Zusicherung aus T29) · *Nachweis: `npm test`*
- [x] **E2E-Suite** — **28 von 28 grün** in Chromium und Mobile Safari, also PROJ-1, PROJ-2 **und**
  PROJ-3 · *Nachweis: `npm run test:e2e`, 2,7 min*
- [x] **Lint** — ohne Befund · *Nachweis: `npm run lint`*
- [x] **Produktions-Build** — übersetzt sauber, TypeScript ohne Fehler, sechs Routen
  · *Nachweis: `npm run build`*
- [x] **PROJ-1: Drosselung greift noch** — nach fünf festgehaltenen Versuchen wird selbst das
  **richtige** Passwort abgelehnt: „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.",
  keine Sitzung, Verbleib auf `/login` · *Nachweis: fünf Zeilen in `login_attempts` gesetzt, dann
  Anmeldung im gesteuerten Browser; Regel `v_max = 5` je 15 Minuten in `login_attempt_gate`*
- [x] **PROJ-1: keine Kontoauskunft über die Fehlermeldung** — bestehendes Konto mit falschem
  Passwort und unbekannte Adresse liefern **denselben Satz** („E-Mail-Adresse oder Passwort stimmt
  nicht.") bei vergleichbarer Dauer (2121 ms gegen 2037 ms) · *Nachweis: zwei Anmeldeversuche im
  gesteuerten Browser*
- [x] **AC-26 nebenbei belegt** — beim Aufräumen 30 Testkonten gelöscht, danach **0 Zeilen** in
  `expenses`: die Löschweitergabe lässt keine verwaiste Ausgabe zurück · *Nachweis: `delete from
  auth.users where email like '%@e2e.example.com'`, dann `select count(*) from public.expenses`*
- [x] **Umgebung sauber hinterlassen** — alle sechs Container `Up`, keiner `Paused`; Git-Baum ohne
  Änderung · *Nachweis: `docker ps`, `git status --short`*

### Nicht geprüft in diesem Durchlauf

- [!] **Darstellung auf verschiedenen Bildschirmbreiten** (375 / 768 / 1440 px) — `/qa` hat keinen
  Browser für Layoutfragen. Die E2E-Suite fährt Mobile Safari auf iPhone-13-Maßen, prüft dort aber
  **Funktion**, nicht Aussehen
- [!] **Andere Browser-Engines als Chromium und WebKit** — Firefox läuft in keiner Suite
- [!] **Der Knopf „Erneut versuchen"** aus `UnavailableNotice` — dass er da ist und `role="alert"`
  trägt, ist belegt; **dass ein Klick darauf die Seite neu lädt**, wurde nie ausgeführt
- [!] **Die 30 AC und die übrigen 11 EC einzeln** — sie stehen aus den Durchläufen eins bis drei und
  wurden hier nicht neu durchgespielt, sondern über beide Suiten, die Datenbankprüfungen und
  Stichproben abgesichert. AC-24, AC-26, AC-27, AC-10, AC-29, AC-30, EC-1, EC-7 und EC-10 sind
  dabei **doch** einzeln belegt worden (siehe Sicherheit und Regression oben)
- [!] **Drosselung auf den Ausgaben-Wegen** — in PROJ-2 bewusst nicht vorhanden (TD-22). Kein
  Befund, aber keine bestandene Prüfung
- [!] **Ob die 2-Sekunden-Frist außerhalb des lokalen Stacks passt** — offene Frage der Spec.
  Gemessen wurde gegen Supabase in Docker auf derselben Maschine; ein gehostetes Projekt mit kalten
  Netzverbindungen kann legitim länger brauchen

### Bug-Stand nach diesem Durchlauf

- **BUG-6 (Medium) — geschlossen.** Siehe unten; der Befund war gegen die **alte** Fassung von EC-4
  geschrieben und ist gegen die neue erfüllt, mit Messung statt Behauptung
- **BUG-3 (Medium) — geschlossen.** Auf `/konto` steht jetzt **genau eine** „Abmelden"-Schaltfläche
  (im Header) · *Nachweis: `grep -c` auf den ausgelieferten Seitenrumpf → `1`; im Quelltext gibt es
  nur noch `src/components/account/logout-button.tsx`, die Konto-Karte trägt keine zweite mehr*
- **BUG-2 (Low) — unverändert offen**, in diesem Lauf erneut nachgestellt
- **BUG-7 (Low) — neu**, siehe oben: `design.md` rechnet den POST-Weg mit einer Wartestation zu viel


## Acceptance Criteria

### Ausgabe erfassen

#### AC-1 — Erfassen, erscheint ohne Neuladen in der Liste des richtigen Monats
- [x] Die Ausgabe wird mit allen Feldern gespeichert, die Nutzer-ID kommt aus der Sitzung — `src/lib/actions/expenses.test.ts` („schreibt die Ausgabe und meldet den Monat zurück", „nimmt die Nutzer-ID aus der Sitzung, nie aus dem Formular")
- [x] Sie erscheint in der Liste des Monats, zu dem ihr Datum gehört — HTTP: fünf Zeilen angelegt, `GET /` zeigt genau diese fünf mit Datum, Kategorie, Notiz und Betrag
- [!] NICHT GEPRÜFT: „ohne Neuladen" — braucht einen Browser. Der Mechanismus ist da: `refresh()` in `src/lib/actions/expenses.ts:129`

#### AC-2 — Datumsvorbelegung je Monat
- [x] Laufender Monat → heute; früherer Monat → dessen erster Tag — HTTP gegen den Produktions-Build: `/` → `value="2026-08-31"`, `/?monat=2026-07` → `value="2026-07-01"`, `/?monat=2026-03` → `value="2026-03-01"`
- [x] „Heute" wird in Europe/Vienna bestimmt, nicht in der Serverzeitzone — `src/lib/expenses/month.test.ts` („liest „heute" in Wien, nicht in UTC")

#### AC-3 — Nach dem Speichern: Betrag und Notiz leeren, Kategorie und Datum behalten, Fokus ins Betragsfeld
- [!] NICHT GEPRÜFT: reine Browser-Interaktion. Die Regel steht in `src/components/expenses/expense-composer.tsx:74-101`; der Durchstich in `/build` hat sie in Chromium und auf 375 px bestätigt, das ist aber **nicht** dieser Durchlauf

#### AC-4 — Ausgabe in einem anderen Monat: Datum bleibt, Ansicht wechselt, Rückmeldung nennt den Wechsel
- [x] Die Action liefert den Monat **nach** dem Vorgang zurück — `src/lib/actions/expenses.test.ts` („schreibt die Ausgabe und meldet den Monat zurück": Datum 2026-07-14 → `month: '2026-07'`)
- [!] NICHT GEPRÜFT: der Wechsel der Ansicht und der Toast — Browser

#### AC-5 — Betrag 0, negativ oder mit mehr als zwei Nachkommastellen wird abgelehnt
- [x] Im Anwendungscode, mit je eigener Meldung — `src/lib/validation/expense.test.ts` („meldet 0 und negative Beträge mit eigenem Satz", „meldet mehr als zwei Nachkommastellen")
- [x] Auch **am Anwendungscode vorbei**: PostgREST mit gültigem Nutzer-Token, `amount_cents: 0` → `23514 violates check constraint`, `-500` → `23514`
- [x] Nichts wird gespeichert — `src/lib/actions/expenses.test.ts` („schreibt bei einem Feldfehler gar nichts": `from` nie aufgerufen)

#### AC-6 — Komma und Punkt gleich verstanden, Anzeige deutschsprachig
- [x] Beide Trennzeichen ergeben denselben Wert, auch gemischt — `src/lib/validation/expense.test.ts` (`1284,50` = `1284.50` = `1.284,50` = `1,284.50` = 128450 Cent)
- [x] Anzeige mit Tausenderpunkt und Dezimalkomma — HTTP: Gesamtsumme im gerenderten HTML `10.099.815,90 €` bzw. `5.014,50 €`

#### AC-7 — Datum in der Zukunft wird abgelehnt
- [x] `src/lib/validation/expense.test.ts` („lehnt die Zukunft ab") mit fest gesetztem „heute"
- [x] Bewusst **nur** im Anwendungscode: PostgREST nimmt `2099-01-01` an — so entworfen (TD-3, eine uhrabhängige Prüfregel wäre beim Wiedereinspielen einer Sicherung nicht reproduzierbar). Über die Anwendung ist der Weg zu

#### AC-8 — Kategorie ist Pflicht
- [x] Leere Kategorie → „Bitte wähl eine Kategorie." — `src/lib/validation/expense.test.ts`
- [x] Das Auswahlfeld startet ohne Vorauswahl — HTTP: Platzhalter „Wählen" im gerenderten Markup

#### AC-9 — Notiz höchstens 200 Zeichen, leer erlaubt
- [x] 200 zulässig, 201 abgelehnt; leer und nur Leerzeichen werden zu „fehlt" — `src/lib/validation/expense.test.ts`
- [x] Auch an der Datenbank: 201 Zeichen über PostgREST → `23514 violates check constraint`

#### AC-10 — Kategorie aus der festen Liste, auch wenn der Anwendungscode umgangen wird
- [x] Anwendungscode: `urlaub` und `Bewirtung` (Anzeigename statt Schlüssel) → „Diese Kategorie gibt es nicht." — `src/lib/validation/expense.test.ts`
- [x] **Datenbank, am Code vorbei:** PostgREST mit gültigem Token, `category: "urlaub"` → `23514`, `category: "Bewirtung"` → `23514`
- [x] Die neun Schlüssel stimmen mit `docs/data-model.md` überein — `src/lib/expenses/categories.test.ts`

### Liste des Monats

#### AC-11 — Eigene Ausgaben des Monats, absteigend nach Datum, bei gleichem Datum zuletzt erfasste zuerst
- [x] HTTP gegen die laufende App, fünf Zeilen: `12.08. Sonstiges` → `12.08. Gebühren` → `10.08. Bewirtung` → `10.08. Reise` → `05.08. Software` — beide Paare gleichen Datums in umgekehrter Erfassungsreihenfolge, also die zuletzt erfasste zuerst
- [x] Die Sortierung kommt aus der Abfrage, nicht aus einer zweiten Regel in der Oberfläche — `src/lib/expenses/queries.test.ts` („sortiert absteigend nach Datum, bei gleichem Datum die zuletzt erfasste zuerst")
- [x] Datum, Kategorie, Notiz und Betrag stehen in der Zeile — HTTP, siehe oben

#### AC-12 — Leerzustand statt leerer Tabelle
- [x] `/?monat=2026-07` (leerer Monat): „Für Juli 2026 ist noch nichts erfasst." und **keine** `<table>` im HTML; die Erfassungszeile bleibt gerendert und bedienbar

### Monatsübersicht

#### AC-13 — Gesamtsumme hervorgehoben über der Liste
- [x] HTTP: `<span class="… text-[32px] font-bold … tabular-nums …">10.099.815,90 €</span>` — die einzige Zahl in dieser Größe
- [x] Der Wert stimmt exakt mit der Datenbank überein: `select sum(amount_cents)` → `1009981590` Cent = 10.099.815,90 €

#### AC-14 — Je belegter Kategorie eine Zeile mit Summe und Prozent, absteigend, unbelegte fehlen
- [x] HTTP mit 406 Ausgaben über neun Kategorien: neun Zeilen, absteigend `16 · 15 · 12 · 11 · 11 · 11 · 10 · 8 · 6 %`
- [x] Balkenfarben nach Rang aus der Olive-Rampe: `bg-chart-1` … `bg-chart-5`, darunter `bg-muted-foreground` — wie `docs/design-system.md` §6.2 es vorschreibt, kein Amber
- [x] Unbelegte Kategorien erscheinen nicht — im leeren Juli wird die Übersichtsliste gar nicht gerendert
- [ ] **BUG-2 (Low):** Eine Kategorie mit echtem Betrag unter 0,5 % wird als „0 %" mit unsichtbarem Balken angezeigt — siehe Bugs

#### AC-15 — Kategoriefilter, erneuter Klick hebt auf
- [x] Die Zeilen sind Schaltflächen mit gedrückt/nicht-gedrückt-Zustand für Screenreader — HTTP: `aria-pressed="false"` an jeder Kategoriezeile
- [!] NICHT GEPRÜFT: das Filtern selbst und das Aufheben beim zweiten Klick — reiner Browserzustand (`src/components/expenses/month-panel.tsx:41-47`)

#### AC-16 — Summen stimmen ohne Neuladen
- [!] NICHT GEPRÜFT: braucht einen Browser. Alle drei Actions rufen `refresh()` — `src/lib/actions/expenses.test.ts` prüft, dass es je Vorgang genau einmal geschieht

### Monatsnavigation

#### AC-17 — Monat in der Adresse, übersteht Neuladen und Lesezeichen
- [x] `/` ohne Angabe → laufender Monat; `/?monat=2026-06` → „Juni 2026" mit den Zahlen dieses Monats; `/?monat=2026-07` → „Juli 2026" — jeweils frischer HTTP-Abruf, also per Definition neuladefest
- [x] Die Pfeile sind echte Links auf `?monat=` — `src/components/shell/month-switcher.test.tsx` („verlinkt beide Pfeile auf den Nachbarmonat in der Adresse")

#### AC-18 — Pfeilgrenzen, sichtbar aber inaktiv
- [x] Laufender Monat: Vorwärtspfeil ohne Link, mit Screenreader-Satz „Weiter geht es nicht — das ist der laufende Monat." — HTTP
- [x] Ältester Monat (Juni, älteste Ausgabe im Juni): Rückwärtspfeil inaktiv mit „Weiter zurück geht es nicht — davor hast du nichts erfasst." — HTTP
- [x] Dazwischen (Juli) sind beide Pfeile Links — HTTP
- [x] Alle Grenzfälle inklusive Jahreswechsel und „gar keine Ausgabe" — `src/components/shell/month-switcher.test.tsx` (7 Tests, neu in diesem Durchlauf)

#### AC-19 — Unsinnige Monatsangabe zeigt den laufenden Monat statt einer Fehlerseite
- [x] 13 Angriffs- und Unsinnseingaben über HTTP, alle HTTP 200 mit „August 2026" und korrekter Summe: `2026-13`, `2026-00`, `abc`, `2026`, `2026-08-14`, `0202-08`, `2027-05`, `1999-12`, `2026-08' or 1=1--`, `'; drop table expenses;--`, `../../etc/passwd`, `2026-08%00`, `<script>`
- [x] Danach: `select count(*) from expenses` unverändert — nichts wurde eingeschleust

### Ändern und Löschen

#### AC-20 — Änderungsdialog mit gespeichertem Stand, danach neuer Stand in Liste und Summen
- [x] Die Action schreibt und meldet den Monat danach — `src/lib/actions/expenses.test.ts` („schreibt alle vier Felder in einer Anweisung, eingeschränkt auf die eigene Zeile")
- [x] Der Dialog setzt beim Öffnen auf den gespeicherten Stand zurück — `src/components/expenses/edit-expense-dialog.tsx:96-108`
- [!] NICHT GEPRÜFT: das Öffnen und Absenden des Dialogs — Browser

#### AC-21 — Gleiche Regeln beim Ändern
- [x] Beide Wege gehen durch **dasselbe** Schema — `src/lib/validation/expense.test.ts` („wendet beim Ändern dieselben Feldregeln an") und `src/lib/actions/expenses.test.ts` („wendet dieselben Feldregeln an wie das Erfassen": Notiz mit 201 Zeichen, `from` nie aufgerufen)

#### AC-22 — Löschbestätigung nennt Betrag, Kategorie und Datum
- [x] Der Dialog rendert genau diese drei plus die Notiz — `src/components/expenses/delete-expense-dialog.tsx:62-70`
- [!] NICHT GEPRÜFT: das Öffnen des Dialogs und „Abbrechen lässt alles unverändert" — Browser

#### AC-23 — Gelöscht, Rückmeldung, Summen stimmen
- [x] Löschen ist auf die eigene Zeile eingeschränkt und meldet den Monat — `src/lib/actions/expenses.test.ts` („löscht nur die eigene Zeile und meldet den Monat")
- [x] Die Rückmeldung „Ausgabe gelöscht." wird **im Absendeweg** ausgelöst, nicht in einem Effect — `src/components/expenses/delete-expense-dialog.tsx:39-52`. Das ist der Punkt, an dem `/build` einen Fehler hatte: nach `refresh()` verschwindet die Zeile und mit ihr die Komponente, ein Effect käme nie mehr zum Zug
- [!] NICHT GEPRÜFT: dass der Toast sichtbar erscheint — Browser

### Zugriffsschutz

#### AC-24 — Fremde Ausgaben unerreichbar, auch am Anwendungscode vorbei
- [x] **Zwei echte Konten, direkt gegen PostgREST mit gültigen Tokens.** A legt eine Ausgabe an; B: alle lesen → `[]`, gezielt lesen → `[]`, ändern → `[]`, löschen → `[]`, eine Zeile auf As Konto anlegen → `42501 new row violates row-level security policy`. A sieht seine Zeile danach unverändert
- [x] **Anonymer Schlüssel** (der in jedem Browser steckt): lesen → HTTP 401 `42501 permission denied for table expenses`, schreiben → HTTP 401
- [x] **Auf Anwendungsebene:** B ruft `GET /` mit eigener Sitzung ab, während A fünf Ausgaben hat → B sieht den Leerzustand, keine Zeile von A
- [x] RLS an, vier Policies, keine Rechte für `anon` — `psql`: `relrowsecurity=true`, Policies für SELECT/INSERT/UPDATE/DELETE, `has_table_privilege('anon',…)=false`

#### AC-25 — Serverseitige Prüfung aller Regeln, unabhängig vom Browser
- [x] **Die Nutzer-ID kommt nie aus dem Formular:** Testfall schickt `user_id=fremde-id` und `userId=fremde-id` mit — die Anweisung trägt trotzdem `uid-1` aus der Sitzung (`src/lib/actions/expenses.test.ts`)
- [x] Jede Action prüft `requireUser()` **vor** allem anderen — Testfälle „prüft die Anmeldung, bevor irgendetwas geschrieben wird" und „prüft die Anmeldung zuerst": bei fehlender Sitzung wird die Datenbank nie berührt
- [x] Die Zugehörigkeitsbedingung steht zusätzlich in jeder Abfrage — `src/lib/expenses/queries.test.ts` (neu in diesem Durchlauf: `eq user_id` in `listMonth`, `oldestMonth`, `listAll`)

### Datenschutz

#### AC-26 — Kontolöschung entfernt die Ausgaben
- [x] Konto mit einer Ausgabe gelöscht (`delete from auth.users`) → Ausgaben vorher 1, danach 0, verwaiste Profilzeilen 0. Die Löschweitergabe `auth.users → profiles → expenses` trägt, ohne dass die Löschfunktion von PROJ-1 angefasst werden musste

#### AC-27 — CSV-Export auf `/konto`
- [x] Karte „Deine Daten mitnehmen" mit Link auf `/konto/export` — HTTP auf `/konto`
- [x] Antwortköpfe: `content-type: text/csv; charset=utf-8`, `content-disposition: attachment; filename="auslage-export-2026-08-31.csv"`, `cache-control: no-store`
- [x] Inhalt: Kopfblock mit E-Mail und Registrierungsdatum, Leerzeile, Spaltenüberschriften `Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am`, BOM am Anfang, CRLF als Zeilenende, Kategorie als deutscher Anzeigename, Betrag ohne Tausenderpunkt und ohne Zeichen, Erfassungszeitpunkt in Wiener Zeit
- [x] **Vollständig über alle Monate:** 407 Zeilen in der Datenbank (August plus ein März-Beleg) → 411 Zeilen in der Datei = 3 Kopf + 1 Leerzeile + 407 Daten; der März-Beleg ist enthalten
- [x] **Nur die eigenen Daten:** Bs Export enthält Kopfblock und Überschriften, aber keine einzige Zeile von A
- [x] Ohne Ausgaben bleibt der Kopfblock stehen — `src/lib/expenses/csv.test.ts`
- [x] Notizen mit führendem `=`, `+`, `-`, `@` werden als Text markiert statt als Formel geschrieben — **BUG-1, behoben und am 2026-08-31 nachgeprüft:** echter Export gegen den Produktions-Build zeigt `"'-50% Rabatt Parkhaus"`, `"'=Rest aus Juli"`, `"'+Nachtrag"`, `"'@Kunde Meier"`, `"'=cmd|' /C calc'!A0"`; `Hosting 50% Anteil` bleibt unverändert und unbegrenzt

#### AC-28 — Hinweis am Notizfeld
- [x] Dauerhaft sichtbar im Markup, nicht erst im Fehlerfall: „Keine Namen anderer Personen und nichts Sensibles wie Gesundheitsangaben — eine kurze Beschreibung reicht." — HTTP auf `/`, und das Notizfeld verweist per `aria-describedby` darauf

### Feldgrenzen (aus `/refine`)

#### AC-29 — Höchstbetrag 9.999.999,99 €
- [x] Anwendungscode: `10000000,00` → „Der Betrag darf höchstens 9.999.999,99 € sein.", `9999999,99` → angenommen — `src/lib/validation/expense.test.ts`
- [x] Datenbank, am Code vorbei: `amount_cents: 1000000000` → `23514`, `999999999` → angenommen

#### AC-30 — Kein Datum vor dem 01.01.2000
- [x] Anwendungscode: `1999-12-31` und `0202-08-14` → „Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl." — `src/lib/validation/expense.test.ts`
- [x] Datenbank, am Code vorbei: `spent_on: 1999-12-31` → `23514`

---

## Edge Cases

#### EC-1 — Doppelklick auf „Erfassen"
- [x] **Die Zusicherung selbst:** Eindeutigkeitsregel `(user_id, client_token)` — `supabase/migrations/20260831120000_expenses.sql:53`. Über PostgREST nachgestellt: dieselbe Vorgangskennung zweimal → erste Zeile entsteht, zweite `23505 duplicate key value violates unique constraint`
- [x] Der Code macht daraus **Erfolg statt Fehler** — `src/lib/actions/expenses.test.ts` („macht aus dem zweiten Klick keinen Fehler, sondern einen Erfolg"), inklusive der Prüfung, dass der Nachschlag genau diesen einen Vorgang dieser Person sucht
- [!] NICHT GEPRÜFT: die gesperrte Schaltfläche während des Absendens — Browser

#### EC-2 — In einem Tab gelöscht, im anderen geändert oder gelöscht
- [x] **Die Zusicherung:** Ändern und Löschen zählen die betroffenen Zeilen und sind **nie** ein Upsert — `src/lib/actions/expenses.ts:174,193` (`.update(…)`, `.delete()`, jeweils mit `.select()` zur Zählung), keine `upsert`-Stelle im ganzen Modul
- [x] Null betroffene Zeilen → „Diese Ausgabe gibt es nicht mehr.", nichts wird angelegt, und `refresh()` bringt den hängenden Tab auf Stand — `src/lib/actions/expenses.test.ts` („legt bei null betroffenen Zeilen nichts an — kein Upsert")

#### EC-3 — Dieselbe Ausgabe gleichzeitig in zwei Tabs geändert
- [x] **Die Zusicherung:** alle vier Felder in **einer** Anweisung, kein Lesen-Ändern-Zurückschreiben — `src/lib/actions/expenses.test.ts` prüft den Inhalt der Anweisung: `{amount_cents, category, spent_on, note}` in einem `update`-Aufruf. Damit kann keine Mischung aus zwei Ständen entstehen

#### EC-4 — Datenbank nicht erreichbar
- [x] Der Fehlerzweig liefert die formularweite Meldung „Das Speichern hat gerade nicht geklappt. …" statt eines Absturzes — `src/lib/actions/expenses.test.ts` („meldet einen echten Datenbankfehler formularweit"), und `refresh()` wird dann **nicht** gerufen
- [x] Die Eingaben liegen im Browserzustand und werden vom Fehlerpfad nicht angefasst — `src/components/expenses/expense-composer.tsx:46-50` (kontrollierte Felder)
- [!] NICHT GEPRÜFT zur Laufzeit: der echte Ausfall. Die Datenbank dafür anzuhalten hätte den lokalen Stack der Nutzerin gestört

#### EC-5 — Sitzung abgelaufen
- [x] **Der härteste Fall zur Laufzeit geprüft:** Konto angelegt, `GET /` → 200; dann das Konto in der Datenbank gelöscht, während dasselbe Cookie unverändert gültig aussieht → `GET /` → `307 → /login?reason=session-expired`. `requireUser()` fragt den Auth-Server, nicht das Cookie
- [x] Verfälschtes Token → `307 → /login?reason=session-expired`; gar kein Cookie → `307 → /login`

#### EC-6 — Monatsgrenze um Mitternacht (Europe/Vienna)
- [x] `2026-08-31T22:30Z` ist in Wien bereits der 1. September: `todayInVienna` → `2026-09-01`, `currentMonth` → `2026-09` — `src/lib/expenses/month.test.ts`
- [x] `spent_on` ist ein reines Datum (`date`, nicht `timestamptz`) — `supabase/migrations/20260831120000_expenses.sql:15`; es kann beim Anzeigen nicht in eine andere Zeitzone rutschen

#### EC-7 — Rundung der Prozentwerte
- [x] Zur Laufzeit mit 406 Ausgaben: Prozentwerte `16+15+12+11+11+11+10+8+6 = 100 %`, im Rahmen der erlaubten 99–101
- [x] **Die Beträge dagegen exakt:** Summe der neun Kategoriebeträge = 9.981.591 Cent = Gesamtsumme 9.981.591 Cent, aus dem gerenderten HTML zurückgerechnet
- [x] Der Grenzfall mit 99/101 — `src/lib/expenses/summary.test.ts`

#### EC-8 — Ältester Monat wird leer
- [x] Zur Laufzeit: mit einer Juni-Ausgabe zeigt August den Rückwärtspfeil als Link („Zurück zu Juli 2026"); nach `delete from expenses where spent_on < '2026-08-01'` ist er inaktiv mit dem Screenreader-Satz. Die Grenze rückt von selbst nach, weil sie bei jedem Aufbau neu bestimmt und nirgends gespeichert wird

#### EC-9 — Mehrere hundert Ausgaben
- [x] **406 Ausgaben in einem Monat, Produktions-Build:** fünf Abrufe in 0,46 / 0,13 / 0,12 / 0,09 / 0,09 s. Alle 406 Zeilen im HTML, Gesamtsumme und alle neun Kategoriezeilen korrekt, kein Leerzustand fälschlich sichtbar
- [x] Keine Seitenblätterung und keine stille Obergrenze in der Abfrage — `src/lib/expenses/queries.test.ts` („holt keine Seitenblätterung und keine Obergrenze")
- Hinweis: Die Antwort ist dabei ~811 KB HTML. Das ist die Größenordnung, ab der die offene Frage aus `spec.md` und `design.md` (TD-7) wieder aufzumachen wäre — im Zielbild des PRD (eine Handvoll Belege pro Monat) stellt sie sich nicht

#### EC-10 — Sonderzeichen im Export
- [x] Zur Laufzeit im echten Export: Semikolon → `"Rechnung; storniert ""zitiert"""` (begrenzt, innere Anführungszeichen verdoppelt); ein Komma bleibt unbegrenzt, weil das Trennzeichen das Semikolon ist; Zeilenumbruch bleibt im begrenzten Feld und die Spalten verrutschen nicht — `src/lib/expenses/csv.test.ts`
- [x] Führendes `=`, `+`, `-`, `@`, Tabulator und Wagenrücklauf bekommen die Textmarkierung — `src/lib/expenses/csv.test.ts` („nimmt einer Formel den Anfang…", „lässt gewöhnliche Notizen unangetastet", „rührt Datum, Kategorie und Betrag nicht an"), rot nachgewiesen

#### EC-11 — Änderung verschiebt die Ausgabe in einen anderen Monat
- [x] Die Änderungs-Action liefert den Monat **nach** der Änderung — `src/lib/actions/expenses.test.ts` („meldet den neuen Monat, wenn die Änderung die Ausgabe verschiebt": `2026-06`)
- [x] Der Wechsel wird **im Absendeweg** ausgelöst, nicht in einem Effect — `src/components/expenses/edit-expense-dialog.tsx:64-80`; nach `refresh()` ist die Zeile weg und mit ihr der Dialog, ein Effect liefe nie
- [!] NICHT GEPRÜFT: Toast und Ansichtswechsel sichtbar — Browser

---

## Sicherheitsaudit (Red Team)

- [x] **Authentifizierung:** `/`, `/konto`, `/konto/export` und `/?monat=…` ohne Sitzung → jeweils `307 → /login`. Ein POST auf `/` mit `Next-Action`-Kopf ohne Sitzung → `307 → /login`. Der Export liefert unangemeldet keinen Byte CSV, sondern `/login`
- [x] **Autorisierung:** siehe AC-24 — zwei echte Konten, vier Operationen, beide Schichten (RLS in der Datenbank, `.eq('user_id', …)` im Anwendungscode). Der anonyme Schlüssel bekommt `42501 permission denied`
- [x] **XSS:** `<script>alert(1)</script>` und `"><img src=x onerror=alert(1)>` als Notizen gespeichert und `GET /` abgerufen → im Tabellenfeld steht `&quot;&gt;&lt;img src=x onerror=alert(1)&gt;`, kein lebendes Element, kein rohes `<script>`. Auch in der RSC-Nutzlast korrekt als `<` maskiert
- [x] **SQL-Injection:** `2026-08' or 1=1--`, `'; drop table expenses;--`, `../../etc/passwd`, Null-Byte und `<script>` über `?monat=` → alle HTTP 200 mit dem laufenden Monat, Tabelle danach unversehrt. Der Parameter kommt nie in eine Abfrage: `resolveMonth` lässt nur `YYYY-MM` durch (`src/lib/expenses/month.ts:79-88`)
- [x] **Massenzuweisung:** `user_id` im Formular wird ignoriert, die Sitzung gewinnt — siehe AC-25
- [x] **Keine Geheimnisse im Client-Bundle:** `grep` über `.next/static/` nach `service_role`, `sb_secret`, `SERVICE_ROLE`, `JWT_SECRET`, `super-secret` → nichts. Der Quelltext benutzt genau zwei `NEXT_PUBLIC_`-Werte (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — beide sind zum Ausliefern bestimmt. PROJ-2 führt **keine** neue Umgebungsvariable ein
- [x] **Zugangsdaten nie in der Adresse:** alle Formulare rendern mit `method="POST"` — geprüft auf `/`, `/login`, `/signup`. PROJ-2 verarbeitet ohnehin keine Zugangsdaten
- [x] **Keine fremden Daten in Antworten:** Bs Export enthält nur Bs Kopfblock; Bs `GET /` zeigt den Leerzustand, obwohl A 406 Zeilen hat
- [x] **Sicherheits-Header unverändert** (aus PROJ-1): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [!] NICHT GEPRÜFT — **Drosselung:** auf dem Export nicht implementiert; 30 Abrufe hintereinander → 30 × HTTP 200. Das ist so entworfen (TD-22): PROJ-2 prüft keine Zugangsdaten, alles liegt hinter der geprüften Anmeldung von PROJ-1 und zusätzlich hinter RLS. Für eine gewöhnliche Route ist „nicht implementiert" kein Mangel, aber auch kein Haken
- [!] NICHT GEPRÜFT — **Brute Force / Kontoaufzählung:** in diesem Feature **gegenstandslos**, es gibt keinen Anmelde-, Registrierungs- oder Zurücksetzen-Weg. Geprüft wurde das in PROJ-1
- [!] NICHT GEPRÜFT — **CSRF:** eine Server Action mit fremdem `Origin` wurde abgelehnt (HTTP 500 mit anderem Fehler-Digest als bei gleichem Origin), aber ohne Browser lässt sich die Aufrufkonvention von `useActionState` nicht sauber nachbilden — der Unterschied ist damit ein Indiz, kein Beweis. Next.js 16 prüft den Origin von Server Actions eingebaut
- [x] **`[user]`-Aufgaben:** keine offen — `tasks.md` enthält bewusst keine (`design.md` → *Settings the user makes*: „Keine")

---

## Regression

- [x] `/login` und `/signup` liefern HTTP 200 mit ihren Formularen — HTTP
- [x] `/konto` trägt weiterhin **beide** PROJ-1-Karten: E-Mail sichtbar, „Abmelden" (AC-14), „Konto löschen" (AC-15) — HTTP
- [x] Der neue Header steht auf `/konto` **ohne** Monatswechsler, wie TD-20 es festlegt — HTTP: kein `aria-label="Zurück zu …"` auf dieser Seite
- [x] Kontolöschung räumt weiterhin vollständig ab (AC-26 / PROJ-1 AC-15) — Löschweitergabe zur Laufzeit geprüft
- [x] Die Sicherheits-Header aus PROJ-1 sind unverändert — HTTP
- [x] Alle Testdateien von PROJ-1 laufen grün — `npm test`: 14 Dateien, 161 Tests
- [ ] **BUG-3 (Low):** `/konto` zeigt jetzt **zwei** „Abmelden"-Knöpfe — siehe Bugs

---

## E2E-Tests

_Geschrieben von `/e2e-tests` am 2026-08-31 · `tests/PROJ-2-expenses-monthly-overview.spec.ts` ·
läuft auf **Chromium** und **Mobile Safari (iPhone 13)**._

| Journey | Deckt ab | Ergebnis |
|---|---|---|
| **J1** Erfassen, Summen und Filter | AC-1, AC-3, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16 | ✅ grün auf beiden |
| **J2** Der Monat steht in der Adresse | AC-2, AC-4, AC-17, AC-18, AC-19 | ✅ grün auf beiden |
| **J3** Ändern und Löschen | AC-20, AC-21, AC-22, AC-23 · EC-11 | ✅ grün auf beiden (nach der Behebung von BUG-5) |
| **J4** Die eigenen Daten als CSV mitnehmen | AC-27 · EC-10 (inkl. Regressionswache für BUG-1) | ✅ grün auf beiden |
| **J5** Niemand sieht fremde Zahlen | AC-24 | ✅ grün auf beiden |

**Jede Journey wurde rot nachgewiesen** — nacheinander, mit einem gezielten Bruch am Produkt, und
jedes Mal fiel genau der Schritt, um den es geht:

| Journey | Was gebrochen wurde | Was fiel |
|---|---|---|
| J1 | zweiter Klick hebt den Filter nicht mehr auf | `aria-pressed` und die wieder sichtbare Zeile |
| J2 | `resolveMonth` ignoriert die Adresse | die Ausgabe im Vormonat war nicht auffindbar |
| J3 | nichts — sie fiel **von selbst** | Der Klick auf Speichern lief in die Zeitüberschreitung, weil der Knopf dauerhaft Moment … hieß (BUG-5) — auf beiden Engines. Ein stärkerer Nachweis als ein künstlicher Bruch |
| J4 | Textmarkierung vor der Formel entfernt | `toContain(";\"'=Rest aus Juli\";")` |
| J5 | **beide** Schichten: `.eq('user_id', …)` raus **und** RLS-Policy auf `using (true)` | die Seite zeigte `1.276,00 €` statt `41,50 €` — also fremdes Geld |

**Was J5 nicht kann, und das mit Absicht:** Fällt nur **eine** der beiden Schichten, bleibt die
Journey grün — genau das bedeutet Tiefenstaffelung. Einen Bruch allein in Row Level Security fängt
der PostgREST-Test aus dem Sicherheitsaudit oben, nicht der Browser.

**Was diese Suite bewusst nicht abdeckt:** die Feldregeln und ihre Meldungen (AC-5 bis AC-10 — sie
hängen an einem einzigen Schema, das direkt geprüft wird), die Datenbankschicht von AC-24 und AC-25
(dorthin kommt kein Browser), und Darstellungsdetails.

**Zwei Dinge, die am Rand auffielen und behoben wurden:**

1. **`playwright.config.ts` zeigte fest auf `localhost:3000`** mit `reuseExistingServer`. Hielt ein
   anderes Projekt diesen Port, wich `next dev` auf 3001 aus und die **gesamte Suite prüfte
   stillschweigend die falsche Anwendung** — auch die von PROJ-1. Sie läuft jetzt auf einem eigenen
   Port (**3200**, über `E2E_PORT` überschreibbar), dieselbe Logik wie bei Supabase auf 55321.
2. **Zwei veraltete Zusicherungen in der PROJ-1-Suite**, beide durch PROJ-2 verursacht und beide
   kein Produktfehler: Journey 1 prüfte auf die Platzhalter-Überschrift „Hier entstehen deine
   Ausgaben.", die PROJ-2 planmäßig ersetzt hat (jetzt: der Leerzustand der Monatsübersicht), und
   Journey 3 scheiterte an `strict mode violation` — dazu BUG-3 unten.

**Grenze der Testumgebung — behoben.** `supabase/config.toml` erlaubte lokal `sign_in_sign_ups = 30` je
5 Minuten und IP. Die Suite legt je Lauf rund 25 Konten an und lief knapp 6 Minuten, kippte also
über die Kante: drei Tests scheiterten an der Registrierung statt an einer Zusicherung. Der lokale
Wert steht jetzt auf **200**.

**Wichtig:** Das ist die Drosselung der **Auth-Plattform** und gilt nur für den lokalen
Docker-Stack. Die **eigene** Drosselung der Anwendung — `login_attempts`, je IP und je Konto,
PROJ-1 AC-8, AC-9 und AC-17 — ist unberührt und bleibt scharf. Genau die meinen die
Sicherheitsregeln. Entstünde später doch ein gehostetes Projekt, gehört dieser Wert dort
**nicht** angehoben.

**Endstand:** `npm run test:e2e` → **18 von 18 grün in 1,2 Minuten** (9 Journeys × 2 Engines:
4 aus PROJ-1, 5 aus PROJ-2).

---

## Nicht geprüft in diesem Durchlauf

- [!] Darstellung in verschiedenen Browsern (Chrome / Firefox / Safari) — `/qa` läuft ohne Browser
- [!] Darstellung bei 375 px / 768 px / 1440 px — kein echtes Ansichtsfenster
- [!] Browser-Konsole und Netzwerk-Tab — keine Entwicklerwerkzeuge
- [!] AC-3 — Leeren, Behalten und Fokussprung nach dem Speichern (Browser-Interaktion)
- [!] AC-4 / EC-11 — der sichtbare Ansichtswechsel und die Toasts (Browser)
- [!] AC-15 — Filtern und Aufheben durch Klick (reiner Browserzustand)
- [!] AC-16 — dass die Summen **ohne Neuladen** stimmen (Browser)
- [!] AC-20 / AC-22 — Öffnen der Dialoge, „Abbrechen lässt alles unverändert" (Browser)
- [!] EC-1 — die gesperrte Schaltfläche während des Absendens (Browser)
- [x] ~~EC-4 — der echte Datenbankausfall (hätte den lokalen Stack angehalten)~~ → **im zweiten
  Durchlauf am 01.09.2026 nachgeholt**, zweimal herbeigeführt (`docker pause` auf die Datenbank und
  getrennt davon auf PostgREST). Der Stack wurde jedes Mal sofort wieder freigegeben

**Nicht geprüft im zweiten Durchlauf (01.09.2026):**
- [!] Der Schreibweg bei Nichterreichbarkeit zur Laufzeit — die RSC-Kodierung der Formularfelder ließ
  sich mit `curl` nicht nachbauen. Abgedeckt durch drei Unit-Tests und indirekt durch PROJ-3 Journey 3
- [!] Der Knopf „Erneut versuchen" — im Markup vorhanden, seine Wirkung (`router.refresh()`) braucht
  einen Browser
- [!] Zugriff quer über zwei **angemeldete** Konten — in diesem Lauf entstand nur eine Sitzung; im
  ersten Durchlauf mit zwei echten Sitzungen geprüft und bestanden
- [!] Die übrigen 30 AC und 10 EC wurden **nicht einzeln neu durchgespielt** — sie stehen unverändert
  aus dem ersten Durchlauf, abgesichert über 242 Unit-Tests und 28 E2E-Tests
- [!] CSRF — nur als Indiz belegt, siehe Sicherheitsaudit
- [!] Drosselung — bewusst nicht implementiert (TD-22)

> **Zur Einordnung:** Der `/build`-Durchlauf hat die browserabhängigen Wege am selben Tag in Chromium **und** auf 375 px durchgespielt (erfassen, summieren, filtern, ändern, löschen, Monatswechsel in beide Richtungen, CSV-Download). Das war ein anderer Durchlauf und zählt hier bewusst nicht als Nachweis — es ist der Grund, warum diese Punkte trotz `[!]` nicht als Risiko gelten. `/e2e-tests` macht daraus einen dauerhaften Nachweis.

---

## Gefundene Bugs

### BUG-1: Notizen mit führendem `=`, `+`, `-` oder `@` wurden im CSV als Formel gelesen — **BEHOBEN**
- **Severity:** Medium
- **Betrifft:** AC-27, EC-10
- **Status:** behoben am 2026-08-31, nachgeprüft in diesem Bericht
- **Was war:** Eine Ausgabe mit der Notiz `-50% Rabatt Parkhaus`, `=Rest aus Juli` oder `+Nachtrag` landete **unbegrenzt** in der Datei (`…;3,50;-50% Rabatt Parkhaus;…`). Excel, LibreOffice und Numbers lesen das als Formel und zeigen `#NAME?` statt der Notiz — AC-27 verspricht eine Datei, die sich „ohne Nacharbeit" öffnen lässt. In der DDE-Form (`=cmd|' /C calc'!A0`) ist es zugleich der bekannte CSV-Injection-Weg; fremde Notizen kann zwar niemand schreiben (RLS), aber `design.md` nennt Steuerberater:innen ausdrücklich als Empfänger — Schreiber und Öffner sind also nicht zwingend dieselbe Person
- **Der Fix:** `src/lib/expenses/csv.ts` — Felder, die mit `=`, `+`, `-`, `@`, Tabulator oder Wagenrücklauf beginnen, bekommen ein vorangestelltes Hochkomma (die übliche Textmarkierung, die die gängigen Programme beim Anzeigen schlucken) und werden zusätzlich begrenzt. **Begrenzen allein hätte nicht gereicht:** die Tabellenkalkulation entfernt die Anführungszeichen zuerst und sieht die Formel danach. Die Regel steht jetzt auch in `design.md` → *Der Export*
- **Nachweis:** drei neue Tests in `src/lib/expenses/csv.test.ts`, rot nachgewiesen (ohne die Markierung fällt der Formeltest). Dazu ein echter Abruf von `/konto/export` gegen den Produktions-Build mit genau den Notizen, die den Bug ausgelöst haben — alle fünf jetzt markiert, `Hosting 50% Anteil` unverändert, die Semikolon-Begrenzung aus EC-10 unberührt
- **Nebenwirkungen geprüft:** Datum, Kategorie und Betrag werden nicht angefasst (Beträge sind laut AC-5 immer größer 0, beginnen also nie mit einem Minus)

### BUG-2: Kategorien unter 0,5 % Anteil erscheinen als „0 %" mit unsichtbarem Balken
- **Severity:** Low
- **Betrifft:** AC-14
- **Schritte zur Reproduktion:**
  1. In einem Monat erfassen: 5.000,00 € Hardware, 9,00 € Gebühren, 3,50 € Reise, 2,00 € Sonstiges
  2. `/` aufrufen
  3. Erwartet: jede belegte Kategorie zeigt ihren Anteil
  4. Tatsächlich: drei Kategorien mit echtem Betrag zeigen „0 %", und ihr Anteilsbalken hat `width:0%`, ist also gar nicht sichtbar — die Zeile liest sich wie „hier ist nichts", obwohl 9,00 € dort stehen
- **Wo:** `src/lib/expenses/summary.ts:41` (`Math.round`) und `src/components/expenses/category-breakdown.tsx:61` (Balkenbreite = Prozentwert)
- **Vorschlag:** „<1 %" statt „0 %", und dem Balken eine Mindestbreite geben, sobald der Betrag größer 0 ist
- **Priorität:** Nächste Runde
- **Stand 01.09.2026 (vierter Durchlauf): unverändert offen, erneut nachgestellt.** Monat Juli
  mit 5.000,00 € Hardware · 9,00 € Gebühren · 3,50 € Reise · 2,00 € Sonstiges: die drei kleinen
  Kategorien zeigen 0 % und tragen `width:0%`, sind also unsichtbar. Der Code ist unangetastet
  (`src/lib/expenses/summary.ts:39`, `src/components/expenses/category-breakdown.tsx:58,63`).
  **EC-7 bleibt davon unberührt:** Die Euro-Summen ergeben exakt die angezeigte Gesamtsumme
  (5.000,00 + 9,00 + 3,50 + 2,00 = 5.014,50 €) · *Nachweis: Daten eingespielt, `/?monat=2026-07`
  mit echter Sitzung abgerufen, Balkenbreiten aus dem HTML gelesen*
### BUG-3: `/konto` zeigt zwei gleich benannte „Abmelden"-Schaltflächen — **BEHOBEN**
- **Severity:** ~~Low~~ → **Medium** (hochgestuft am 2026-08-31 durch `/e2e-tests`)
- **Status:** **behoben und verifiziert am 01.09.2026 (vierter Durchlauf).** Auf `/konto` steht
  genau **eine** Abmelden-Schaltfläche, im Header. Die Routing-Frage wurde über `/refine PROJ-1`
  entschieden (Commits `2384585` / `e125ec0`), nicht nebenbei im Code · *Nachweis: `grep -c` auf
  den ausgelieferten Rumpf von `/konto` mit echter Sitzung → **1**; im Quelltext existiert nur
  noch `src/components/account/logout-button.tsx`, die Konto-Karte trägt keine zweite mehr*
- **Betrifft:** Bedienbarkeit und Barrierefreiheit; PROJ-1 AC-14 ist doppelt erfüllt statt gar nicht
- **Schritte zur Reproduktion:** angemeldet `/konto` aufrufen → einer im Header, einer in der Karte „Konto"
- **Warum nicht mehr nur kosmetisch:** Der E2E-Lauf ist daran gescheitert —
  `getByRole('button', { name: 'Abmelden' })` löst zu **zwei** Elementen auf. Was einen Testläufer
  zum Abbruch bringt, trifft Screenreader genauso: zwei identisch benannte Schaltflächen auf einer
  Seite, ohne unterscheidenden Kontext. Die PROJ-1-Suite musste auf `getByRole('main')` eingegrenzt
  werden, um überhaupt weiterzulaufen
- **Ursache:** So entworfen: `design.md` von PROJ-2 schreibt „Card „Konto" unverändert (PROJ-1)" und ergänzt den Header darüber. Die Karte gehört PROJ-1
- **Priorität:** Eine **Routing-Frage**, kein einfacher Fix — den Knopf aus der Karte zu nehmen ändert PROJ-1s Vertrag und gehört über `/refine PROJ-1`

### BUG-4: Kein Fehlerzustand für die Seite, wenn das Lesen des Monats scheitert
- **Severity:** ~~Low~~ → **High** (hochgestuft am 2026-09-01 im zweiten Durchlauf)
- **Status:** **BEHOBEN am 01.09.2026, verifiziert im dritten Durchlauf.** `MonthView` fängt ein
  Nichterreichen ab und zeigt `UnavailableNotice`; jeder andere Fehler fliegt weiter. Unabhängig
  nachgeprüft: HTTP 200 nach 2,27 s, null Umleitungen, Meldung und Knopf vorhanden, Rahmen steht
- **Betrifft:** ~~keine AC~~ → **EC-4**. Der `/refine` vom 01.09.2026 hat EC-4 ausdrücklich auf das
  **Lesen** ausgeweitet: „… wenn eine geschützte Seite **geladen** … wird, dann gibt die App nach
  höchstens 2 Sekunden auf und zeigt eine verständliche Meldung." Genau das leistet dieser Pfad nicht
- **Warum die Behebung vom 01.09.2026 ihn nicht schließt:** Sie hängt an der **Sitzungsprüfung**.
  Fallen Datenbank und Auth-Server zusammen aus — der Fall, den `/build` gemessen hat —, greift sie
  und alles ist gut. Bleibt der Auth-Server aber erreichbar und steht **nur der Datenzugriff**, ist
  die Sitzung feststellbar, `requireUser()` liefert die Person, und erst die Monatsabfrage wirft.
  Dort fängt sie niemand
- **Was die Person dann sieht — schlechter als im ersten Durchlauf beschrieben:** nicht Next.js'
  englische Fehlerseite, sondern **dauerhaft das Ladegerüst**. HTTP 200, und der sichtbare Text der
  ganzen Seite lautet: „auslage." Keine Meldung, kein Knopf, kein Hinweis, dass etwas nicht stimmt
- **Schritte zur Reproduktion:**
  1. Angemeldet sein
  2. `docker pause supabase_rest_praxisprojekt-ai-engineering` (**nur** PostgREST, nicht die Datenbank)
  3. `/` aufrufen
  4. Erwartet (EC-4): binnen 2 Sekunden eine verständliche Meldung
  5. Tatsächlich: HTTP 200 nach **4,46 s**, nur das Ladegerüst, keine Meldung
- **Nachweis:** `curl -b cookies.txt -w "%{http_code} %{time_total}"` → `200 4.464443`; `grep` auf
  „Wir erreichen deine Daten" = **0** Treffer; Seitentext nach Entfernen aller Tags: `auslage.
  auslage .`; im Server-Log `⨯ Error: {"message":"Error: auslage/unreachable: The operation was
  aborted due to timeout", …, "code":""}` mit `digest: 3984802547@E394`
- **Warum das nicht exotisch ist:** Es braucht keinen Ausfall. **Jede** Datenabfrage, die die
  Zwei-Sekunden-Frist reißt — eine langsame Abfrage unter Last, ein hängender Verbindungspool —
  landet auf demselben Pfad. Der Ausfall ist nur die zuverlässigste Art, ihn herbeizuführen
- **Fix-Richtung (für `/build`, nicht hier entschieden):** Der Lesepfad braucht denselben Ausgang wie
  die Sitzungsprüfung — die Abfragen in `queries.ts` abfangen und `UnavailableNotice` zeigen, oder
  eine `error.tsx` für `/`, die `isUnreachable` auswertet. Der Baustein dafür existiert bereits
- **Was der Export richtig macht:** `src/app/konto/export/route.ts` fängt genau diesen Fall ab und
  antwortete im selben Test korrekt mit **HTTP 503** — dort wurde daran gedacht, auf der Seite nicht
- **Schritte zur Reproduktion:** Schlägt die Monatsabfrage fehl, wirft `queries.ts` weiter (`src/lib/expenses/queries.ts:40,61,76`), und es gibt weder `error.tsx` noch `global-error.tsx` in `src/app/`
- **Tatsächlich:** die Person sieht Next.js' eigene, englische Standardseite „This page couldn't load — A server error occurred." in einer sonst durchgehend deutschsprachigen Anwendung (im `/build`-Durchlauf einmal so beobachtet)
- **Priorität:** Nächste Runde — eine `error.tsx` mit einem deutschen Satz und einem „Neu laden"-Knopf schließt das

### BUG-6: Die Frist gilt je Aufruf, nicht je Anfrage — mehrere Aufrufe addieren sich — **GESCHLOSSEN**
- **Severity:** Medium · **Status:** **geschlossen am 01.09.2026 im vierten Durchlauf** ·
  **Betrifft:** **EC-4** · gefunden im zweiten Durchlauf

> **Wie er geschlossen wurde — und wie ausdrücklich nicht.** Nicht durch einen neuen Mechanismus:
> Der `/refine` vom 01.09.2026 hat **den Vertrag** berichtigt, statt die Anwendung zu einer Zahl zu
> zwingen, die keine Architektur mit mehreren Aufrufen halten kann. EC-4 nennt seither **zwei**
> Zahlen — 2 Sekunden je Aufruf (Mechanismus) und 5 Sekunden je Anfrage (Zusage an die Person).
> Gegen die neue Fassung ist der Befund **erfüllt und gemessen**: der höchste Wert über vier Wege
> und je drei Läufe ist **3,19 s**, der POST-Weg liegt bei **2,04–2,26 s**. Der im Befund genannte
> Wert von 4,07 s ließ sich im vierten Durchlauf **nicht mehr reproduzieren** — auch nicht mit der
> echten Server Action im Browser (2,08 s). Grund: Bei Nichterreichen kehrt die Action zurück, ohne
> `refresh()` aufzurufen, sodass die zweite Sitzungsprüfung im Ausfall gar nicht stattfindet
> (`src/lib/actions/expenses.ts:198-201`). Festgehalten wird die Grenze jetzt von **T28**
> (`tests/outage.spec.ts`) und **T29** (`month-view.test.tsx`), damit sie nicht unbemerkt reißt.
> Der ursprüngliche Befund steht unverändert darunter.
- **Was passiert:** EC-4 sagt „gibt die App **nach höchstens 2 Sekunden** auf". Gemessen wurde beim
  Lesen der Seite 2,1 s — beim **POST auf dieselbe Seite** aber **4,1 s**

> **Korrektur vom 01.09.2026 (im `/build`-Lauf zu BUG-4 nachgemessen).** Dieser Befund nannte
> ursprünglich zusätzlich „4,5 s beim Lesen mit ausgefallenem Datenzugriff, weil sich die zwei
> Abfragen der Monatsansicht addieren". **Das war falsch.** `MonthView` führt seine beiden Abfragen
> über `Promise.all` **parallel** aus, es gibt dort also nur *eine* Frist. Die Instrumentierung zeigt
> `getUser 58 ms` und `Abfragen gescheitert nach 2019 ms`, gesamt **2,21 s**. Die zuvor gemessenen
> 4,46 s und 3,28 s waren die **Erstübersetzung** der Route durch den Entwicklungsserver, kein
> Aufaddieren. Der Befund bleibt bestehen — aber **nur** für den POST-Fall, und der ist durch die
> Zeitmessung unten sauber belegt.
- **Ursache, gemessen statt vermutet:** vorübergehend eingebaute Zeitmessung in `proxy.ts` und
  `auth.ts`, dann je ein Aufruf bei angehaltener Datenbank:

  | | Vorprüfung | `getUser()` | gesamt |
  |---|---|---|---|
  | `GET /` | 67 ms | **2013 ms** | 2,1 s |
  | `POST /` | 1 ms | **2013 ms + 2015 ms** | 4,1 s |

  Ein POST auf die Seite führt **zwei** Sitzungsprüfungen hintereinander aus, jede mit eigener
  Zwei-Sekunden-Frist. Der Lesepfad ist davon **nicht** betroffen (siehe Korrektur oben)
- **Schritte zur Reproduktion:** `docker pause` auf den Datenbank-Container, dann mit gültiger
  Sitzung `curl -w "%{time_total}" -X POST http://localhost:3300/` → 4,06 s, 4,09 s, 4,13 s in drei
  aufeinanderfolgenden Läufen
- **Warum Medium und nicht High:** Der Vertrag wird um den Faktor zwei verfehlt, aber die Meldung
  kommt, es wird nichts geschrieben, nichts geht verloren, und gegenüber den 50,4 s des ersten
  Durchlaufs ist es eine Verbesserung um mehr als das Zehnfache. Es tritt nur ein, wenn die
  Gegenstelle ohnehin steht
- **Warum nicht Low:** Die Zahl „zwei Sekunden" ist nicht Beiwerk, sie war der **Zweck** des
  `/refine`. Ein Vertrag, der um das Doppelte verfehlt wird, ist kein erfüllter Vertrag
- **Fix-Richtung (für `/build`, nicht hier entschieden):** entweder die Frist als **Budget je
  Anfrage** führen (ein gemeinsames Abbruchsignal, das mit der ersten Anfrage zu laufen beginnt),
  oder EC-4 über `/refine` auf „je Aufruf" präzisieren. Das ist eine Vertragsfrage, keine reine
  Codefrage — deshalb steht sie hier und wird nicht nebenbei entschieden

### BUG-7: `design.md` rechnet den POST-Weg mit einer Wartestation zu viel
- **Severity:** **Low** · **Status:** offen · **Betrifft:** `design.md` → *Das Zeitbudget einer
  Anfrage* und TD-32 · gefunden im vierten Durchlauf
- **Was nicht stimmt:** Die Entwurfstabelle führt den Weg „POST, Auth und Datenbank aus" mit
  **4,07 s** und begründet das mit **zwei** Sitzungsprüfungen hintereinander. Gemessen wurden im
  vierten Durchlauf **2,04–2,26 s** über HTTP und **2,08 s** mit der echten Server Action im
  Browser — also **eine** Wartestation, nicht zwei
- **Ursache:** Meldet `requireUser()` ein Nichterreichen, kehrt die Action sofort mit der
  formularweiten Meldung zurück und ruft **`refresh()` gar nicht erst auf**
  (`src/lib/actions/expenses.ts:198-201`, ebenso `:277-280` und `:361-364`). Der Seitenneuaufbau,
  der die zweite Prüfung tragen würde, findet im Ausfall also nicht statt. Die 4,07 s stammen aus
  dem zweiten Durchlauf und beschreiben einen Zustand, den der Code heute nicht mehr durchläuft
- **Warum das trotzdem ein Befund ist:** Die Zahl trägt im Entwurf den Abschnitt *Wo die Grenze
  reißen könnte* — mit 4,07 s sieht die 5-Sekunden-Zusage aus, als hinge sie an einem Faden (81 %
  des Budgets), tatsächlich sind es 48 %. Ein künftiger Entwurf, der sich daran orientiert,
  verzichtet auf Wege, die problemlos möglich wären, oder hält die Grenze für unhaltbar
- **Warum Low:** Kein Fehlverhalten der Anwendung. Der Vertrag wird eingehalten, die Reserve ist
  **größer** als dokumentiert — die Richtung des Fehlers ist die ungefährliche
- **Fix-Richtung (nicht hier entschieden):** Die Tabelle in `design.md` auf die Messwerte des
  vierten Durchlaufs bringen und dabei festhalten, **warum** der POST-Weg im Ausfall nur eine
  Prüfung macht. TD-32 selbst bleibt richtig: Im **Normalbetrieb** prüft ein POST die Sitzung
  weiterhin zweimal (dort rund 50 ms, wie TD-32 schreibt)

### BUG-5: Nach einer Änderung blieb der Dialog dauerhaft auf „Moment …" stehen — **BEHOBEN**
- **Severity:** **High**
- **Status:** behoben am 2026-08-31, nachgeprüft — Journey 3 läuft auf beiden Engines grün
- **Betrifft:** AC-20, AC-21 — gefunden von `/e2e-tests`, Journey 3, auf **Chromium und Mobile Safari**
- **Schritte zur Reproduktion:**
  1. Eine Ausgabe erfassen
  2. „Ändern" wählen, den Betrag ändern, „Speichern" — die Änderung wird korrekt gespeichert, der Dialog schließt
  3. Bei **derselben** Ausgabe erneut „Ändern" wählen
  4. Erwartet: der Dialog öffnet mit dem gespeicherten Stand und lässt sich wieder speichern (AC-20)
  5. Tatsächlich: der Dialog öffnet zwar, aber **„Speichern" heißt „Moment …" und ist gesperrt**, „Abbrechen" ebenso. Die Ausgabe lässt sich bis zum Neuladen der Seite nicht mehr ändern
- **Nachweis:** Schnappschuss aus dem Testlauf — `button "Abbrechen" [disabled]`, `button "Moment …" [disabled]`, während das Datumsfeld den neuen Wert bereits trägt
- **Ursache:** `src/components/expenses/edit-expense-dialog.tsx` — der Erfolgspfad von `submit()` verlässt die Funktion mit `return`, **ohne `setPending(false)`**. Bleibt die Ausgabe im selben Monat, bleibt die Zeile stehen, die Komponente wird nicht ausgehängt, und `isPending` bleibt für immer `true`. Verschiebt die Änderung die Ausgabe dagegen in einen anderen Monat, verschwindet die Zeile — dann fällt es nicht auf. Der Fehler trifft also genau den häufigen Fall
- **Warum `/qa` das nicht gefunden hat:** AC-20 stand dort als `[!] NICHT GEPRÜFT` — das Öffnen und Absenden eines Dialogs braucht einen Browser. Genau diese Lücke war der Grund für diese E2E-Runde
- **Der Fix:** `setPending(false)` steht in beiden Dialogen jetzt in einem `finally`, nicht am Ende des Fehlerpfads — so kann kein künftiger Pfad das Zurücksetzen wieder vergessen, auch keiner, der eine Ausnahme wirft
- **Der Lösch-Dialog trug dieselbe Falle**, nur verdeckt: dort verschwindet die Zeile immer, die Komponente wird also stets ausgehängt. Mitgefixt, weil verdeckt nicht abwesend heißt
- **Nachweis:** `npm run test:e2e` → 18 von 18 grün; vorher fiel Journey 3 auf **beiden** Engines an genau diesem Schritt

---

## Zusammenfassung — vierter Durchlauf (01.09.2026)

- **Geprüft:** die neu gefasste EC-4 (zwei Zahlen) an der laufenden Anwendung, die beiden neuen
  Zusicherungen aus Ebene 11 (T28, T29), der Verbleib von BUG-6, BUG-3 und BUG-2, dazu die
  vollständige Angriffsliste und Regression über alle drei Features
- **Ergebnis:** **EC-4 vollständig erfüllt und gemessen** — höchster Wert 3,19 s gegen eine Zusage
  von 5 s. **BUG-6 geschlossen**, **BUG-3 geschlossen**
- **Bugs:** 0 Critical · 0 High · **0 Medium** · **2 Low** (BUG-2 unverändert, BUG-7 neu)
- **Security:** **12 Prüfungen bestanden**, **1 NICHT GEPRÜFT** (Drosselung auf den
  Ausgaben-Wegen — in PROJ-2 bewusst nicht vorhanden, TD-22)
- **Tests:** 247 Unit-/Integrationstests grün (vorher 246) · 28 von 28 E2E grün in beiden Browsern ·
  Ausfall-Zusicherung grün · Lint und Produktions-Build ohne Befund
- **Production Ready:** **JA** — kein Critical- oder High-Befund, und die Kriterien, um die es in
  dieser Runde ging, wurden an der laufenden Anwendung **wirklich ausgeführt**, nicht nur gelesen

**Was jetzt trägt — und warum es diesmal mehr ist als eine Behauptung.** Der Ausfall wurde viermal
echt herbeigeführt und mit zwei unabhängigen Methoden gemessen: über HTTP mit `curl` und über einen
gesteuerten Browser, der die wirkliche Server Action auslöst. Beide kommen auf dieselben
Größenordnungen, und alle vier Wege liegen unter der Hälfte bis zu zwei Dritteln des Budgets. Aus
den 50,4 Sekunden des ersten Durchlaufs sind gut 2 Sekunden mit einer verständlichen Meldung
geworden — und die Grenze hängt nicht mehr am Gedächtnis der nächsten Person, die den Code anfasst:
**T29 wurde nachweislich rot**, als die beiden Abfragen probeweise nacheinander liefen, und **T28**
misst den echten Ausfall.

**Der eine Befund, der neu ist, geht in die ungefährliche Richtung.** `design.md` rechnet den
POST-Weg pessimistischer, als er ist (BUG-7, Low): Die dort genannten 4,07 s entstehen aus zwei
Sitzungsprüfungen, die im Ausfall gar nicht beide stattfinden, weil die Action ohne `refresh()`
zurückkehrt. Die Anwendung ist also besser als ihr Entwurf — dokumentiert werden sollte trotzdem,
was wirklich passiert.

**Was dieser Lauf nicht geprüft hat.** Darstellung auf verschiedenen Bildschirmbreiten und in
anderen Browser-Engines (`/qa` hat keinen Browser für Layoutfragen; die 28 E2E-Journeys decken
Chromium und Mobile Safari funktional ab, nicht optisch), die Wirkung des Knopfes „Erneut
versuchen", und die 30 AC samt der übrigen 11 EC einzeln — die stehen aus den Durchläufen eins bis
drei und wurden hier über beide Suiten, die Datenbankprüfungen und Stichproben abgesichert.

---

## Zusammenfassung — dritter Durchlauf (01.09.2026)

- **Geprüft:** die Behebung von BUG-4, unabhängig vom Bau nachgestellt, plus Sicherheit und Regression
- **Ergebnis:** **BUG-4 geschlossen.** Damit ist **kein Critical- und kein High-Befund mehr offen**
- **Bugs:** 0 Critical · 0 High · **2 Medium** (BUG-6, BUG-3) · 1 Low (BUG-2)
- **Security:** 3 Stichproben bestanden, die vollständige Liste steht aus dem zweiten Durchlauf
- **Tests:** 246 Unit-/Integrationstests grün (vorher 242) · 28 von 28 E2E grün in beiden Browsern
- **Production Ready:** **JA** — kein Critical- oder High-Befund. **Mit zwei benannten Einschränkungen**
  (siehe unten); „Ready" heißt hier *keine blockierenden Fehler gefunden*, nicht *alles geprüft*

**Was jetzt trägt.** Der würdige Ausfall, um den es im `/refine` ging, hält auf allen drei Wegen:
Fallen Datenbank und Auth-Server zusammen aus, greift die Sitzungsprüfung (2,12 s). Fällt **nur** der
Datenzugriff aus, greift `MonthView` (2,27 s). Der Export antwortet mit 503. In allen drei Fällen
steht der Rahmen, die Meldung ist dieselbe, und es wird **nicht** auf `/login` umgeleitet.

**Die zwei Einschränkungen, die bewusst offen bleiben.**

1. **BUG-6 (Medium): EC-4 wird auf dem POST-Pfad um den Faktor zwei verfehlt** — 4,07 s statt der
   zugesagten 2 Sekunden, weil zwei Sitzungsprüfungen hintereinander je ihre eigene Frist bekommen.
   Der Vertrag ist damit auf diesem Pfad **nicht vollständig erfüllt**. Das ist eine bewusste
   Freigabe mit bekanntem Mangel, keine Feststellung, dass EC-4 erfüllt wäre
2. **BUG-3 (Medium): zwei gleich benannte „Abmelden"-Schaltflächen auf `/konto`** — unverändert eine
   Routing-Frage, die PROJ-1s Vertrag berührt

**Was dieser Lauf nicht geprüft hat.** Darstellung auf verschiedenen Bildschirmbreiten und in anderen
Browsern (kein Browser in `/qa`), die Wirkung des Knopfes „Erneut versuchen", der Schreibweg bei
Nichterreichbarkeit zur Laufzeit (durch Unit-Tests abgedeckt), und die vollständige Angriffsliste
(im zweiten Durchlauf abgearbeitet). Die 30 AC und 10 unveränderten EC wurden **nicht** einzeln neu
durchgespielt.


## Zusammenfassung — zweiter Durchlauf (01.09.2026)

- **Geprüfte Kriterien:** **EC-4** (neu gefasst) und **EC-12** (neu) — die beiden, die der `/refine`
  verändert hat. Die übrigen 30 AC und 10 EC stehen unverändert aus dem ersten Durchlauf und wurden
  hier über die Suiten und Stichproben abgesichert, **nicht** einzeln neu durchgespielt
- **Ergebnis:** **EC-12 vollständig erfüllt.** **EC-4 teilweise** — der Fall, für den das `/refine`
  angestoßen wurde (BUG-3 aus PROJ-3: 50,4 Sekunden Hängen), ist geschlossen und mit **2,12 s**
  belegt. Zwei Lücken bleiben
- **Bugs:** 0 Critical · **1 High** (BUG-4, von Low hochgestuft) · **2 Medium** (BUG-6 neu, BUG-3
  unverändert) · 1 Low (BUG-2)
- **Security:** 7 Prüfungen bestanden, **1 nicht geprüft** (Zugriff quer über zwei angemeldete
  Konten — im ersten Durchlauf bestanden). Zugriffsschutz, RLS mit gültigem anon-Schlüssel,
  POST-Formulare, keine Secrets im Bundle, serverseitige Prüfung, Drosselung nach 6 Fehlversuchen
- **Tests:** 242 Unit-/Integrationstests grün (vorher 214) · 28 von 28 E2E grün in beiden Browsern ·
  Lint und Build ohne Befund
- **Production Ready:** **NEIN** — ein High-Befund steht offen

**Was gut ist.** Die Ursache aus dem PROJ-3-Bericht ist beseitigt und doppelt belegt: einmal über
den Browser im `/build`-Lauf, einmal hier über HTTP mit einer anderen Methode. Aus 50,4 Sekunden
ohne Text sind 2,1 Sekunden mit einer verständlichen Meldung geworden, die Weiterleitung mit der
falschen Begründung („Sitzung abgelaufen") ist weg, der Rahmen bleibt stehen, und der Export
antwortet sauber mit 503. Die Unterscheidung „Antwort gegen Nichterreichen" ist im Code verankert
und durch Tests abgesichert, nicht bloß behauptet.

**Was fehlt — und beides hat dieselbe Wurzel.** Die Behebung hängt vollständig an der
**Sitzungsprüfung**. Das deckt den gemessenen Fall ab, weil dort Datenbank und Auth-Server zusammen
ausfielen. Es deckt **nicht** ab, was passiert, wenn nur der Datenzugriff wegbricht: Dann ist die
Sitzung feststellbar, die Monatsabfrage wirft, und die Person sieht dauerhaft ein Ladegerüst ohne
ein Wort Erklärung (**BUG-4**). Und weil jede Abfrage ihre eigene Frist bekommt statt eines Budgets
je Anfrage, addieren sich die Wartezeiten auf das Doppelte des Zugesagten (**BUG-6**).

**Die Lehre für den nächsten Durchgang.** Der `/build`-Lauf hat den Ausfall am
**Datenbank-Container** herbeigeführt — und damit unabsichtlich den einen Fall gewählt, in dem die
gebaute Lösung greift. Erst das Anhalten **nur** von PostgREST hat die Lücke gezeigt. Wer eine
Zusicherung über Erreichbarkeit prüft, muss die Bestandteile **einzeln** ausfallen lassen, nicht
gemeinsam: Ein gemeinsamer Ausfall ist der freundlichste aller Fälle, weil er zuerst dort auffällt,
wo man schon hinsieht.


## Zusammenfassung

- **Acceptance Criteria:** **30 von 30 geprüft** — 29 vollständig bestanden, 1 mit einem offenen Befund (AC-14 → BUG-2). AC-27 und EC-10 sind nach der Behebung von BUG-1 vollständig bestanden. Bei 8 Kriterien ist eine rein browserabhängige Teilzusicherung als `[!]` offen (oben einzeln benannt)
- **Edge Cases:** 11 von 11 geprüft, alle bestanden
- **Gefundene Bugs:** 5 (0 Critical, 1 High, 2 Medium, 2 Low). **Behoben und nachgeprüft: BUG-1 (Medium) und BUG-5 (High).** Offen: BUG-3 (Medium, hochgestuft), BUG-2 und BUG-4 (Low)
- **Sicherheit:** 9 Prüfungen belegt, 4 NICHT GEPRÜFT — Drosselung (bewusst nicht implementiert, TD-22), Brute Force und Kontoaufzählung (in diesem Feature gegenstandslos), CSRF (nur als Indiz belegt)
- **Regression:** PROJ-1 unverändert funktionsfähig; ein Low-Befund (BUG-3) aus der Header-Ergänzung
- **Neue Tests:** 18 — 15 im QA-Durchlauf (`src/lib/expenses/queries.test.ts`, `src/components/shell/month-switcher.test.tsx`) und 3 für die Behebung von BUG-1 (`src/lib/expenses/csv.test.ts`). Alle drei Dateien wurden **rot nachgewiesen**: ohne `.eq('user_id', …)`, mit dauerhaft aktivem Vorwärtspfeil bzw. ohne die Textmarkierung fallen genau die Tests, die es dafür gibt. Gesamtstand: **164 Tests, 14 Dateien, alle grün**
- **Production Ready:** **JA** — kein offener Critical- oder High-Bug. BUG-5 hat `/e2e-tests` gefunden, wo der QA-Durchlauf ohne Browser nicht hinkam, und er wurde am selben Tag behoben
- **Empfehlung:** Deploy möglich. Offen bleiben BUG-3 (über `/refine PROJ-1` entscheiden, weil die Konto-Karte PROJ-1 gehört) sowie BUG-2 und BUG-4 — alle drei ohne Einfluss auf den Deploy

> Die browserabhängigen `[!]`-Punkte oben sind durch die fünf E2E-Journeys inzwischen zu großen
> Teilen geschlossen — offen bleiben Darstellung in weiteren Browsern und an weiteren
> Bildschirmbreiten sowie der echte Datenbankausfall (EC-4).

---

# Nachtrag: zweiter Durchlauf am 01.09.2026

**Anlass:** `/e2e-tests` von PROJ-3 hat einen Fehler gefunden, der **PROJ-2 gehört** — die Kategorie
verlor nach dem Speichern ihren Wert und verletzte damit **AC-3**. Der Status ging deshalb von
*Approved* zurück auf *In Review*.

## AC-3 — erstmals im Browser belegt

- [x] **AC-3** — nach dem Speichern sind Betrag und Notiz geleert, **Kategorie** und Datum stehen
  unverändert, der Fokus liegt im Betragsfeld · *Evidenz: `tests/PROJ-2-expenses-monthly-overview.spec.ts`,
  Journey 1 — die Zusicherung `expect(page.getByLabel('Kategorie')).toHaveText('Software & Abos')`
  ist neu und grün in Chromium **und** Mobile Safari. Nimmt man die Behebung zurück, wird sie rot*

**Der erste Durchlauf führte AC-3 als `[!] NICHT GEPRÜFT: reine Browser-Interaktion`** — und die
E2E-Journey prüfte unter derselben Überschrift Betrag, Notiz, Datum und Fokus, **nur die Kategorie
nicht**. Genau diese eine fehlende Zusicherung hat den Fehler über den gesamten Lebenslauf des
Features getragen. Sie steht jetzt da.

**Ursache und Behebung** stehen im `design.md` von PROJ-3 (TD-14): React 19 setzt ein Formular nach
einer Server Action zurück, Radix reicht das über sein verstecktes Auswahlfeld in den React-Zustand
zurück. Behoben in `expense-composer.tsx` — einer Datei, die PROJ-2 gehört.

## Ein neuer Befund, der ebenfalls PROJ-2 gehört

- [ ] **BUG-6 (High): Die Erfassungszeile sendet ohne JavaScript per GET.** Die Behebung oben hat
  `action={formAction}` durch `onSubmit` ersetzt; damit trägt das Formular kein `method="POST"` mehr.
  Ohne JavaScript landen Betrag, Kategorie, Datum und **Notiz** in der Adresszeile, und die Ausgabe
  wird nicht gespeichert. Vollständige Beschreibung als **BUG-5** im `qa-report.md` von PROJ-3 —
  dort ist sie entstanden, die betroffene Datei gehört aber hierher.

## Regression

Alle **24 E2E-Journeys grün** in beiden Browsern, darunter die fünf von PROJ-2: Erfassen, Summen und
Filter, Monatsnavigation, Ändern und Löschen, CSV-Export und die Kontotrennung. 214 Unit-Tests grün.
Der Export, die Summen und der Zugriffsschutz sind von der Änderung nicht berührt.

## Stand

**PROJ-2 bleibt `In Review`.** AC-3 ist repariert und erstmals dauerhaft abgesichert; offen ist
BUG-6 in derselben Datei. Beide gehören in denselben `/build`-Lauf wie BUG-5 aus PROJ-3 — es ist
derselbe Code.

---

## Dritter Durchlauf — 02.09.2026 (nach `/refine`, `/architecture`, `/tasks`, `/build` zu EC-13)

**Getestet:** 2026-09-02 · **App-URL:** `http://localhost:3400` (Produktions-Build, `next start`)
gegen das lokale Supabase auf `127.0.0.1:55321` · **Testsuite:** `npm test` → **278 Tests in 22
Dateien, alle grün** (vorher 269) · **E2E als Regression:** `npx playwright test` → **28 von 28
grün** in Chromium und Mobile Safari, sowohl mit einem als auch mit zwei Arbeitern ·
**Ausfall-Zusicherung:** `npm run test:outage` grün

> Der Port wurde vor der ersten Messung gegengeprüft (die ausgelieferte Seite trägt `auslage.`) —
> in einem früheren Lauf hatte ein fremder Server eine Portnummer übernommen, und das fiel erst
> spät auf.

**Anlass dieses Laufs:** EC-13 ist neu, und die Fristen-Arbeit hat die Wege angefasst, auf denen
PROJ-2 und PROJ-3 gemeinsam stehen. Geprüft wurde deshalb beides: das neue Kriterium und ob
EC-4 und EC-12 dabei etwas verloren haben.

### Das neue Kriterium

- [x] **EC-13** — Die Meldung nennt nur den Fristablauf, keine Ursache und keinen Ausgang · *Evidenz an der laufenden App, mit **echtem** Ausfall in zwei Spielarten (`docker pause` auf PostgREST allein und auf der Datenbank) und je auf dem **Lese-** und dem **Schreibweg** — also vier Messungen:*

  | Ausfall | Weg | HTTP | Dauer | „zu lange gedauert" | nennt Ursache | behauptet Ausgang | „nicht an dir" |
  |---|---|---|---|---|---|---|---|
  | nur Datenzugriff | lesen | 200 | 2.051 ms | ja | **nein** | **nein** | ja |
  | nur Datenzugriff | schreiben | 200 | 4.130 ms | ja | **nein** | **nein** | ja |
  | Datenbank + Auth | lesen | 200 | 2.024 ms | ja | **nein** | **nein** | ja |
  | Datenbank + Auth | schreiben | 200 | 4.040 ms | ja | **nein** | **nein** | ja |

  *Gesucht wurde nach `erreich · Datenbank · Verbindung · Netzwerk · offline · nicht verfügbar`
  (Ursache) und `nichts gespeichert · nicht gespeichert · wurde angelegt · ging verloren` (Ausgang)
  — im **ganzen ausgelieferten Dokument**, nicht nur in der Konstante.*

- [x] **EC-13, strukturell** — der Satz kann nicht auseinanderlaufen · *Evidenz: `grep` über `src/` und `tests/` findet **kein einziges** Vorkommen von „Das hat zu lange gedauert" oder „liegt nicht an dir" außerhalb von `deadline.ts`. Alle vier Wege importieren `TIMEOUT_*`; keiner trägt einen eigenen Satz*

### Der Fall, für den die zweite Hälfte von EC-13 geschrieben wurde — jetzt gemessen

**Während der Ausfallmessung ist eine Zeile entstanden** (35 → 36), obwohl beide Schreibversuche
„Das hat zu lange gedauert" meldeten. Nachgesehen: die Zeile `waehrend Ausfall`, angelegt um
04:24:52 — mitten im Ausfallfenster. Der Mechanismus ist der im Entwurf beschriebene: `docker pause`
friert den Prozess ein, die Anfrage lag bereits an, die Frist lief nach zwei Sekunden ab, und beim
Freigeben wurde geschrieben.

**Das ist kein Fehler, sondern die Bestätigung der Entscheidung.** Hätte die Meldung wie erwogen
„es wurde nichts gespeichert" gesagt, wäre sie in genau diesem Lauf **nachweislich falsch** gewesen.
Der Entwurf hat den Fall erschlossen; dieser Lauf hat ihn eintreten sehen.

- [x] **Das Sicherheitsnetz dahinter hält** — EC-1 deckt den Wiederholversuch nach einer Zeitüberschreitung · *Evidenz: dieselbe Vorgangskennung erneut abgeschickt → Zeilen zu dieser Kennung **1 → 1**, HTTP 200, **keine** Fehlermeldung. Die Person sieht einen Erfolg, und es entsteht kein Duplikat*

### Was EC-13 nicht beschädigt hat

- [x] **EC-4** — beide Zahlen halten · *Evidenz zweifach: die vier Messungen oben (2,0 s lesen · 4,1 s schreiben, alle unter der 5-Sekunden-Zusage) und `npm run test:outage` → 2.346 ms schreiben · 2.401 ms lesen · 2.354 ms auf dem teuersten Weg, Grenze 5.000 ms*
- [x] **EC-12** — keine Weiterleitung auf `/login` · *Evidenz: in allen vier Ausfallmessungen `Location: —` und HTTP 200 mit dem Zeitüberschreitungs-Zustand; die Sitzung wird nicht für abgelaufen erklärt, wenn sie nur nicht prüfbar war*
- [x] **AC-15 / EC-12 auf dem Kontoweg** — bei nicht feststellbarer Anmeldung wird **nicht gelöscht** · *Evidenz: neue Zusicherung in `account.test.ts` — `rpc` nicht aufgerufen, `signOut` nicht aufgerufen, keine Weiterleitung*

### Regression an der laufenden App

- [x] **AC-1, AC-5, AC-6, AC-8, AC-29, AC-30** — die Eingaberegeln unverändert · *Evidenz: acht Erfassungen über den echten Formularweg. Zwei gültige gingen durch, sechs wurden abgewiesen und die Zeilenzahl blieb stehen: „Der Betrag muss größer als 0 sein." (0 und negativ) · „Der Betrag darf höchstens 9.999.999,99 sein." · „Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl." · „Das Datum darf nicht in der Zukunft liegen." · „Diese Kategorie gibt es nicht."*
- [x] **AC-13, AC-14** — Summen rechnen auf den Cent · *Evidenz: angezeigte Gesamtsumme **144,90 €** gegen `sum(amount_cents) = 14490` aus der Datenbank; Kategoriesummen 120,00 € + 24,90 € ergeben genau die Gesamtsumme, Prozentanteile 83 + 17 = 100*
- [x] **AC-24, AC-25** — Kontogrenzen halten auf allen Operationen · *Evidenz mit zwei echten Konten und ihren JWTs, **am Anwendungscode vorbei**: A liest Bs Zeilen → `[]`; `PATCH amount_cents = 1` auf Bs Zeilen → `[]`; `DELETE` → `[]`. Bs zwei Zeilen und ihre Summe von 14490 danach unverändert*
- [x] **PROJ-1 und PROJ-3 unberührt** — **28 von 28 E2E-Journeys grün** in Chromium und Mobile Safari, darunter alle vier von PROJ-1 und alle fünf von PROJ-3

### Security

- [x] **Zugriff ohne Anmeldung** — `/`, `/konto` und `/konto/export` → je HTTP **307** auf `/login`
- [x] **Datenschnittstelle anonym** — `expenses`, `profiles` und `login_attempts` → je HTTP **401**
- [x] **Sicherheits-Header** an der laufenden App — alle vier vorhanden: `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: origin-when-cross-origin` · `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] **Keine Secrets im Client-Bundle** — je **0** Treffer in `.next/static` für `GATE_SECRET`, `service_role`, `sb_secret`, das JWT-Secret und `TRUSTED_PROXY_HOPS`
- [x] **Die Fristmeldung verrät nichts über die Infrastruktur** — das ist die Sicherheitsseite von EC-13, nicht nur die sprachliche: Eine Meldung, die zwischen „Datenbank steht" und „Auth-Server steht" unterscheidet, ist ein kostenloser Statusbericht nach außen. Der neue Satz gibt in allen vier Ausfallarten **dieselbe** Auskunft · *Evidenz: die Tabelle oben — vier verschiedene Ausfälle, ein Wortlaut*
- [x] **Ein echter Programmfehler wird nicht als Zeitüberschreitung verschluckt** · *Evidenz: neue Zusicherung in `route.test.ts`; der Rückbau (jeden Fehler als `unavailable` behandeln) macht sie rot*
- [!] **Drosselung gewöhnlicher Endpunkte** — NOT VERIFIED: weiterhin nicht implementiert, so entschieden in TD-22. Für ein MVP vertretbar, aber nicht als bestandene Prüfung verbucht
- [!] **Brute Force auf Zugangsdaten** — NOT VERIFIED für PROJ-2: kein Zugangsdaten-Pfad in diesem Feature. Die Drosselung von PROJ-1 ist unberührt und dort geprüft

**7 Prüfungen verifiziert, 2 NOT VERIFIED.** Keine davon negativ.

### Neue Tests aus diesem Lauf — eine echte Lücke, keine Kosmetik

**Zwei der vier EC-13-Wege hatten überhaupt keine Zusicherung.** `deadline.test.ts` prüft die
Konstante, `outage.spec.ts` prüft den Erfassungsweg — aber der **Kontoweg** und die
**Export-Route** waren von beidem nicht berührt. Die Export-Route hatte gar keine Testdatei; eine
Route ohne Testdatei ist der bequemste Ort, um unbemerkt wieder einen eigenen Satz hinzuschreiben.

- **`src/lib/actions/account.test.ts`** — 2 Zusicherungen: Bei nicht feststellbarer Anmeldung wird
  **nicht gelöscht** (der Aufruf ist unwiderruflich), und der Satz kommt aus der gemeinsamen Quelle.
- **`src/app/konto/export/route.test.ts`** — neue Datei, 7 Zusicherungen: der Normalfall (CSV,
  `no-store`), beide Wege in den 503 (Anmeldung nicht feststellbar · erst das Lesen scheitert),
  der Wortlaut, dass bei 503 **keine halbe Datei** ausgeliefert wird, und dass ein echter
  Programmfehler **nicht** als Zeitüberschreitung verschwindet.

**Rot-Nachweis geführt**, drei gezielte Brüche: `account.ts` schreibt wieder seinen eigenen Satz
(2 Zusicherungen fallen) · die Export-Route ebenso (3 fallen) · die Route behandelt jeden Fehler als
Zeitüberschreitung (1 fällt). Jeder von genau den Zusicherungen gefangen, die ihn verhindern sollen;
die Quellen sind danach nachweislich unverändert (`git diff` leer).

### Not Verified In This Run

- [!] **Darstellung auf 768 px und 1440 px** — kein Viewport in `/qa`. Mobile Safari (390 px) ist über die E2E-Suite gedeckt, aber nur auf Bedienbarkeit, nicht auf Optik.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Der Zeitüberschreitungs-Zustand im Bild** — dass die Karte mit Überschrift, Hinweis und „Erneut versuchen" *gut aussieht*, ist nicht geprüft; geprüft ist, dass sie da ist und was sie sagt.
- [!] **Drosselung gewöhnlicher Endpunkte** — bewusst nicht implementiert (TD-22).
- [!] **Brute Force** — PROJ-2 hat keinen Zugangsdaten-Pfad.
- [!] **Die Lastschwelle aus BUG-6** — in diesem Lauf lief die volle E2E-Suite mit zwei Arbeitern **28 von 28 grün**, die Maschine war dabei ruhig. Damit ist gezeigt, dass die Empfindlichkeit lastabhängig ist und keine dauerhafte Eigenschaft — **nicht**, ab welcher Auslastung sie zuschlägt. Die offene Frage in `spec.md` bleibt offen.

### Bugs

**Keine neuen Befunde.** Kein Critical, kein High, kein Medium, kein Low.

**Zum Stand von BUG-6** aus dem QA-Bericht von PROJ-3 (dort, nicht hier nummeriert): Der Befund
hatte zwei Hälften. Die **falsche Behauptung** ist behoben und in diesem Lauf an vier Ausfallwegen
nachgemessen. Die **Lastempfindlichkeit der Frist** ist unverändert — bewusst, weil die 2 Sekunden
nirgends als falsch nachgewiesen sind und eine geratene Zahl keine Messung ersetzt. Sie steht als
offene Frage in `spec.md`, nicht als Bug.

### Summary

- **Acceptance Criteria:** 30 von 30 unverändert erfüllt — in diesem Lauf erneut belegt: AC-1, AC-5, AC-6, AC-8, AC-13, AC-14, AC-15, AC-24, AC-25, AC-29, AC-30 an der laufenden App, die übrigen über die grüne E2E-Suite
- **Edge Cases:** **13 von 13 erfüllt** — EC-13 neu und an vier Ausfallwegen belegt, EC-4 und EC-12 unbeschädigt, EC-1 im neuen Zusammenhang bestätigt
- **Bugs:** 0 Critical · 0 High · 0 Medium · 0 Low
- **Security:** 7 Prüfungen verifiziert, 2 NOT VERIFIED, keine negativ
- **Tests:** 278 Unit-/Integrationstests grün (9 neue, alle rot nachgewiesen) · 28/28 E2E · Ausfall-Zusicherung grün · Lint, Build und TypeScript sauber
- **Production Ready:** **JA**

**Was dieser Lauf gezeigt hat, das vorher nur erschlossen war.** Der Entwurf hat verboten zu
behaupten, es sei nichts gespeichert worden — mit der Begründung, die Frist könne zuschlagen,
nachdem die Datenbank die Zeile angenommen hat. Genau das ist während der Messung passiert: eine
Zeile entstand, während die Person „das hat zu lange gedauert" las. Eine Meldung, die das Gegenteil
behauptet hätte, wäre in diesem Lauf nachweislich falsch gewesen — und niemandem aufgefallen, weil
sie plausibel klingt.

**Und was der Lauf über die Testabdeckung gezeigt hat:** Zwei der vier Wege, die EC-13 gemeinsam
halten müssen, hatten keine einzige Zusicherung. Beide sind jetzt gedeckt, mit Rot-Nachweis.

---

## Vierter Durchlauf — 02.09.2026 (nach `/refine`, `/architecture`, `/tasks`, `/build` der Ebenen 15–18)

**Getestet:** 2026-09-02 · **App-URL:** `http://localhost:3500` (**Produktions-Build**, `next start`)
gegen das lokale Supabase auf `127.0.0.1:55321`; die E2E-Suite gegen den bereits laufenden
Dev-Server auf `:3000` · **Testsuite:** `npm test` → **297 Tests in 22 Dateien, alle grün**
(vorher 292; `/qa` hat 5 ergänzt) · **E2E als Regression:** `E2E_PORT=3000 npx playwright test` →
**32 von 32 grün** in Chromium und Mobile Safari (vorher 28) · **Ausfall-Zusicherung:**
`npm run test:outage` → grün · **Lint** und **Produktions-Build** ohne Befund

> **Zum Port.** Auf `:3000` lief bereits ein Dev-Server **dieses** Projekts (Next 16 lässt keinen
> zweiten für dasselbe Verzeichnis zu). Gegengeprüft, bevor irgendetwas gemessen wurde: die
> ausgelieferte Seite trägt `<title>Anmelden · auslage.</title>`, und der Arbeitsbaum ist sauber
> auf `28c3749` — es ist derselbe Stand. Alle **Messungen** liefen trotzdem gegen einen eigenen
> Produktions-Build auf `:3500`, nur die E2E-Suite gegen `:3000`.

**Anlass:** Die Rückmeldung am laufenden Stand hat vier Kriterien und zwei Edge Cases ergänzt —
**AC-31 bis AC-34, EC-14 und EC-15** — und `/build` hat dazu die Ebenen 15 bis 18 gebaut (T37–T45,
alle abgehakt, kein `[user]`-Task). Geprüft werden deshalb: die sechs neuen Kriterien vollständig
und unabhängig von den Zusicherungen, die `/build` selbst geschrieben hat, dazu Sicherheit,
Regression und der Verbleib der offenen Befunde.

**Wie geprüft wurde.** `/qa` hat keinen Browser — die Journeys aus `/e2e-tests` bringen aber einen
mit, und der ist installiert. Genutzt wurde er über **eigene, gesteuerte Skripte**, nicht über die
vorhandene Suite: Ein Kalender lässt sich nicht über HTTP bedienen, und eine Prüfung, die nur die
Tests des Bauens noch einmal ausführt, prüft nichts Neues. Dazu wie immer die Datenbank direkt über
PostgREST und `psql` mit zwei echten Konten — **am Anwendungscode vorbei**.

### Die vier neuen Acceptance Criteria

#### AC-31 — Zwei Wege zum selben Wert, Kalender mit Wochentagsspalten und Monatsblättern

- [x] **Das Feld bleibt tippbar** — mit **echter Tastatureingabe** gesetzt (nicht mit `fill()`, das
  den Wert nur zuweist): Ziffernfolge ins fokussierte Feld getippt → `2026-08-17`, der Wochentag
  „Mo" erscheint dazu · *Nachweis: gesteuerter Browser, `keyboard.press('Digit…')` je Ziffer*

  > **Eine Fehlmessung, die fast ein Befund geworden wäre.** Derselbe Test schlug zuerst fehl
  > (`2026-12-08` statt `2026-08-17`). Ursache war nicht das Produkt: Chromium rendert das
  > `type="date"`-Feld hier in **US-Segmentreihenfolge** (MM/DD/YYYY) — auch dann noch, wenn der
  > Browserkontext auf `de-AT` steht, weil die Reihenfolge an der UI-Sprache des Browsers hängt und
  > nicht an der JS-Locale. Mit der passenden Ziffernfolge kommt in beiden Locales genau das
  > erwartete Datum heraus. Die Segmentreihenfolge ist Sache des Browsers, nicht der Anwendung.
- [x] **Der Kalender ist der zweite Weg** — `Kalender öffnen` klicken, `Montag, 17. August 2026`
  wählen → Feldwert `2026-08-17` · *Nachweis: gesteuerter Browser gegen den Produktions-Build*
- [x] **Der Kalender ist auch mit der Tastatur erreichbar** — ein `Tab` vom Datumsfeld setzt den
  Fokus auf „Kalender öffnen", `Enter` öffnet ihn · *Nachweis: `document.activeElement` nach `Tab`*
- [x] **Wochentage als Spalten** — sieben `<th scope="col">` mit `Mo Di Mi Do Fr Sa So`, Woche
  beginnt am Montag, je mit ausgeschriebenem `aria-label` („Montag") · *Nachweis: `outerHTML` des
  `role="grid"` im offenen Popover*

  > Diese Zusicherung fehlte in Journey 6 — sie prüft das Anklicken eines Tages, nicht den **Aufbau**
  > des Blatts. Beides steht aber im Kriterium.
- [x] **Monat für Monat blättern** — `August 2026` → einmal zurück → `Juli 2026` → zweimal vor →
  `September 2026` · *Nachweis: `aria-label` des Rasters nach jedem Klick; Knöpfe heißen „Zum
  vorherigen/nächsten Monat"*
- [x] **Derselbe Baustein im Änderungsdialog** — genau **ein** „Kalender öffnen" im Dialog, Feld mit
  dem gespeicherten Datum vorbelegt · *Nachweis: gesteuerter Browser, Dialog einer echten Ausgabe*

#### AC-32 — Der Wochentag steht am Feld

- [x] **Sichtbar, ohne den Kalender zu öffnen** — `2026-08-15` → „Sa", `2026-08-17` → „Mo";
  in der Erfassungszeile **und** im Änderungsdialog (dort „Di" zum 01.09.2026) · *Nachweis:
  gesteuerter Browser; dazu `formatWeekday` über `Intl` mit `timeZone: 'UTC'`, sodass keine
  Zeitzone den Tag verschiebt (`src/lib/expenses/format.ts:76`)*
- [x] **Berechnet, nie gespeichert** — keine Spalte, kein Feld; `docs/data-model.md` unberührt ·
  *Nachweis: `\d public.expenses` — zwölf Spalten, keine für den Wochentag*
- [ ] **BUG** **Für Screenreader gibt es den Wochentag nicht** — siehe **BUG-8** (Low). Die Anzeige
  trägt `aria-hidden`, und der Wochentag steht in keinem zugänglichen Namen des Feldes

#### AC-33 — Erkennbarer Rückweg auf `/konto`

- [x] **Genau ein sichtbar beschrifteter Rückweg** — Link `‹ Zur Übersicht` mit `href="/"`, als
  Text lesbar statt nur als Etikett · *Nachweis: `getByRole('link')` auf `/konto` liefert
  `[auslage. → /, Konto → /konto, Zur Übersicht → /, Ausgaben als CSV herunterladen →
  /konto/export]`*
- [x] **Er führt wirklich auf die Monatsübersicht** — Klick → `/` · *Nachweis: gesteuerter Browser*
- [x] **Kein zweiter gleichnamiger Link daneben** — das `aria-label="Zur Übersicht"` der Wortmarke
  ist entfernt, sie heißt jetzt nach ihrem eigenen Text „auslage." · *Nachweis: die Linkliste oben —
  vier Links, vier verschiedene Namen. Genau der Fehler aus BUG-3, diesmal vor der Auslieferung
  bemerkt (`design.md`, Bau-Notiz 2)*
- [x] **Ein Link, kein `history.back()`** (TD-40) — `href="/"` im Markup; wer `/konto` direkt
  aufruft, fliegt nicht aus der Anwendung · *Nachweis: `src/app/konto/page.tsx:58`*

#### AC-34 — Die Notiz ist so lesbar wie Datum und Kategorie

- [x] **Gemessen, nicht behauptet** — in derselben Zeile: Notiz `rgb(245, 245, 240)`, Kategorie
  `rgb(245, 245, 240)`, Datum `rgb(245, 245, 240)` — **identisch** · *Nachweis:
  `getComputedStyle(el).color` je Zelle im gesteuerten Browser gegen den Produktions-Build*

  > Journey 6 vergleicht die Notiz nur mit der **Kategorie**. Das Kriterium nennt Datum **und**
  > Kategorie; hier stehen alle drei.
- [x] **Das Abschneiden langer Notizen bleibt** — `max-w-0 truncate` unverändert ·
  *Nachweis: `src/components/expenses/expense-list.tsx:63`*

### Die zwei neuen Edge Cases

#### EC-14 — Unzulässige Tage sind gar nicht erst wählbar

- [x] **Obergrenze** — im laufenden Monat ist „Zum nächsten Monat" gesperrt, und **morgen**
  (`Donnerstag, 3. September 2026`) steht gar nicht im Blatt · *Nachweis: gesteuerter Browser,
  `aria-disabled="true"` bzw. `getByRole('button', {name: …}).count() === 0`*
- [x] **Untergrenze** — mit Feldwert `2000-01-15` beginnt das Blatt beim `Samstag, 1. Januar 2000`;
  kein Tag aus Dezember 1999 ist anklickbar, und „Zum vorherigen Monat" ist gesperrt · *Nachweis:
  ebenso*

  > Die Untergrenze ist die unauffälligere Hälfte des Kriteriums und hatte **keine** Zusicherung —
  > weder als Einheitentest noch in Journey 6. Sie steht jetzt da (siehe *Neue Tests*).
- [x] **Käme so ein Datum doch an, greifen AC-7 und AC-30 unverändert** — im Browser ein Datum
  von morgen abgeschickt → „Das Datum darf nicht in der Zukunft liegen."; `1999-12-31` → „Das Datum
  liegt zu weit zurück — prüf bitte die Jahreszahl."; nichts gespeichert · *Nachweis: gesteuerter
  Browser gegen den Produktions-Build*

  > **Das war die Stelle mit dem echten Risiko.** Der Baustein setzt jetzt `min="2000-01-01"` und
  > `max="2026-09-02"` am Feld. Trüge das Formular keine Abschaltung der nativen Prüfung, hätte der
  > Browser das Absenden mit **seiner eigenen** Sprechblase abgefangen, und die im Vertrag
  > zugesagten deutschen Sätze wären nie erschienen. Beide Formulare tragen `noValidate`
  > (`expense-composer.tsx:152`, `edit-expense-dialog.tsx:168`) — gemessen, nicht nur gelesen.

#### EC-15 — Der Kalender schafft keinen zweiten Verhaltensweg

- [x] **Erfassungszeile** — Datum über den Kalender auf den 17.08.2026 gesetzt, erfasst → in der
  Datenbank steht `spent_on = 2026-08-17` · *Nachweis: gesteuerter Browser, danach `psql`*
- [x] **Änderungsdialog** — bestehende Ausgabe vom 01.09. über den Kalender auf den 17.08. geändert
  → Datenbank `2026-08-17`, und die Ansicht wandert auf `/?monat=2026-08` mit (**EC-11 nebenbei
  belegt**) · *Nachweis: ebenso*
- [x] **Die Garantie dahinter, nicht nur das Ergebnis** — es gibt **einen** Baustein, nicht zwei:
  `DateField` wird von Erfassungszeile und Dialog importiert, getippt und geklickt laufen durch
  dasselbe `onChange` · *Nachweis: `src/components/expenses/date-field.tsx:78,110`; je ein Import in
  `expense-composer.tsx:25` und `edit-expense-dialog.tsx:18`*
- [x] **Der Kursabruf von PROJ-3 löst auch beim Kalenderdatum aus** · *Nachweis: der neue E2E-Test
  „Ein über den Kalender geändertes Datum holt den Kurs neu" — grün in beiden Engines*

### Regression an der laufenden Anwendung

Nicht nur über die Suiten — die neuen Kriterien fassen die Erfassungszeile und den Änderungsdialog
an, also die Wege, auf denen alles andere steht.

- [x] **AC-2 — Datumsvorbelegung überlebt den neuen Baustein** — `/?monat=2026-07` → `2026-07-01`,
  `/` → `2026-09-02` (heute in Wien) · *Nachweis: `inputValue()` im gesteuerten Browser*
- [x] **AC-11, AC-13, EC-9 — 302 Ausgaben in einem Monat** — alle 302 Zeilen im HTML (303 `<tr>`
  inkl. Kopfzeile), angezeigte Gesamtsumme **72.039,22 €** gegen `sum(amount_cents) = 7203922` aus
  der Datenbank — auf den Cent · *Nachweis: HTML des Produktions-Builds gegen `psql`*
- [x] **AC-14, EC-7 — Kategoriesummen exakt, Prozente gerundet** — neun belegte Kategorien,
  absteigend `17 · 15 · 13 · 12 · 10 · 9 · 9 · 8 · 7 %` = **100 %**; die Summe der neun
  Kategoriebeträge ist **7.203.922 Cent** und damit exakt die Gesamtsumme · *Nachweis: aus dem
  gerenderten HTML zurückgerechnet*
- [x] **Leistungszusage — 95 % unter 500 ms, keine über 1 s, bei bis zu 300 Ausgaben** — 20 Abrufe
  von `/?monat=2026-09` am eingeschwungenen Produktions-Build mit **302 Ausgaben**:
  `min 60 ms · Median 67 ms · p95 97 ms · max 117 ms`. Das ist **ein Fünftel** der zugesagten
  Grenze · *Nachweis: `curl -w '%{time_total}'`, fünf Aufwärmläufe vorweg*
- [x] **AC-27, EC-10 — Export unverändert** — `content-type: text/csv; charset=utf-8`,
  `content-disposition: attachment; filename="auslage-export-2026-09-02.csv"`,
  `cache-control: no-store, must-revalidate`, `X-Content-Type-Options: nosniff`; BOM, CRLF,
  306 Zeilen (3 Kopf + 1 Leerzeile + 302 Daten). Die Notiz mit Anführungszeichen und Semikolon steht
  korrekt begrenzt mit verdoppelten inneren Anführungszeichen · *Nachweis: `curl -D -` auf
  `/konto/export`, Datei mit `cat -v` gelesen*
- [x] **AC-28 — Hinweis am Notizfeld** — „Keine Namen anderer Personen und nichts Sensibles wie
  Gesundheitsangaben — eine kurze Beschreibung reicht." im ausgelieferten Markup · *Nachweis: `grep`*
- [x] **AC-26 — Kontolöschung räumt weiterhin vollständig ab** — 18 Testkonten mit über 300
  Ausgaben gelöscht; danach **0** verwaiste Ausgaben und **0** verwaiste Profile · *Nachweis:
  `delete from auth.users …`, dann zwei `left join`-Zählungen*
- [x] **PROJ-1 und PROJ-3 unberührt** — **32 von 32 E2E-Journeys grün** in Chromium und Mobile
  Safari, darunter alle vier von PROJ-1 und alle sechs von PROJ-3 · *Nachweis: `npx playwright test`*
- [x] **EC-4, EC-12, EC-13 unbeschädigt** — `npm run test:outage` grün, mit echtem `docker pause`:
  **2375 ms** (schreiben ohne Datenzugriff) · **2370 ms** (lesen) · **2356 ms** (teuerster Weg),
  Grenze 5000 ms. Danach alle sechs Container wieder `Up` · *Nachweis: Ausgabe des Laufs*
- [x] **Geometrie des neuen Feldes bei 375 / 768 / 1440 px** — der Kalenderknopf liegt in allen drei
  Breiten **innerhalb** des Feldes, hat eine Trefferfläche von 28 × 28 px (über den 24 px, die als
  Minimum gelten), und das Popover bleibt im Ansichtsfenster (rechter Rand 321 px bei 375 px
  Fensterbreite). Links vom Wochentag bleiben 250 px bzw. 101 px für den Datumstext ·
  *Nachweis: `boundingBox()` je Element in drei Ansichtsfenstern*

  > Das ist **Geometrie, nicht Optik** — gemessen wird Überlappung und Trefferfläche, nicht, ob es
  > gut aussieht. Letzteres steht weiterhin unter *Nicht geprüft*.

### Sicherheit (Red Team, vollständig durchgespielt)

Zwei frische Konten A und B mit gültigen Zugangs-Token, Zugriff **am Anwendungscode vorbei** direkt
gegen PostgREST.

- [x] **Zugriffsschutz ohne Sitzung** — `/`, `/konto`, `/konto/export`, `/?monat=2026-08` je
  **HTTP 307 → `/login`** · *Nachweis: `curl -o /dev/null -w '%{http_code} %{redirect_url}'`*
- [x] **AC-24 quer über zwei Konten** — A gegen Bs Zeile: lesen → `[]`, ändern → `[]`, löschen →
  `[]`; eine Zeile auf **Bs** `user_id` anlegen → `42501 new row violates row-level security
  policy`. Bs Zeile danach unverändert (`4242 Cent`, Notiz „B geheim") · *Nachweis: `GET`/`PATCH`/
  `DELETE`/`POST` auf `/rest/v1/expenses` mit As Bearer-Token*
- [x] **Anonymer Schlüssel** — `expenses`, `profiles`, `login_attempts` je **HTTP 401 / `42501`
  permission denied** · *Nachweis: `curl` nur mit `apikey`*
- [x] **`login_attempts` auch für Angemeldete verschlossen** — mit gültigem Bearer-Token
  **HTTP 403 / `42501`** · *Nachweis: `curl` mit As Token*
- [x] **AC-10 / AC-29 / AC-30 / AC-5 an der Datenbank** — erfundene Kategorie `urlaub` und
  Anzeigename `Bewirtung` → `23514`; Betrag `1000000000` Cent → `23514`; Betrag `0` → `23514`;
  Datum `1999-12-31` → `23514` · *Nachweis: fünf `POST` direkt gegen PostgREST*
- [x] **Einschleusung über `?monat=`** — **14 Nutzlasten**, darunter `2026-08' or 1=1--`,
  `'; drop table expenses;--`, `../../etc/passwd`, `2026-08%00`, `<script>alert(1)</script>` und
  `2026-08" onmouseover="alert(1)`: **alle** HTTP 200 mit dem laufenden Monat (AC-19),
  **null** ausgelöste Dialoge, **null** Elemente mit `onmouseover`, Tabelle danach unverändert
  (24 → 24 Zeilen) · *Nachweis: gesteuerter Browser mit `page.on('dialog')` als echtem
  XSS-Nachweis statt einer Textsuche im Quelltext*
- [x] **Einschleusung in die Notiz** — `<script>alert(1)</script>` und
  `"><img src=x onerror=alert(1)> ' OR 1=1--` gespeichert und ausgeliefert: im HTML als
  `&lt;script&gt;` bzw. `&quot;&gt;&lt;img src=x …&gt;` maskiert, in der RSC-Nutzlast als
  `<`; **null** lebende `<img>`-Elemente auf der Seite · *Nachweis: `grep` auf den
  ausgelieferten Rumpf, Kontext beider Treffer einzeln angesehen*
- [x] **Keine Server-Geheimnisse im Client-Bundle** — `.next/static` nach `service_role`,
  `sb_secret_`, `SERVICE_ROLE`, `JWT_SECRET`, `GATE_SECRET`, `super-secret` und
  `TRUSTED_PROXY_HOPS` durchsucht: je **0** Treffer · *Nachweis: `grep -rl` nach `npm run build`*
- [x] **Keine Zugangsdaten in der Adresse** — kein `method="get"` in `src/`; `/login`, `/signup` und
  die Erfassungszeile tragen `method="POST"` im ausgelieferten Markup · *Nachweis: `grep -rn` und
  `grep -o '<form[^>]*>'` je Seite*
- [x] **Sicherheits-Kopfzeilen an der laufenden App** — `X-Frame-Options: DENY` ·
  `X-Content-Type-Options: nosniff` · `Referrer-Policy: origin-when-cross-origin` ·
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` · *Nachweis: `curl -D -`*
- [x] **Die neue Abhängigkeit vergrößert die Angriffsfläche nicht unbemerkt** — `react-day-picker`
  bringt `date-fns` mit; beides landet in **einem** Chunk (164 KB JS), der auf `/login` und
  `/signup` **nicht** geladen wird. Unser eigener Quelltext importiert `date-fns` **nirgends**
  (0 Treffer in `src/`) · *Nachweis: `grep -rl` über `.next/static`, `grep -c` auf die
  Chunk-Kennung in den ausgelieferten Seiten*
- [!] **Drosselung auf den Ausgaben-Wegen** — NOT VERIFIED: weiterhin nicht implementiert, so
  entschieden in TD-22. PROJ-2 prüft keine Zugangsdaten, alles liegt hinter PROJ-1s Anmeldung und
  zusätzlich hinter RLS. Kein Befund, aber **keine bestandene Prüfung**
- [!] **Brute Force und Kontoaufzählung** — NOT VERIFIED für PROJ-2: in diesem Feature
  gegenstandslos, es gibt keinen Anmelde-, Registrierungs- oder Zurücksetzen-Weg. Die Drosselung von
  PROJ-1 ist unberührt (32/32 E2E grün) und dort geprüft
- [!] **CSRF** — NOT VERIFIED: unverändert nur als Indiz belegbar. Next.js 16 prüft den Origin von
  Server Actions eingebaut; ohne Browser lässt sich die Aufrufkonvention nicht sauber nachbilden

**11 Prüfungen verifiziert, 3 NOT VERIFIED.** Keine davon negativ.

### Neue Tests aus diesem Lauf — eine echte Lücke, keine Kosmetik

**EC-14 nennt zwei Grenzen; abgedeckt war nur die obere.** `date-field.test.tsx` prüfte „zeigt
keinen Tag nach heute" — die **Untergrenze** (nichts vor dem 01.01.2000) und die **Blättergrenzen**
aus TD-37 hatten keine einzige Zusicherung, weder als Einheitentest noch in Journey 6. Fielen
`startMonth` und `endMonth` weg, blieben alle bestehenden Tests grün: Sie sehen nur das
aufgeschlagene Blatt an, nicht, wie weit man von dort wegkommt.

- **`src/components/expenses/date-field.test.tsx`** — 5 neue Zusicherungen: kein Tag vor dem
  01.01.2000 · der 01.01.2000 selbst ist zulässig (die Grenze schließt ein) · kein Rückblättern vor
  Januar 2000 · kein Vorblättern über den laufenden Monat · innerhalb des Bereichs blättert er ganz
  normal.

**Rot-Nachweis geführt** — vier gezielte Brüche, jeder zurückgenommen:

| Bruch | Was fiel |
|---|---|
| `startMonth`/`endMonth` entfernt | die **zwei** Blättergrenzen |
| `hidden` entfernt | „zeigt keinen Tag nach heute" |
| **beides** entfernt | zusätzlich die **Untergrenze** — sie wird von beiden Ebenen zugleich getragen, genau wie TD-37 es beschreibt |
| Untergrenze auf den 02.01. verschoben, Blätterstart auf den laufenden Monat | „01.01.2000 ist zulässig" und „blättert normal" |

Danach ist `src/components/expenses/date-field.tsx` nachweislich unverändert (`git diff` leer) und
die Datei steht bei **16 von 16 grün**.

> **Eine Sache, die der Rot-Nachweis über die Bibliothek gezeigt hat:** `react-day-picker` sperrt
> die Monatsnavigation über **`aria-disabled`**, nicht über das `disabled`-Attribut. Eine
> Zusicherung mit `toBeDisabled()` wäre grün-blind gewesen. Geprüft wird jetzt genau das, was die
> Bibliothek wirklich setzt.

### Nicht geprüft in diesem Durchlauf

- [!] **Wie es aussieht** — Farbwerte, Abstände und Trefferflächen sind **gemessen**, die Optik
  nicht beurteilt. `/qa` kann Geometrie prüfen, nicht Gestaltung
- [!] **Andere Browser-Engines als Chromium und WebKit** — Firefox läuft in keiner Suite
- [!] **Das Datumsfeld auf einem echten iOS-Gerät** — `design.md` benennt es ausdrücklich: Unter iOS
  lässt sich ein `type="date"`-Feld **nicht tippen**, dort öffnet ein Antippen das Walzenrad des
  Systems. AC-31 ist damit erfüllt, aber **nicht mit denselben zwei Wegen wie am Rechner**. Mobile
  Safari in der E2E-Suite ist eine Emulation und beweist das nicht
- [!] **Die 24 AC und 11 EC, die dieser `/refine` nicht angefasst hat** — sie wurden nicht einzeln
  neu durchgespielt. Belegt sind sie über 297 Einheitentests, 32 E2E-Journeys, die
  Ausfall-Zusicherung und die oben einzeln nachgewiesenen Stichproben (AC-2, AC-5, AC-7, AC-10,
  AC-11, AC-13, AC-14, AC-19, AC-24, AC-25, AC-26, AC-27, AC-28, AC-29, AC-30, EC-7, EC-9, EC-10,
  EC-11). Das steht hier, damit niemand mehr Abdeckung annimmt, als dieser Lauf hergibt
- [!] **Drosselung, Brute Force, CSRF** — siehe Sicherheit oben
- [!] **Ob die 2-Sekunden-Frist außerhalb des lokalen Stacks passt** — unverändert offene Frage der
  Spec, hier nicht angefasst

### Umgebung

- [x] **Sauber hinterlassen** — 18 eigene Testkonten und alle von ihnen erzeugten Ausgaben gelöscht,
  `login_attempts` geleert, der eigene Produktions-Server auf `:3500` beendet, alle sechs Container
  `Up` und keiner `Paused`, sämtliche Hilfsskripte entfernt · *Nachweis: `docker ps`,
  `git status --short` zeigt nur die beiden beabsichtigten Änderungen*
- **Fremder Rest im lokalen Stack, nicht angefasst:** zwei Ausgaben eines Kontos
  `qa3-a-…@qa.example.com` aus einem **früheren** QA-Lauf (Notiz `<img src=x onerror=alert(1)>`).
  Sie stammen nicht aus diesem Durchgang; fremde Daten werden nicht ungefragt gelöscht. Wer
  aufräumen will: `delete from auth.users where email like '%@qa.example.com';`

### Gefundene Bugs

#### BUG-8: Der Wochentag am Datumsfeld ist für Screenreader nicht vorhanden
- **Severity:** Low
- **Betrifft:** AC-32
- **Was ist:** Die Anzeige des Wochentags trägt `aria-hidden`, steht in keinem `aria-label` und in
  keiner `aria-describedby`-Beschreibung des Feldes. Wer die Seite vorlesen lässt, bekommt den
  Wochentag am Feld also gar nicht — AC-32 verlangt ihn aber „ablesbar, **ohne den Kalender zu
  öffnen**", und der Kalender ist genau der Umweg, den das Kriterium ausschließt
- **Schritte zur Reproduktion:** `/` aufrufen, ein Datum eintragen, den zugänglichen Namen und die
  Beschreibung des Datumsfeldes auslesen — beides enthält den Wochentag nicht
- **Nachweis:** `aria-hidden="true"` an der Anzeige (`src/components/expenses/date-field.tsx:82`);
  im gesteuerten Browser: Feldbezeichnung `"Datum"`, Beschreibung `""` — kein „Sa", kein „Samstag"
- **Warum es trotzdem Low ist:** Sehende Nutzer:innen bekommen genau das, wofür das Kriterium
  geschrieben wurde, und der Kalender selbst ist sauber ausgezeichnet (jeder Tag trägt seinen vollen
  deutschen Namen). Es fehlt ein Weg, nicht die Funktion
- **Vorschlag (nicht hier entschieden):** den Wochentag ausgeschrieben in eine
  `aria-describedby`-Beschreibung des Feldes hängen („Samstag") und die sichtbare Kurzform
  `aria-hidden` lassen. Dann liest der Screenreader „Datum, 15.08.2026, Samstag", ohne dass ein
  zusammenhangloses „Sa" im Vorlesefluss landet
- **Priorität:** nächste Runde

#### BUG-9: Keine einzige Überschrift auf den Seiten der Anwendung
- **Severity:** Low
- **Betrifft:** kein AC direkt — den App-Rahmen, der laut `spec.md` **PROJ-2 gehört**
- **Was ist:** `/`, `/konto` und `/login` enthalten **null** Elemente `<h1>`–`<h6>` und **null**
  `role="heading"`. „Konto", „Deine Daten mitnehmen", die Monatsüberschrift — alles sind `<div>`.
  Screenreader-Nutzer:innen navigieren Seiten üblicherweise über die Überschriftenliste; hier ist
  sie leer, und es bleibt nur das Durchlaufen der ganzen Seite
- **Schritte zur Reproduktion:** angemeldet `/` oder `/konto` abrufen und den Rumpf nach `<h1`–`<h6`
  durchsuchen → 0 Treffer
- **Nachweis:** `grep -o '<h[1-6][ >]'` auf den ausgelieferten Rumpf von `/?monat=2026-09`,
  `/konto` und `/login` → je **0**; `getByRole('heading')` im Browser → leeres Ergebnis
- **Vorbestehend, nicht von diesem Bau verursacht:** Commit `28c3749` hat an der
  Überschriftensemantik nichts geändert. Der Befund fällt hier nur auf, weil dieser Lauf erstmals
  die Zugänglichkeit des Rahmens angesehen hat
- **Priorität:** nächste Runde; berührt auch Seiten von PROJ-1, gehört aber über den Rahmen zu PROJ-2

#### BUG-10: `design.md` nennt `date-fns` eine Transitivabhängigkeit — sie steht direkt in `package.json`
- **Severity:** Low (Dokumentation)
- **Betrifft:** `design.md` → *Notizen aus dem Bau der Ebenen 15–18*, Abweichung 1
- **Was ist:** Die Bau-Notiz hält fest: „Es bleibt eine Transitivabhängigkeit, kein zweiter
  Datumsapparat in unserem Code." Die **zweite** Hälfte stimmt — `grep` findet `date-fns` in `src/`
  null Mal. Die **erste** nicht: `npx shadcn add calendar` hat `"date-fns": "^4.4.0"` in die
  `dependencies` von `package.json` eingetragen, also als direkte Abhängigkeit
- **Nachweis:** `package.json` → `dependencies` enthält `date-fns` und `react-day-picker`;
  `npm ls date-fns` zeigt sie sowohl direkt als auch unter `react-day-picker` (dedupliziert)
- **Warum es zählt:** Der Unterschied ist keine Wortklauberei. Eine direkte Abhängigkeit bleibt
  stehen, wenn `react-day-picker` einmal entfernt wird, und sie lädt die nächste Person ein, sie zu
  benutzen — genau das, was TD-36 verhindern wollte. 26 MB im Abhängigkeitsbaum für null eigene
  Importe
- **Vorschlag:** entweder `date-fns` aus `dependencies` entfernen (sie kommt über
  `react-day-picker` ohnehin mit) oder den Satz in `design.md` berichtigen. Nicht hier entschieden
- **Priorität:** nächste Runde

#### BUG-2: Kategorien unter 0,5 % Anteil erscheinen als „0 %" mit unsichtbarem Balken — **unverändert offen**
- **Severity:** Low · **Betrifft:** AC-14
- **Stand 02.09.2026: erneut nachgestellt, Zustand unverändert.** Monat Juli mit 5.000,00 € Hardware
  · 9,00 € Gebühren · 3,50 € Reise · 2,00 € Sonstiges: die drei kleinen Kategorien zeigen „0 %" und
  tragen `width:0%`, sind also gar nicht sichtbar · *Nachweis: Daten eingespielt, `/?monat=2026-07`
  mit echter Sitzung abgerufen, Balkenbreiten aus dem HTML gelesen*
- **EC-7 bleibt davon unberührt** — die Euro-Summen ergeben exakt die Gesamtsumme

### Zusammenfassung — vierter Durchlauf (02.09.2026)

- **Acceptance Criteria:** **34 von 34 erfüllt.** Die vier neuen (AC-31 bis AC-34) wurden
  vollständig und unabhängig an der laufenden Anwendung ausgeführt; AC-32 mit einer Einschränkung
  bei der Zugänglichkeit (BUG-8). 19 der übrigen 30 wurden als Stichprobe erneut belegt
- **Edge Cases:** **15 von 15 erfüllt** — EC-14 und EC-15 neu und beide an der laufenden Anwendung
  belegt, EC-4/EC-11/EC-12/EC-13 unbeschädigt
- **Bugs:** **0 Critical · 0 High · 0 Medium · 4 Low** (BUG-8, BUG-9, BUG-10 neu; BUG-2 unverändert)
- **Security:** **11 Prüfungen verifiziert, 3 NOT VERIFIED** (Drosselung, Brute Force, CSRF) —
  keine davon negativ
- **Tests:** **297** Einheiten-/Integrationstests grün (5 neue, alle rot nachgewiesen) ·
  **32 von 32** E2E in Chromium und Mobile Safari · Ausfall-Zusicherung grün · Lint, Build und
  TypeScript ohne Befund
- **Leistung:** p95 **97 ms** bei 302 Ausgaben im Monat, gegen eine Zusage von 500 ms
- **Production Ready:** **JA** — kein Critical- oder High-Befund, und die Kriterien, um die es in
  dieser Runde ging, wurden **wirklich ausgeführt**, nicht nur gelesen. „Ready" heißt: keine
  blockierenden Fehler gefunden — **nicht**, dass alles geprüft wurde; die offenen Punkte stehen
  oben unter *Nicht geprüft*

**Was dieser Lauf gezeigt hat, das vorher niemand gemessen hatte.** Der Kalender bringt zwei neue
Attribute ans Datumsfeld — `min` und `max`. Trüge das Formular nicht ausdrücklich `noValidate`,
hätte der Browser das Absenden mit **seiner eigenen** Sprechblase abgefangen, und die im Vertrag
zugesagten deutschen Sätze aus AC-7 und AC-30 wären in einer sonst durchgehend deutschsprachigen
Anwendung nie erschienen — ein Fehler, den keine der bestehenden Zusicherungen bemerkt hätte, weil
sie das Schema direkt prüfen und nicht den Weg durch den Browser. Gemessen: beide Sätze erscheinen.

**Und was er über die Abdeckung gezeigt hat.** EC-14 nennt zwei Grenzen, geprüft wurde eine. Die
Untergrenze und die Blättergrenzen aus TD-37 hätten wegfallen können, ohne dass ein einziger Test
rot geworden wäre. Beide sind jetzt gedeckt, mit Rot-Nachweis — und der Nachweis hat nebenbei
gezeigt, dass die Untergrenze von **zwei** Mechanismen zugleich getragen wird: Sie fällt erst,
wenn man beide entfernt. Genau das ist die Tiefenstaffelung, die TD-37 beschreibt.
