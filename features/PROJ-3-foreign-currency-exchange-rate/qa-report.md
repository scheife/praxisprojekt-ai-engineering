# QA-Bericht — PROJ-3: Fremdwährung & Wechselkurs

**Getestet:** 31.08.2026 (Lauf 1) · 01.09.2026 (Lauf 2) · **01.09.2026 (Lauf 3 — dieser Bericht)**
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf
Port 55321, Kursdienst `api.frankfurter.dev` **live**
**App-URL:** `http://localhost:3210` — **nicht** die 3000 aus `.ai-eng-kit`
**Grundlage:** `spec.md` (19 AC, 9 EC) in der Fassung vom 31.08.2026 · `design.md` mit 13 TD

> **Warum Port 3210.** Die 3000 und die 3100 sind auf dieser Maschine vom produktiven alexmacht
> Business OS belegt. Lauf 2 hatte auf der 3100 gemessen; sie wurde während dieses Laufs von einem
> fremden Server übernommen — der Fehler fiel sofort auf, weil die ausgelieferte Seite nicht
> `auslage.` war. Deshalb 3210, und deshalb wird jede Messung dieses Laufs mit einem Merkmal der
> eigenen App belegt.
>
> **Wie geprüft wurde.** Ausgaben über den echten Formularweg: GET der Seite, die versteckten
> `$ACTION_*`-Felder **aus dem Erfassungsformular** auslesen, multipart-POST auf dieselbe URL. Der
> Kursdienst wurde **nicht** ersetzt — alle Kurse in diesem Lauf sind echte EZB-Referenzkurse.
> Datenbankzustand nach jedem Schritt direkt gelesen.

---

## Was Lauf 3 prüft

Lauf 2 hinterließ **einen offenen High-Befund und einen offenen Medium-Befund**. Beide sind
inzwischen bearbeitet worden — BUG-5 durch `fix(PROJ-3)` (c4781cb), BUG-3 durch die Fristen-Arbeit
an PROJ-2. Dieser Lauf prüft die beiden Behebungen **und** den gesamten Vertrag erneut, weil die
PROJ-2-Arbeit danach genau die Wege angefasst hat, auf denen PROJ-3 steht
(`auth.ts`, `deadline.ts`, `proxy.ts`, `actions/expenses.ts`, `page.tsx`).

| Befund aus Lauf 2 | Stand jetzt |
|---|---|
| **BUG-5 High** — die Erfassungszeile sendete ohne JavaScript per GET, mit allen Feldern in der Adresszeile | **geschlossen.** Das ausgelieferte Markup trägt wieder `method="POST"` und die `$ACTION_*`-Felder · *Evidenz unten bei AC-6* |
| **BUG-3 Medium** — Datenbankausfall hängt 50,4 s und endet mit HTTP 500 ohne Text | **geschlossen** durch PROJ-2. Bei angehaltener Datenbank jetzt **4,0 s** und eine verständliche Meldung · *Evidenz unten bei EC-9* |
| — | **Neu: BUG-6 Low.** Unter Last der Maschine meldet die Frist aus PROJ-2 gesunde Infrastruktur als „nicht erreichbar" — und macht damit die eigene E2E-Suite unzuverlässig |

---

## Acceptance Criteria

### Währung wählen und erfassen

- [x] **AC-1** — Währungsfeld vorhanden, mit `EUR` vorbelegt, **30 Währungen**, Reihenfolge EUR · USD · CHF · GBP, dann alphabetisch · *Evidenz vierfach: `<input type="hidden" name="currency" value="EUR">` im ausgelieferten Formular; die 30 Codes aus `currencies.ts` und die Prüfregel `expenses_currency_known` der Datenbank maschinell verglichen und **zeichengleich**; die Reihenfolge jetzt als Zusicherung festgehalten (`currencies.test.ts`, neu in diesem Lauf, rot nachgewiesen); eine erfundene Währung `XYZ` → „Diese Währung gibt es nicht.", keine Zeile*
- [x] **AC-2** — bei EUR wird **kein** Kursdienst aufgerufen · *Evidenz zweifach: Erfassung über das Formular → `amount_original = amount_cents = 2490`, `rate_per_eur` leer; dazu die Zusicherungen „ruft bei EUR keinen Kurs ab (AC-2)" und „auch bei fehlendem Währungsfeld (EC-8)" in `actions/expenses.test.ts`*
- [x] **AC-3** — Kurs zum Ausgabedatum geholt, Währung, Originalbetrag, Kurs und Kursdatum gespeichert · *Evidenz: Erfassungen mit echtem Dienst → `USD 125000 → 107824 Cent, Kurs 1,1593 vom 17.08.2026` und `JPY 1500000 → 8114 Cent, Kurs 184,87 vom 18.08.2026`; alle vier Felder gesetzt*
- [x] **AC-4** — ohne Kurs am Ausgabetag gilt der **letzte Werktag**, und als Kursdatum steht **dieser** Tag · *Evidenz dreifach, mit dem echten Dienst:*
  - *Samstag 15.08.2026 → Kursdatum **14.08.2026***
  - *Sonntag 16.08.2026 → Kursdatum **14.08.2026***
  - *Samstag 01.01.2000 (die Untergrenze aus PROJ-2 AC-30) → Kursdatum **30.12.1999**, Kurs 1,6051*
- [x] **AC-5** — ohne Kurs keine Ausgabe, Meldung nennt beides · *Evidenz: BRL zum 03.01.2000 → „Für Brasilianischer Real gibt es zum 03.01.2000 keinen Kurs. Bitte prüf das Datum oder wähl eine andere Währung."; Zeilenzahl vorher = nachher. Dazu die Zusicherung „schreibt GAR NICHTS, wenn der Kurs nicht zu holen ist (AC-5)"*
- [x] **AC-6** — die Währung bleibt nach dem Erfassen stehen · *Evidenz: E2E Journey 1 wählt USD, erfasst, prüft danach `toHaveText(/USD/)` — grün in Chromium **und** Mobile Safari. **Und die Zusicherung aus BUG-5:** die Erfassungszeile wird als `<form id="expense-composer" … method="POST">` mit ihren `$ACTION_*`-Feldern ausgeliefert, am rohen HTML des Produktions-Builds geprüft, nicht am hydrierten DOM*

### Anzeigen

- [x] **AC-7** — Euro als Hauptbetrag, darunter Original, Kurs und Kursdatum; Euro-Zeilen unverändert einzeilig · *Evidenz: ausgeliefertes HTML von `/?monat=2026-08` — die Fremdwährungszeilen zweizeilig („81,14 € · 15.000,00 JPY · 1 € = 184,87 JPY · Kurs vom 18.08.2026"), die Euro-Zeile („24,90 €", Papier) einzeilig ohne jede Kursangabe*
- [x] **AC-8** — Kurs in der Richtung „1 € = X", Division rechnet auf · *Evidenz: alle drei Währungen der Ansicht nachgerechnet — 15.000,00 JPY ÷ 184,87 = 81,14 · 1.250,00 USD ÷ 1,1593 = 1.078,24 · 100,00 CHF ÷ 0,939 = 106,50; jede auf den Cent*
- [x] **AC-9** — Monatsübersicht, Kategoriesummen und Gesamtsumme ausschließlich in Euro · *Evidenz: Gesamtsumme **1.397,28 €** im Markup, exakt die Summe der `amount_cents` des Monats laut Datenbank (139728); alle **vier** Kategoriesummen einzeln gegen die Datenbank geprüft und gefunden; im Übersichtsbereich **null** Fremdwährungscodes*
- [x] **AC-10** — später unverändert, weil der Lesepfad keinen Kurs holt · *Evidenz: `queries.ts`, `summary.ts`, `expense-list.tsx`, `month-view.tsx` und `csv.ts` enthalten **weder** einen Import aus `rate.ts` **noch** ein `fetch(` — je 0 Treffer, null Abrufe beim Anzeigen*

### Ändern

- [x] **AC-11** — der Dialog zeigt die Währung, vorbelegt mit der gespeicherten, **und den Originalbetrag** · *Evidenz: E2E Journey 2 prüft `Betrag = 1250,00` und `Währung = USD` — grün in beiden Browsern; dazu die Zusicherung aus Lauf 2, dass der Dialog seine Auswahl behält, **wenn das Speichern scheitert***
- [x] **AC-12** — Neuabruf bei Währungs- **oder** Datumswechsel · *Evidenz: zwei Zusicherungen in `expenses.test.ts` („holt einen neuen Kurs, wenn die WÄHRUNG sich ändert", „… wenn das DATUM sich ändert"), in Lauf 2 rot nachgewiesen*
- [x] **AC-13** — nur Betrag geändert ⇒ Kurs bleibt, Euro-Wert neu gerechnet · *Evidenz: Test „holt NICHTS, wenn nur der Betrag sich ändert — rechnet aber neu (AC-13)"*
- [x] **AC-14** — nur Kategorie oder Notiz ⇒ kein Abruf · *Evidenz: Test „holt NICHTS, wenn nur die Notiz sich ändert (AC-14)"*
- [x] **AC-15** — gescheiterter Neuabruf schreibt nicht · *Evidenz: Test „schreibt GAR NICHT, wenn der nötige Neuabruf scheitert (AC-15)"; dazu die E2E-Zusicherung, dass der Dialog dabei die gewählte Währung behält*
- [x] **AC-16** — Umstellung auf EUR entfernt Kurs und Kursdatum · *Evidenz: Test „entfernt Kurs und Kursdatum bei der Umstellung auf EUR (AC-16)"; zusätzlich erzwingt es die Datenbank — der Versuch, EUR **mit** Kurs zu schreiben, wird abgelehnt (siehe Security)*

### Grenzen

- [x] **AC-17** — Grenzen auf den **Originalbetrag** · *Evidenz: 10.000.000,00 USD → „Der Betrag darf höchstens 9.999.999,99 sein." — **ohne** Währungszeichen, wie AC-17 es verlangt; keine Zeile*
- [x] **AC-18** — Grenze auf den **umgerechneten** Wert, Meldung nennt ihn · *Evidenz: 9.999.999,99 GBP → „Das sind umgerechnet 11.695.906,42 € — höchstens 9.999.999,99 € sind möglich."*

### Datenschutz

- [x] **AC-19** — der Export trägt Währung, Originalbetrag, Kurs und Kursdatum · *Evidenz: `GET /konto/export` mit echter Sitzung → **9 Spalten**, die fünf aus PROJ-2 unverändert an Position 1–5, die vier neuen hinten. BOM `ef bb bf` in den Rohbytes, CRLF durchgehend, **null** einzelne Zeilenumbrüche ohne Wagenrücklauf. Euro-Zeilen lassen Kurs und Kursdatum **leer**, nicht „1,0000"*

**19 von 19 Acceptance Criteria erfüllt.**

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt eine Ausgabe mit **einem** Kurs · *Evidenz: **drei** Rennen mit gleichzeitig freigegebenen, identischen Anfragen und gleicher Vorgangskennung → je genau **1** Zeile und je genau **1** Kurs; beide Anfragen antworten mit HTTP 200 und **ohne** Fehlermeldung, die Person sieht keinen Fehlschlag. Die Garantie ist die Eindeutigkeit `expenses_user_client_token_unique`, in `pg_constraint` bestätigt*
- [x] **EC-2** — langsamer Dienst gilt nach begrenzter Wartezeit als Störung · *Evidenz: `rate.test.ts`; im Quelltext `AbortSignal.timeout(TIMEOUT_MS)` am Abruf (`rate.ts:63`)*
- [x] **EC-3** — unbrauchbarer Kurs gilt als Störung, nie als Kurs · *Evidenz: acht Fälle in `rate.test.ts` (Kurs 0, negativ, keine Zahl, unendlich, Datum fehlt, Datum unlesbar, `rates` fehlt, gar kein Objekt) → alle `unavailable`*
- [x] **EC-4** — fehlender Kurs für die Kombination ist **dauerhaft** und wird nicht als Ausfall gemeldet · *Evidenz: BRL zum 03.01.2000 über das Formular → die Meldung nennt Währung und Datum und behauptet **keinen** vorübergehenden Ausfall; im Code als eigene Klasse (HTTP 404 ⇒ `no-rate-for-date`) von der vorübergehenden getrennt (`rate.ts:77`)*
- [x] **EC-5** — Kleinstbetrag wird abgelehnt, nicht auf null gerundet · *Evidenz: 0,05 IDR → „Umgerechnet ergibt das weniger als 0,01 € — bitte prüf Betrag und Währung.", keine Zeile*
- [x] **EC-6** — gleicher Kurstag ⇒ gleicher Kurs; der laufende Tag wird nicht zwischengespeichert · *Evidenz: `rate.ts:68` — `cache: isCompletedDay(day) ? 'force-cache' : 'no-store'`, mit der Begründung im Quelltext; dazu die Zusicherung in `rate.test.ts`*
- [x] **EC-7** — kein Mischzustand aus zwei Tabs · *Evidenz: die Änderung schreibt alle Felder in **einer** Anweisung (`actions/expenses.ts:340`, `.update({ ...priced.row, category, spent_on: spentOn, note })`); es gibt kein Lesen-Ändern-Zurückschreiben auf den Kursfeldern, und die Zusicherung „schreibt alle vier Felder in einer Anweisung, eingeschränkt auf die eigene Zeile" hält sie fest*
- [x] **EC-8** — Bestandszeilen aus PROJ-2 laufen unverändert weiter · *Evidenz: die Euro-Ausgabe dieses Laufs steht ohne Kurs und einzeilig in der Liste; dazu die Zusicherung „ruft auch bei fehlendem Währungsfeld keinen Kurs ab"*
- [x] **EC-9** — **jetzt erfüllt, war BUG-3.** Bei angehaltener Datenbank antwortet die Erfassung einer Fremdwährungsausgabe mit **HTTP 200 nach 4,0 Sekunden** und der Meldung „Wir erreichen deine Daten gerade nicht. Das liegt nicht an dir — versuch es in einem Moment noch einmal."; **keine Zeile entsteht** (7 → 7). Ein Kursproblem („Für Brasilianischer Real gibt es zum 03.01.2000 keinen Kurs") und ein Datenbankproblem sind damit unterscheidbar benannt. *Zusätzlich die Zusicherung aus PROJ-2: `npm run test:outage` misst bei angehaltenem Datenzugriff 2.509 ms (schreiben), 2.453 ms (lesen) und 2.414 ms (der teuerste Weg) — Grenze 5.000 ms.*

**9 von 9 Edge Cases erfüllt.**

---

## Security Audit

- [x] **Die neue Angriffsfläche dieses Features: kann ein Eingabefeld die ausgehende Adresse verbiegen?** (SSRF) · *Evidenz: Nutzlasten im Währungsfeld — Pfadwechsel `USD/../../../etc/passwd`, fremder Host `USD@evil.example.com`, erfundener Code `XYZ` — **alle** an der Schema-Prüfung abgewiesen („Diese Währung gibt es nicht."). Dazu `2026-08-17/../../currencies` im Datumsfeld → „Bitte gib ein Datum ein.". Zeilenzahl vorher = nachher. Der Abruf baut die Adresse aus geprüften Werten (`rate.ts:58`) und folgt keiner Weiterleitung (`redirect: 'error'`)*
- [x] **An den Kursdienst gehen keine personenbezogenen Daten** — die Vertragszusicherung aus `spec.md` · *Evidenz: die aufgerufene Adresse ist vollständig `${BASE_URL}/${day}?base=EUR&symbols=${currency}` (`rate.ts:58`) — ein Datum und zwei Währungscodes. Weder Betrag, Notiz, Kategorie noch eine Kennung der Person verlassen die Anwendung*
- [x] **Autorisierung über Kontogrenzen, auf den neuen Spalten** · *Evidenz mit zwei echten Konten und ihren JWTs: A liest **9** eigene Zeilen; B liest alle `expenses` → `[]`; gezielt auf As `user_id` → `[]`; `PATCH rate_per_eur = 0.01` auf As Zeilen → `[]`; `DELETE` → `[]`. As 9 Zeilen und ihre 5 verschiedenen Kurse danach **unverändert***
- [x] **Zugriff ohne Anmeldung** — `/`, `/konto` und `/konto/export` → je HTTP **307** auf `/login`; `expenses`, `profiles` und `login_attempts` anonym über die Datenschnittstelle → je HTTP **401**
- [x] **Injection in die Notiz** — `<img src=x onerror=alert(1)>` wird gespeichert, aber **maskiert** ausgeliefert (kein `<img`-Tag im Dokument); `x'; drop table public.expenses;--` bleibt Text, `to_regclass('public.expenses')` unverändert; die CSV-Formel `=cmd|' /C calc'!A0` verlässt den Export als `"'=cmd|' /C calc'!A0"` — mit vorangestelltem Apostroph
- [x] **Die Datenbank lässt die verbotenen Zustände nicht zu** — der Kern von TD-8 · *Evidenz: vier Schreibversuche mit dem eigenen JWT direkt an der Datenschnittstelle, alle abgewiesen — EUR **mit** Kurs und Fremdwährung **ohne** Kurs an `expenses_currency_rate_consistent`, Kurs 0 an `expenses_rate_positive`, `XYZ` an `expenses_currency_known`. Eine Ausgabe ohne Euro-Wert ist damit **unmöglich**, nicht nur unwahrscheinlich*
- [x] **Keine Secrets im Client-Bundle** — je **0** Treffer in `.next/static` für `GATE_SECRET`, `service_role`, `sb_secret`, das JWT-Secret, `TRUSTED_PROXY_HOPS` und `SERVICE_ROLE`. Die einzigen `NEXT_PUBLIC_`-Variablen sind `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` — beide gehören in den Browser
- [x] **Sicherheits-Header** — an der laufenden App geprüft, alle vier vorhanden: `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: origin-when-cross-origin` · `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] **Zugangsdaten und Eingaben in der URL** — **der Befund aus Lauf 2 ist geschlossen.** Die Erfassungszeile wird als `method="POST"` ausgeliefert, das Anmeldeformular ebenfalls (`<form … method="POST">`). Kein Feld landet mehr in der Adresszeile
- [x] **PROJ-3 führt keine neue Umgebungsvariable und kein Geheimnis ein** — der Kursdienst braucht weder Konto noch Schlüssel. **Keine `[user]`-Aufgabe in `tasks.md`**, also auch keine offene
- [!] **Drosselung eines gewöhnlichen Endpunkts** — NOT VERIFIED: `/konto/export` hat weiterhin keine, und die Erfassung hat keine eigene. `design.md` (TD-22 in PROJ-2) entscheidet das ausdrücklich so. Für ein MVP vertretbar, aber nicht als bestandene Prüfung verbucht
- [!] **Brute Force auf Zugangsdaten** — NOT VERIFIED für PROJ-3: Dieses Feature hat keinen Zugangsdaten-Pfad. Die Drosselung von PROJ-1 ist unberührt (10 Registrierungen je 60 Minuten, in `signup_attempt_gate` bestätigt) und wurde dort geprüft

**10 Prüfungen verifiziert, 2 NOT VERIFIED.** Keine davon negativ.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **255 Tests in 20 Dateien, alle grün** (vor diesem Lauf 247).
- **Neu in diesem QA-Lauf: 8 Tests** in `src/lib/expenses/currencies.test.ts` — eine Datei, die es
  noch nicht gab, obwohl es `categories.test.ts` seit PROJ-2 gibt. Sie schließt die Lücke, die
  `currencies.ts` selbst benennt: „Weichen die beiden Listen auseinander, gewinnt die Datenbank — sie
  lehnt ab, was der Code durchgelassen hat." Ohne Zusicherung ist dieser Fall von außen unsichtbar
  und teuer: Die Auswahl bietet die Währung an, der Kurs wird geholt — ein Aufruf beim fremden
  Dienst — und **erst das Schreiben** scheitert. Der Test liest die Prüfregel aus der Migration und
  vergleicht sie mit der Liste im Code; dazu Reihenfolge, Eindeutigkeit und die drei Hilfsfunktionen.
- **Rot-Nachweis geführt** für die neuen Tests: drei gezielte Brüche an `currencies.ts` — eine
  Währung im Code, die die Migration nicht kennt (`XAU`) · die vorangestellten Währungen vertauscht ·
  EUR nicht mehr als Vorbelegung. Jeder wurde von genau den Zusicherungen gefangen, die ihn
  verhindern sollen; die Quelle ist danach nachweislich unverändert (`git diff` leer).
- **Lint:** ohne Befund. **Build:** erfolgreich. **TypeScript:** keine Fehler.

## E2E Tests

**Vorhanden seit `/e2e-tests` (01.09.2026), in diesem Lauf als Regression gefahren** —
`tests/PROJ-3-foreign-currency-exchange-rate.spec.ts`, fünf Zusicherungen in zwei Browsern.

| Journey | deckt ab | Ergebnis |
|---|---|---|
| 1: Eine Ausgabe in Fremdwährung erfassen und nachrechnen können | AC-1, AC-3, AC-6, AC-7, AC-8, AC-9 | **grün** |
| 2: Die Währung einer Ausgabe ändern — der Kurs zieht mit | AC-11, AC-12, AC-16 | **grün** |
| 3: Ohne Kurs entsteht keine Ausgabe, und die Eingaben bleiben stehen | AC-5, EC-4 | **grün** |
| Die Erfassungszeile wird als POST ausgeliefert — nie als GET | BUG-5 | **grün** |
| Der Änderungsdialog behält die Auswahl, wenn das Speichern scheitert | AC-11, AC-15 | **grün** |

**Alle PROJ-3-Journeys sind in Chromium und Mobile Safari grün.**

## Regression

`features/INDEX.md` führt kein Feature als *Deployed*; PROJ-1 und PROJ-2 stehen auf *Approved* und
sind beide von PROJ-3 berührt. **Zusätzlich hat PROJ-2 nach dem letzten Lauf die Fristen-Arbeit
bekommen und dabei genau die Wege angefasst, auf denen PROJ-3 steht** — `auth.ts`, `deadline.ts`,
`proxy.ts`, `actions/expenses.ts`, `page.tsx`.

- **PROJ-1: 8 von 8 E2E-Journeys grün** (Chromium und Mobile Safari, einzeln gefahren).
- **PROJ-2 und PROJ-3: alle Journeys grün** im vollständigen Suite-Lauf.
- **Die Summen von PROJ-2 rechnen unverändert:** Gesamtsumme und alle vier Kategoriesummen stimmen
  auf den Cent mit der Datenbank überein, obwohl der Monat vier Währungen enthält.
- **Euro-Ausgaben verhalten sich exakt wie vorher** — einzeilig, ohne Kursangabe, ohne Außenkontakt.
- **Die Frist aus PROJ-2 bricht den Kurspfad nicht:** Eine Fremdwährungserfassung braucht mit echtem
  Kursabruf 250–500 ms und bleibt damit weit unter der Frist. Die 5-Sekunden-Frist des Kursdienstes
  und die 2-Sekunden-Frist der Datenbank liegen auf verschiedenen Aufrufen und stören einander nicht.
- **Zur Zuverlässigkeit der Suite selbst siehe BUG-6** — sie ist unter Last der Maschine nicht
  verlässlich grün, und das ist ein Befund, kein Rauschen.

---

## Not Verified In This Run

- [!] **Darstellung auf 768 px und 1440 px** — kein Viewport in `/qa`. **Teilweise gedeckt:** Die
  E2E-Suite fährt Mobile Safari als iPhone 13 (390 px), dort sind alle PROJ-3-Journeys grün — die
  Erfassungszeile mit ihrer sechsten Spalte und der Änderungsdialog mit seiner dritten sind auf einem
  schmalen Gerät also **bedienbar**. Ob sie dabei *gut aussehen*, ist nicht geprüft: Es gibt keine
  Zusicherung auf Umbruch, Abschneiden oder Überlappung, und kein Bild wurde angesehen.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Drosselung gewöhnlicher Endpunkte** — bewusst nicht implementiert (TD-22 in PROJ-2).
- [!] **Brute Force** — PROJ-3 hat keinen Zugangsdaten-Pfad.
- [!] **Ein vollständiger Neuaufbau der Datenbank** (`supabase db reset`) — nicht ausgeführt, weil er
  das Tor-Geheimnis von PROJ-1 löschen würde, das ohne den Klartext aus `.env.local` nicht
  wiederherstellbar ist. Die Migration ist als Einzelschritt sauber eingespielt und ihre vier
  Prüfregeln stehen in `\d expenses`.
- [!] **Das Verhalten des Kursdienstes über die Zeit** — Ausfallhäufigkeit und etwaige Aufrufgrenzen
  von frankfurter.dev sagt eine Momentaufnahme nicht. AC-5 fängt einen Ausfall sauber ab.
- [!] **Die Schwelle von BUG-6 in Zahlen** — dass die Frist unter Last falsch auslöst, ist belegt
  (siehe unten). **Bei welcher Gleichzeitigkeit genau**, ist es nicht: Bei ruhiger Maschine blieben
  80 gleichzeitige Seitenaufrufe fehlerfrei, unter Last kippten schon deutlich weniger. Die Schwelle
  hängt an der Auslastung des Rechners, nicht an einer Zahl, die sich hier festhalten ließe.

---

## Bugs

### BUG-6: Unter Last meldet die Frist gesunde Infrastruktur als „nicht erreichbar"

- **Severity:** Low · **Status:** offen · **Betrifft:** PROJ-2 (EC-4/EC-12, `DEADLINE_MS`), mittelbar PROJ-3 EC-9 · **nicht von PROJ-3 verursacht** · gefunden in QA-Lauf 3
- **Was passiert:** Die Frist aus PROJ-2 ist ein **Wanduhr-Budget** von 2 Sekunden auf jeden
  Datenbank- und Auth-Aufruf (`deadline.ts`, `DEADLINE_MS = 2000`). Sie misst damit nicht, wie lange
  die Datenbank braucht, sondern wie lange die Anfrage **insgesamt** unterwegs war — Warteschlange im
  eigenen Node-Prozess eingeschlossen. Ist die Maschine ausgelastet, reißt das Budget, obwohl die
  Datenbank kerngesund ist, und die Person liest „Wir erreichen deine Daten gerade nicht" oder
  „Die Registrierung ist gerade nicht möglich".
- **Evidenz:** Im vollständigen E2E-Lauf mit zwei Browsern und zwei Arbeitern scheiterten Tests
  daran — einmal 2 von 28, in einem anderen Lauf 16 von 28. Der Schnappschuss eines Fehlschlags
  zeigt die Meldung im Klartext: `alert: Die Registrierung ist gerade nicht möglich. Bitte versuche
  es in einem Moment noch einmal.` **Jeder dieser Tests ist einzeln gefahren grün** — PROJ-1 8/8,
  die beiden PROJ-2-Journeys 2/2. Gegenprobe zur Datenbank: Sie beantwortete zum selben Zeitpunkt
  40 gleichzeitige Abfragen in **35 ms**.
- **Reproduktion:** `npx playwright test` (voller Lauf, zwei Arbeiter) auf einer Maschine, die
  nebenher etwas zu tun hat. Es trifft nicht immer dieselben Tests — das ist das Merkmal einer
  Schwelle, nicht eines kaputten Features.
- **Warum Low:** Bei ruhiger Maschine blieben 80 gleichzeitige Seitenaufrufe **fehlerfrei** (0 von
  80). Es gehen keine Daten verloren, es entsteht keine falsche Zeile, und es ist keine
  Sicherheitslücke. Das Produkt hat einen Benutzer und laut PRD **kein Server-Deployment**.
- **Warum es trotzdem im Bericht steht, und nicht als Rauschen abgetan:** Es macht die eigene
  E2E-Suite unzuverlässig — und eine unzuverlässige Suite ist genau der Weg, auf dem BUG-1 und BUG-2
  zwei Prüfungen überlebt haben. Wer rote Tests gewohnheitsmäßig noch einmal laufen lässt, sieht
  irgendwann den echten roten Test nicht mehr. Zweitens sagt die App etwas Unwahres über die eigene
  Lage: Sie behauptet ein Infrastrukturproblem, wo sie selbst der Engpass ist — dieselbe Art von
  Unehrlichkeit, gegen die PROJ-3 seine Kursmeldungen sorgfältig getrennt hat.
- **Wohin es gehört:** `/refine PROJ-2`. Denkbare Richtungen, hier nicht entschieden: die Frist erst
  ab dem tatsächlichen Absenden des Aufrufs zählen statt ab dem Eintritt in die Anfrage; oder die
  Meldung bei Fristablauf zurückhaltender fassen, sodass sie keine Aussage über die Gegenstelle macht.

---

## Summary

**Dritter Durchlauf, 01.09.2026.**

- **Acceptance Criteria:** **19 von 19 erfüllt**
- **Edge Cases:** **9 von 9 erfüllt** — EC-9 ist mit der Fristen-Arbeit aus PROJ-2 geschlossen
- **Bugs:** 0 Critical · **0 High** · 0 Medium · **1 Low offen** (BUG-6, gehört nach PROJ-2) ·
  **geschlossen in diesem Lauf: BUG-5 (High) und BUG-3 (Medium)**; aus Lauf 2 bereits geschlossen:
  BUG-1, BUG-2, BUG-4
- **Security:** 10 Prüfungen verifiziert, 2 NOT VERIFIED, keine negativ. Der Befund aus Lauf 2 ist
  geschlossen — die Erfassungszeile trägt wieder `method="POST"`
- **Tests:** 255 Unit-/Integrationstests grün (8 neue, rot nachgewiesen) · alle PROJ-3-Journeys grün
  in Chromium und Mobile Safari · PROJ-1 8/8 · Lint, Build und TypeScript sauber
- **Production Ready:** **JA** — kein Critical- und kein High-Befund. Mit den zwei NOT-VERIFIED-Punkten
  im Blick (keine Drosselung gewöhnlicher Endpunkte, kein Firefox) und dem offenen BUG-6, der PROJ-2
  gehört.

**Was dieser Lauf wirklich gezeigt hat.** Die beiden Befunde aus Lauf 2 sind nicht nur als behoben
gemeldet, sondern nachgemessen: Die Erfassungszeile wird wieder als POST ausgeliefert — am rohen HTML
eines Produktions-Builds geprüft, nicht am hydrierten DOM, weil genau dort die Lücke lag. Und bei
angehaltener Datenbank antwortet die Erfassung nach 4 Sekunden mit einer verständlichen Meldung statt
nach 50 Sekunden mit einem leeren HTTP 500.

**Was neu dazukam, ist kein Fehler im Feature, sondern einer in der Ehrlichkeit der App unter Last.**
Die Zwei-Sekunden-Frist misst die Gesamtdauer einer Anfrage und schreibt eine gerissene Frist der
Datenbank zu. Solange die Maschine ruhig ist, passiert das nie; unter Last sagt die App etwas über
die Gegenstelle, was sie nicht geprüft hat. Das ist derselbe Fehler in klein, den PROJ-3 beim
Kursdienst groß vermieden hat — dort ist „gibt es nicht" sorgfältig von „gerade nicht erreichbar"
getrennt.

**Ein methodischer Hinweis, weil er diesen Lauf beinahe verdorben hätte:** Zwei Messungen mussten
verworfen werden. Die erste lief gegen einen fremden Server, der die 3100 übernommen hatte; die
zweite entstand, während Docker Desktop ausfiel, und zeigte eine Ausfallrate, die sich bei gesunder
Maschine nicht bestätigte. Beide Male hat erst die Gegenprobe den Irrtum gezeigt. Was hier als
gemessen steht, ist das, was nach der Gegenprobe übrig blieb.
