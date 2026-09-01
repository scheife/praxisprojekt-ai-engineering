# QA-Bericht — PROJ-3: Fremdwährung & Wechselkurs

**Getestet:** 2026-08-31 (erster Durchlauf)
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf Port 55321, Kursdienst `api.frankfurter.dev` **live**
**App-URL:** `http://localhost:3100` — **nicht** die 3000 aus `.ai-eng-kit`
**Grundlage:** `spec.md` (19 AC, 9 EC) in der Fassung vom 31.08.2026 nach dem `/refine` · `design.md` mit 13 TD

> **Warum Port 3100.** Der Dev-Server des produktiven alexmacht Business OS hält auf dieser Maschine
> die 3000 (PID 97973). Der Prozess wurde nicht angefasst — die Trennung ist eine Rahmenbedingung des
> PRD.
>
> **Wie geprüft wurde.** Ausgaben über den echten Formularweg: GET der Seite, die versteckten
> `$ACTION_*`-Felder auslesen, multipart-POST auf dieselbe URL. Der Kursdienst wurde **nicht**
> ersetzt — alle Kurse in diesem Lauf sind echte EZB-Referenzkurse. Datenbankzustand nach jedem
> Schritt direkt gelesen.

---

## Acceptance Criteria

### Währung wählen und erfassen

- [x] **AC-1** — Währungsfeld vorhanden, mit `EUR` vorbelegt, **30 Währungen**, Reihenfolge EUR · USD · CHF · GBP, dann alphabetisch · *Evidenz: `name="currency"` im ausgelieferten Formular; die 30 Codes im Anwendungscode und die Prüfregel `expenses_currency_known` der Datenbank sind **zeichengleich** (maschinell verglichen); eine erfundene Währung `XYZ` → „Diese Währung gibt es nicht.", keine Zeile*
- [x] **AC-2** — bei EUR wird **kein** Kursdienst aufgerufen · *Evidenz zweifach: neue Zusicherungen in `src/lib/actions/expenses.test.ts` („ruft bei EUR keinen Kurs ab", „auch bei fehlendem Währungsfeld"), rot nachgewiesen; und zwei EUR-Erfassungen über das Formular → `amount_original = amount_cents`, `rate_per_eur` leer*
- [x] **AC-3** — Kurs zum Ausgabedatum geholt, Währung, Originalbetrag, Kurs und Kursdatum gespeichert · *Evidenz: fünf Fremdwährungserfassungen (USD, CHF, JPY, HUF) → alle vier Felder gesetzt, z. B. `USD 125000 → 107824 Cent, Kurs 1,1593 vom 17.08.2026`*
- [x] **AC-4** — ohne Kurs am Ausgabetag gilt der **letzte Werktag**, und als Kursdatum steht **dieser** Tag · *Evidenz dreifach, mit dem echten Dienst:*
  - *Samstag 15.08.2026 → Kursdatum **14.08.2026***
  - *Sonntag 16.08.2026 → Kursdatum **14.08.2026***
  - *Samstag 01.01.2000 (die Untergrenze aus PROJ-2 AC-30) → Kursdatum **30.12.1999***
- [x] **AC-5** — ohne Kurs keine Ausgabe, Meldung nennt beides · *Evidenz: BRL zum 03.01.2000 → „Für Brasilianischer Real gibt es zum 03.01.2000 keinen Kurs. Bitte prüf das Datum oder wähl eine andere Währung."; Zeilenzahl vorher = nachher. Der Ausfallfall zusätzlich als Test („schreibt GAR NICHTS, wenn der Kurs nicht zu holen ist") mit `from` **nie** aufgerufen*
- [ ] **AC-6** — **BUG-2, im Browser widerlegt.** Nach dem Speichern steht die Währung wieder auf `EUR`. Die Schlussfolgerung aus dem Code war richtig **und trotzdem falsch**: Der Wert geht nicht über den Rücksetz-Effekt verloren, sondern über das Auswahlfeld selbst. Gefunden von `/e2e-tests`. Alte, überholte Begründung: *Evidenz: der Rücksetz-Effekt in `expense-composer.tsx` fasst `setCurrency` **null**-mal an, während `setAmount('')` und `setNote('')` laufen. **Im Browser nicht nachgestellt** — siehe Not Verified*

### Anzeigen

- [x] **AC-7** — Euro als Hauptbetrag, darunter Original, Kurs und Kursdatum; Euro-Zeilen unverändert einzeilig · *Evidenz: ausgeliefertes HTML von `/?monat=2026-08`, acht Zeilen — die fünf Fremdwährungszeilen zweizeilig („81,14 € · 15.000,00 JPY · 1 € = 184,87 JPY · Kurs vom 18.08.2026"), die zwei Euro-Zeilen einzeilig wie in PROJ-2*
- [x] **AC-8** — Kurs in der Richtung „1 € = X", Division rechnet auf · *Evidenz: alle acht Fremdwährungszeilen des CSV-Exports nachgerechnet — `Original ÷ Kurs = Euro-Betrag` stimmt in jeder auf den Cent (z. B. 15.000,00 JPY ÷ 184,87 = 81,14)*
- [x] **AC-9** — Monatsübersicht, Kategoriesummen und Gesamtsumme ausschließlich in Euro · *Evidenz: Gesamtsumme **29.196,24 €** im Markup, exakt die Summe der `amount_cents` des Monats laut Datenbank; alle **sechs** Kategoriesummen einzeln gegen die Datenbank geprüft und gefunden; im Übersichtsbereich **kein** Fremdwährungscode*
- [x] **AC-10** — später unverändert, weil der Lesepfad keinen Kurs holt · *Evidenz: `queries.ts`, `summary.ts`, `expense-list.tsx`, `month-view.tsx` und `csv.ts` enthalten **weder** einen Import aus `rate.ts` **noch** ein `fetch(` — null Abrufe beim Anzeigen*

### Ändern

- [x] **AC-11** — der Dialog zeigt die Währung, vorbelegt mit der gespeicherten · *Evidenz: `edit-expense-dialog.tsx:69` (`useState(expense.currency)`), `:176` (`<Select name="currency">`). **Der Dialog wird erst im Browser gerendert** und steht nicht im ausgelieferten HTML — siehe Not Verified*
- [x] **AC-12** — Neuabruf bei Währungs- **oder** Datumswechsel · *Evidenz: zwei Zusicherungen in `expenses.test.ts`, beide rot nachgewiesen (Bruch „friert den Kurs für immer ein" lässt genau sie fallen)*
- [x] **AC-13** — nur Betrag geändert ⇒ Kurs bleibt, Euro-Wert neu gerechnet · *Evidenz: Test „holt NICHTS, wenn nur der Betrag sich ändert" — `fetchRate` nicht aufgerufen, `rate_per_eur` unverändert 1,1593, `amount_cents` neu 5003*
- [x] **AC-14** — nur Kategorie oder Notiz ⇒ kein Abruf · *Evidenz: Test „holt NICHTS, wenn nur die Notiz sich ändert"*
- [x] **AC-15** — gescheiterter Neuabruf schreibt nicht · *Evidenz: Test „schreibt GAR NICHT, wenn der nötige Neuabruf scheitert" — `from` genau **einmal** aufgerufen (nur das Lesen), kein Schreibvorgang*
- [x] **AC-16** — Umstellung auf EUR entfernt Kurs und Kursdatum · *Evidenz: Test „entfernt Kurs und Kursdatum bei der Umstellung auf EUR"; zusätzlich erzwingt es die Datenbank — der Versuch, EUR **mit** Kurs zu schreiben, wird abgelehnt (siehe Security)*

### Grenzen

- [x] **AC-17** — Grenzen auf den **Originalbetrag** · *Evidenz: 10.000.000,00 USD → „Der Betrag darf höchstens 9.999.999,99 sein." — **ohne** Währungszeichen, wie es AC-17 verlangt; keine Zeile*
- [x] **AC-18** — Grenze auf den **umgerechneten** Wert, Meldung nennt ihn · *Evidenz: 9.999.999,99 GBP → „Das sind umgerechnet 11.695.906,42 € — höchstens 9.999.999,99 € sind möglich."*

### Datenschutz

- [x] **AC-19** — der Export trägt Währung, Originalbetrag, Kurs und Kursdatum · *Evidenz: `GET /konto/export` mit echter Sitzung → **9 Spalten**, die fünf aus PROJ-2 unverändert an Position 1–5, die vier neuen hinten. BOM vorhanden, CRLF durchgehend, **null** einzelne Zeilenumbrüche ohne Wagenrücklauf. Euro-Zeilen lassen Kurs und Kursdatum **leer**, nicht „1,0000"*

**18 von 19 Acceptance Criteria erfüllt.** **AC-6 ist widerlegt** (BUG-2, von `/e2e-tests` im Browser gefunden). AC-11 bleibt am Code belegt — die Journey erreicht die Stelle nicht, weil BUG-1 vorher zuschlägt.

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt eine Ausgabe mit **einem** Kurs · *Evidenz: **drei** Rennen mit gemeinsamer Barriere und identischer Vorgangskennung → je genau 1 Zeile und je genau 1 verschiedener Kurs; **beide** Anfragen melden „saved", die Person sieht keinen Fehler. Die Garantie ist die Eindeutigkeit `expenses_user_client_token_unique` aus PROJ-2, in der Datenbank bestätigt*
- [x] **EC-2** — langsamer Dienst gilt nach begrenzter Wartezeit als Störung · *Evidenz: `rate.test.ts` — abgelaufene Frist → `unavailable`; und der Abruf bekommt nachweislich ein `AbortSignal` mit*
- [x] **EC-3** — unbrauchbarer Kurs gilt als Störung, nie als Kurs · *Evidenz: **acht** Fälle in `rate.test.ts` (Kurs 0, negativ, keine Zahl, unendlich, Datum fehlt, Datum unlesbar, `rates` fehlt, gar kein Objekt) → alle `unavailable`*
- [x] **EC-4** — fehlender Kurs für die Kombination ist **dauerhaft** und wird nicht als Ausfall gemeldet · *Evidenz: BRL zum 03.01.2000 über das Formular → Meldung nennt Währung und Datum und **nicht** „nicht abrufbar"; im Test zusätzlich als eigene Klasse (HTTP 404) von der vorübergehenden getrennt*
- [x] **EC-5** — Kleinstbetrag wird abgelehnt, nicht auf null gerundet · *Evidenz: 0,05 IDR → „Umgerechnet ergibt das weniger als 0,01 € — bitte prüf Betrag und Währung.", keine Zeile*
- [x] **EC-6** — gleicher Kurstag ⇒ gleicher Kurs; der laufende Tag wird nicht zwischengespeichert · *Evidenz doppelt: **gemessen** — fünf Erfassungen mit gleichem abgeschlossenem Tag und gleicher Währung brauchten im Median **150 ms**, fünf mit je anderem Tag **274 ms**; die Ersparnis von 124 ms je Erfassung ist der eingesparte Abruf. Dazu die Zusicherung im Test, dass der **laufende** Tag `cache: 'no-store'` bekommt*
- [x] **EC-7** — kein Mischzustand aus zwei Tabs · *Evidenz: die Änderung schreibt alle Felder in **einer** Anweisung (`actions/expenses.ts:321`, `.update({ ...priced.row, category, spent_on, note })`); es gibt kein Lesen-Ändern-Zurückschreiben auf den Kursfeldern*
- [x] **EC-8** — Bestandszeilen aus PROJ-2 laufen unverändert weiter · *Evidenz: eine Erfassung **ohne** Währungsfeld → `currency = EUR`, kein Kurs, einzeilige Darstellung; dazu die Zusicherung „auch bei fehlendem Währungsfeld keinen Kurs abrufen"*
- [ ] **EC-9** — **BUG-3.** Bei nicht erreichbarer Datenbank erscheint **keine** verständliche Meldung: die Anfrage hängt **50,4 Sekunden** und endet mit **HTTP 500** und leerem Rumpf. Ein Kursproblem und ein Datenbankproblem sind damit zwar nicht zu verwechseln — aber EC-9 verlangt ausdrücklich, dass PROJ-2s EC-4 weiter gilt, und das tut es nicht. **Nicht von PROJ-3 verursacht**, siehe BUG-3

**8 von 9 Edge Cases erfüllt.**

---

## Security Audit

- [x] **Die neue Angriffsfläche dieses Features: kann ein Eingabefeld die ausgehende Adresse verbiegen?** (SSRF) · *Evidenz: **sechs** Nutzlasten im Währungsfeld — Pfadwechsel `USD/../../../etc/passwd`, fremder Host `USD@evil.example.com`, angehängte Query, `http://169.254.169.254/` (Metadatendienst), Zeilenumbruch mit gefälschtem Kopf, Platzhalter `*` — **alle** an der Schema-Prüfung abgewiesen („Diese Währung gibt es nicht."). Dazu **drei** im Datumsfeld (`2026-08-17/../../currencies`, `?base=XXX`, `latest`) → alle „Bitte gib ein Datum ein.", Zeilenzahl vorher = nachher*
- [x] **Autorisierung über Kontogrenzen, auf den neuen Spalten** · *Evidenz mit zwei echten Konten und ihren JWTs: B liest alle `expenses` → `[]`, obwohl A **12** Zeilen hat; gezielt auf As `user_id` → `[]`; `PATCH rate_per_eur = 0.01` auf As Zeilen → `[]` und As 12 Zeilen danach **unverändert**; `DELETE` → `[]`. Bs CSV-Export enthält nur die Kopfzeilen*
- [x] **Zugriff ohne Anmeldung** — `/`, `/konto` und `/konto/export` → je HTTP 307 auf `/login`; `expenses` anonym über die Datenschnittstelle → HTTP 401
- [x] **Injection in die Notiz** — `<img src=x onerror=alert(1)>` und `x'; drop table public.expenses;--` werden gespeichert, aber **maskiert** ausgeliefert (kein `<img`-Tag im Dokument); `to_regclass('public.expenses')` unverändert
- [x] **Die Datenbank lässt die verbotenen Zustände nicht zu** — der Kern von TD-8 · *Evidenz aus dem Bau, in diesem Lauf am Schema bestätigt: `expenses_currency_rate_consistent`, `expenses_currency_known`, `expenses_rate_positive`, `expenses_amount_original_range` stehen alle in `\d expenses`. Ein Kurs auf einer EUR-Zeile oder eine Fremdwährung ohne Kurs ist damit **unmöglich**, nicht nur unwahrscheinlich*
- [x] **Keine Secrets im Client-Bundle** — je **0** Treffer in `.next/static` für `GATE_SECRET`, `service_role`, `sb_secret`, das JWT-Secret und `TRUSTED_PROXY_HOPS`
- [x] **PROJ-3 führt keine neue Umgebungsvariable und kein Geheimnis ein** — der Kursdienst braucht weder Konto noch Schlüssel; `design.md` → *Settings the user makes*: „Keine". **Keine `[user]`-Aufgabe in `tasks.md`**, also auch keine offene
- [x] **Last auf dem fremden Dienst** — durch den Zwischenspeicher begrenzt, gemessen (siehe EC-6). Ungültige Eingaben lösen **gar keinen** Abruf aus (Test „prüft die Eingaberegeln VOR dem Kursabruf")
- [x] **Zugangsdaten in der URL** — PROJ-3 fügt kein Formular mit Zugangsdaten hinzu; die Erfassung geht wie alles über eine Server Action und damit per POST
- [!] **Drosselung eines gewöhnlichen Endpunkts** — NOT VERIFIED: `/konto/export` hat weiterhin keine, und die Erfassung hat keine eigene. `design.md` (TD-22 in PROJ-2) entscheidet das ausdrücklich so. Für ein MVP vertretbar, aber nicht als bestandene Prüfung verbucht
- [!] **Brute Force auf Zugangsdaten** — NOT VERIFIED für PROJ-3: Dieses Feature hat keinen Zugangsdaten-Pfad. Die Drosselung von PROJ-1 ist unberührt und wurde dort im achten Lauf geprüft

**9 Prüfungen verifiziert, 2 NOT VERIFIED.** Keine davon negativ.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **214 Tests in 15 Dateien, alle grün** (vor diesem Lauf 209).
- **Neu in diesem QA-Lauf: 5 Tests** in `src/lib/actions/expenses.test.ts`. Sie schließen eine echte
  Lücke: **AC-2 hatte keine Zusicherung** — dass eine Euro-Erfassung den Kursdienst nie aufruft, war
  nirgends festgehalten, obwohl daran hängt, dass ein Ausfall des Dienstes die Euro-Erfassung nicht
  mitreißt. Dazu die Reihenfolge aus TD-13 (Eingaberegeln vor dem Abruf), das Einfrieren des
  **gelieferten** Kursdatums und der Fall „Abruf scheitert ⇒ die Tabelle wird gar nicht berührt".
- **Rot-Nachweis geführt**, für die neuen Tests dieses Laufs und stichprobenartig für die des Baus:
  drei gezielte Brüche an `actions/expenses.ts` (auch für Euro einen Kurs holen · trotz
  gescheitertem Abruf weiterschreiben · das angefragte statt des gelieferten Kursdatums speichern) —
  jeder von genau den Tests gefangen, die ihn verhindern sollen.
- **Lint:** ohne Befund. **Build:** erfolgreich. **TypeScript:** keine Fehler.

## E2E Tests

**Nachgetragen von `/e2e-tests` am 01.09.2026** — drei kritische Journeys in
`tests/PROJ-3-foreign-currency-exchange-rate.spec.ts`. **Sie haben zwei schwere Fehler gefunden,
die dieser Bericht zuvor als erfüllt geführt hat.**

| Journey | deckt ab | Ergebnis |
|---|---|---|
| 1: Eine Ausgabe in Fremdwährung erfassen und nachrechnen können | AC-1, AC-3, AC-6, AC-7, AC-8, AC-9 | **rot** — scheitert an **BUG-2** (AC-6) |
| 2: Die Währung einer Ausgabe ändern — der Kurs zieht mit | AC-11, AC-12, AC-16 | **rot** — scheitert an **BUG-1** |
| 3: Ohne Kurs entsteht keine Ausgabe, und die Eingaben bleiben stehen | AC-5, EC-4 | **rot** — die Meldung stimmt, die Währung fällt zurück (**BUG-2**) |

**Regression der Nachbarn:** PROJ-1 und PROJ-2 unverändert **18 von 18 grün**.

**Die Tests sind geprüft, nicht nur geschrieben.** Bevor sie als Befund gelten durften, wurden beide
Fehler probeweise geflickt — daraufhin liefen **alle drei Journeys grün** (20,1 s). Danach wurde der
Flicken zurückgenommen und der Quellcode als unverändert nachgewiesen (`git status src/` leer). Damit
steht fest: Die Journeys scheitern **am Produkt und nicht an sich selbst**, und sie werden grün,
sobald die Fehler behoben sind. Der Rot-Nachweis, den dieser Schritt verlangt, ist damit erbracht —
sie sind gerade rot, und zwar an genau der Zeile, die den kaputten Schritt benennt.

**Warum diese Journeys robust gegen einen fremden Dienst sind:** Sie benutzen ein abgeschlossenes
Datum (17.08.2026), dessen EZB-Kurs für immer feststeht, und prüfen **keinen fest verdrahteten
Euro-Betrag**, sondern rechnen die auf der Seite angezeigten Zahlen gegeneinander auf:
`Originalbetrag ÷ Kurs = Euro-Betrag`. Das prüft AC-8 strenger als ein Vergleich mit einer Konstante
und hält, wenn sich Kurse ändern.

## Regression

`features/INDEX.md` führt kein Feature als *Deployed*; PROJ-1 und PROJ-2 stehen auf *Approved* und
sind beide von PROJ-3 berührt — die Ausgaben-Tabelle, die Erfassungszeile, die Liste, der
Änderungsdialog und der CSV-Export gehören PROJ-2.

- **Alle 18 E2E-Journeys grün**, darunter PROJ-2s Journey 1, die über die **veränderte**
  Erfassungszeile eine Ausgabe anlegt, und Journey 4, die den **veränderten** CSV-Export herunterlädt.
- **Die Summen von PROJ-2 rechnen unverändert:** Gesamtsumme und alle sechs Kategoriesummen stimmen
  auf den Cent mit der Datenbank überein, obwohl der Monat vier Währungen enthält.
- **Euro-Ausgaben verhalten sich exakt wie vorher** — einzeilig, ohne Kursangabe, ohne Außenkontakt.
- **PROJ-1 unberührt:** Anmeldung, Zugriffsschutz und Kontolöschung laufen über dieselben Wege; die
  vier E2E-Journeys von PROJ-1 sind grün.
- **Zwei PROJ-2-Tests mussten mitziehen** (im Bau, nicht hier): Die Update-Anweisung trägt vier
  Felder mehr und ist auf zwei Anweisungen gewachsen. Beides ist die richtige Folge; die
  Zusicherungen prüfen jetzt, dass **beide** Anweisungen auf die eigene Zeile eingeschränkt sind.

---

## Not Verified In This Run

- [!] **Der Fremdwährungsweg durch einen echten Browser** — die wichtigste Lücke. Radix füllt das
  versteckte native Auswahlfeld erst clientseitig; serverseitig steht dort nichts. Für **Euro** ist
  der Weg durch PROJ-2s E2E-Journey 1 gedeckt, für eine **ausgewählte Fremdwährung** nicht. Der
  Anwendungscode fängt eine fehlende Angabe als Euro ab — ein still nach Euro gekippter Dollar-Beleg
  wäre ein ernster Fehler. **Gehört als Erstes in `/e2e-tests`.**
- [x] **Erledigt von `/e2e-tests` (01.09.2026): der Fremdwährungsweg im echten Browser.** Die Lücke ist geschlossen — und sie hat **BUG-1 und BUG-2** zutage gefördert. Die frühere Formulierung dieses Punkts lautete:
- [!] **AC-6 und AC-11 waren am Code belegt, nicht an der laufenden Oberfläche** — dass die Währung
  nach dem Erfassen stehen bleibt und der Änderungsdialog sie vorbelegt zeigt, ist im Quelltext
  eindeutig (`setCurrency` kommt im Rücksetz-Effekt nicht vor; der Dialog liest `expense.currency`),
  aber beides ist Browserzustand.
- [!] **Wie die Zeilen aussehen** — die Betragsspalte wurde von `w-32` auf `w-56` verbreitert, damit
  Kurs und Kursdatum nicht umbrechen. Markup geprüft, Bild nicht.
- [!] **Darstellung auf 375 / 768 / 1440 px** — kein Viewport in `/qa`. Die Erfassungszeile hat eine
  sechste Spalte bekommen, der Änderungsdialog eine dritte; gerade dort ist das relevant.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Drosselung gewöhnlicher Endpunkte** — bewusst nicht implementiert (TD-22 in PROJ-2).
- [!] **Brute Force** — PROJ-3 hat keinen Zugangsdaten-Pfad.
- [!] **Ein vollständiger Neuaufbau der Datenbank** (`supabase db reset`) — nicht ausgeführt, weil er
  das Tor-Geheimnis von PROJ-1 löschen würde, das ohne den Klartext aus `.env.local` nicht
  wiederherstellbar ist. Die neue Migration ist als Einzelschritt sauber eingespielt.
- [!] **Das Verhalten des Kursdienstes über die Zeit** — Ausfallhäufigkeit und etwaige Aufrufgrenzen
  von frankfurter.dev sagt eine Momentaufnahme nicht. AC-5 fängt einen Ausfall sauber ab.

---

## Bugs

### BUG-1: Der Änderungsdialog belegt den Betrag mit dem EURO-Betrag vor — Speichern verfälscht die Ausgabe

- **Severity:** High · **Status:** offen · **Betrifft:** PROJ-2 AC-20 (Dialog öffnet mit dem gespeicherten Stand) · gefunden von `/e2e-tests`
- **Was passiert:** Bei einer Ausgabe über **1.250,00 USD** zeigt das Betragsfeld im Änderungsdialog
  **1078,24** — den umgerechneten Euro-Betrag. Wer dort irgendetwas speichert, und sei es nur eine
  Notizkorrektur, schreibt **1.078,24 USD** als Originalbetrag zurück; der Euro-Betrag schrumpft
  damit auf rund 930,25 €. **Stille Verfälschung der eigenen Aufzeichnungen durch eine ganz normale
  Handlung** — es erscheint keine Meldung und nichts sieht falsch aus.
- **Reproduktion:** Ausgabe über 1.250,00 USD erfassen → „Ändern" → das Feld zeigt 1078,24.
- **Ursache:** `src/components/expenses/edit-expense-dialog.tsx:111`. Beim Öffnen setzt
  `onOpenChange` den Stand zurück — und liest dabei `expense.amount_cents` statt
  `expense.amount_original`. Dieselbe Funktion setzt auch die **Währung nicht** zurück.
- **Warum es durch zwei Prüfungen gerutscht ist, offen gesagt:** Der `/build`-Lauf hat genau diesen
  Fehler an der **Initialisierung** (Zeile 68) behoben und im Bericht als erledigt vermerkt — die
  **zweite** Stelle wurde übersehen. Dieser QA-Bericht hat Zeile 68 dann als Beleg zitiert und die
  Zeile 111 nicht gesucht. Erst der Browser hat es gezeigt: Ohne Klick auf „Ändern" ist der Fehler
  nicht sichtbar, und `/qa` hat keinen Browser.
- **Fix-Richtung:** aus `expense.amount_original` vorbelegen und `setCurrency(expense.currency)`
  ergänzen. Probeweise angewandt — danach liefen alle drei Journeys grün.

### BUG-2: Nach dem Speichern verlieren Währung **und** Kategorie ihren Wert

- **Severity:** High · **Status:** offen · **Betrifft:** PROJ-3 AC-6 **und PROJ-2 AC-3** · gefunden von `/e2e-tests`
- **Was passiert:** Unmittelbar vor dem Absenden steht das Währungsfeld auf `USD`, unmittelbar danach
  wieder auf `EUR`. Dasselbe trifft die **Kategorie**, die auf „Wählen" zurückfällt. Betrag und Notiz
  werden geleert (richtig), das **Datum bleibt** (richtig) — es sind genau die beiden Auswahlfelder,
  die ihren Wert verlieren.
- **Warum das mehr ist als eine Unbequemlichkeit:** Wer einen Stapel Dollar-Belege nachträgt, tippt
  den zweiten Betrag ein und speichert — und erfasst ihn **in Euro zum Nennwert**. Aus 89,99 USD
  werden 89,99 €. Es erscheint keine Meldung, die Zeile sieht plausibel aus, und die Monatssumme ist
  still falsch. Genau dagegen wurde AC-6 geschrieben.
- **Reproduktion:** `/` öffnen, Betrag eintragen, Währung auf USD stellen, Kategorie wählen, Datum
  setzen, „Erfassen" → nach dem Speichern steht die Währung auf EUR und die Kategorie auf „Wählen".
- **Vorbestehend, nicht von PROJ-3 verursacht.** Die Kategorie verhält sich seit PROJ-2 so und
  verletzt dort **AC-3** („Kategorie und Datum stehen unverändert"). PROJ-3 erbt das Verhalten für
  die Währung, wo die Folge schwerer wiegt.
- **Warum es nie auffiel:** PROJ-2s QA führt AC-3 als
  „**[!] NICHT GEPRÜFT: reine Browser-Interaktion**", und PROJ-2s E2E-Journey 1 prüft unter der
  Überschrift „AC-3" zwar Betrag, Notiz, **Datum** und Fokus — **die Kategorie aber nicht**
  (`tests/PROJ-2-expenses-monthly-overview.spec.ts:79-84`). Die eine Zusicherung, die gefehlt hat,
  ist genau die, die den Fehler gezeigt hätte.
- **Verdacht zur Ursache** (für `/build`, nicht abschließend geprüft): Betroffen sind ausschließlich
  die beiden Radix-`Select`-Felder, nicht die einfachen Eingabefelder. Das deutet auf das
  Zurücksetzen des Formulars nach einer Server Action und das versteckte native Auswahlfeld, das
  Radix mitführt.

### BUG-3: Bei nicht erreichbarer Datenbank hängt die Erfassung 50 Sekunden und endet mit HTTP 500

- **Severity:** Medium · **Status:** offen · **Betrifft:** PROJ-3 EC-9, und dahinter PROJ-2 EC-4
- _(war BUG-1 im ersten Durchlauf; umnummeriert, weil `/e2e-tests` zwei schwerere Befunde ergänzt hat)_
- **Was passiert:** Wird die Datenbank angehalten, antwortet eine Erfassung nach **50,4 Sekunden**
  mit **HTTP 500** und einem 21 Byte langen Rumpf. Es erscheint **keine** verständliche Meldung. EC-9
  verlangt aber ausdrücklich, dass PROJ-2s EC-4 weiter gilt („dann erscheint eine verständliche
  Meldung und die eingegebenen Werte bleiben im Formular stehen").
- **Reproduktion:** `docker pause supabase_db_praxisprojekt-ai-engineering`, dann eine Ausgabe
  erfassen → nach ~50 s HTTP 500. Danach `docker unpause`.
- **Nicht von PROJ-3 verursacht.** Gegengeprüft: Eine **Euro**-Erfassung, die den Kursdienst gar
  nicht aufruft, verhält sich **identisch** (HTTP 500 nach 50,4 s), und schon das bloße Laden der
  Seite braucht 50,4 s. Die Ursache liegt vor dem Kurs: `requireUser()` fragt den Auth-Server, und
  auf diesem Weg gibt es **keine Frist** — `grep` nach `AbortSignal` in `lib/auth.ts`,
  `lib/supabase/server.ts` und `lib/actions/expenses.ts` findet nichts.
- **Warum es erst jetzt auffällt:** PROJ-2s QA-Bericht führt EC-4 ausdrücklich als
  „**[!] NICHT GEPRÜFT zur Laufzeit**: der echte Ausfall. Die Datenbank dafür anzuhalten hätte den
  lokalen Stack der Nutzerin gestört". Geprüft war nur der Fehler**zweig** mit einer gestellten
  Datenbankantwort. Dieser Lauf hat den Ausfall wirklich herbeigeführt.
- **Warum Medium und nicht High:** Es tritt nur ein, wenn die Datenbank ohnehin steht — dann ist die
  App so oder so nicht benutzbar. Es gehen keine Daten verloren, keine Zeile entsteht, und es ist
  keine Sicherheitslücke. Was fehlt, ist der **würdige Ausfall**, den der Vertrag zusagt.
- **Warum nicht Low:** 50 Sekunden sind mehr als eine Unschönheit. Hinter einem üblichen
  vorgelagerten Server mit 30- bis 60-Sekunden-Frist sieht die Person einen Gateway-Fehler statt
  irgendeiner Meldung — genau die Überlegung, aus der PROJ-1 seinen Toren eine 2-Sekunden-Frist
  gegeben hat (dort TD-34, nach demselben Befund mit 60 Sekunden).
- **Wohin es gehört:** Die Ursache liegt in PROJ-1/PROJ-2-Code, nicht in PROJ-3. Sauber wäre
  `/refine PROJ-2` (EC-4 präzisieren: eine Frist auf die Datenbank- und Auth-Aufrufe) und danach
  `/build`. PROJ-3 allein deswegen aufzuhalten wäre widersprüchlich — PROJ-2 steht mit demselben
  Verhalten bereits auf *Approved*.

### BUG-4: Der zugängliche Name der Währungsoptionen läuft zusammen

- **Severity:** Low · **Status:** offen · **Betrifft:** AC-1 (Zugänglichkeit) · gefunden von `/e2e-tests`
- **Was passiert:** Eine Option der Währungsauswahl heißt maschinell **„USDUS-Dollar"** — Code und
  Anzeigename stehen ohne Trennzeichen nebeneinander. Optisch trennt sie ein Rand, im Textinhalt
  fehlt jedes Leerzeichen. Ein Screenreader liest ein Wortmonster vor.
- **Evidenz:** im Browser ausgelesen — `EUREuro`, `USDUS-Dollar`, `CHFSchweizer Franken`, …
- **Fix-Richtung:** ein echtes Leerzeichen zwischen die beiden Spannen, oder ein `aria-label` an der
  Option. Der E2E-Test ist bewusst so geschrieben, dass er **vor und nach** der Behebung trifft
  (Präfix statt Wortgrenze) — er schreibt den Fehler nicht fest.

---

## Summary

- **Acceptance Criteria:** **18 von 19 erfüllt** — AC-6 von `/e2e-tests` widerlegt (BUG-2)
- **Edge Cases:** **8 von 9 erfüllt** — EC-9 offen als BUG-3
- **Bugs:** 0 Critical · **2 High** (BUG-1, BUG-2 — beide von `/e2e-tests` gefunden) · **1 Medium** (BUG-3, vorbestehend) · **1 Low** (BUG-4)
- **Security:** **9 Prüfungen verifiziert, 2 NOT VERIFIED**, keine negativ. Die neue Angriffsfläche
  des Features — ein Eingabefeld, das eine ausgehende Adresse bildet — ist mit neun Nutzlasten
  geprüft und geschlossen
- **Tests:** 214 Unit-/Integrationstests grün (davon 5 in diesem Lauf ergänzt, rot nachgewiesen) ·
  18 von 18 E2E grün als Regression · Lint, Build und TypeScript sauber
- **Production Ready:** **NEIN.** Zwei **High**-Befunde, beide von `/e2e-tests` gefunden, beide mit
  derselben Folge: **still falsche Zahlen in den Aufzeichnungen der Person.** BUG-1 verfälscht eine
  Ausgabe beim bloßen Öffnen und Speichern des Änderungsdialogs; BUG-2 lässt einen Fremdwährungsbeleg
  als Euro-Betrag zum Nennwert im Monat landen. In beiden Fällen erscheint keine Meldung und nichts
  sieht falsch aus — genau die Klasse Fehler, gegen die ein Ausgaben-Tracker existiert.

**Was das über den ersten Durchlauf sagt.** Dieser Bericht hat AC-6 als erfüllt geführt, mit einer
Begründung aus dem Quelltext, die für sich genommen richtig war. Sie hat trotzdem das Falsche
bewiesen: dass der Rücksetz-Effekt die Währung nicht anfasst — nicht, dass die Währung stehen bleibt.
Und er hat für den Änderungsdialog die Zeile 68 zitiert, ohne nach einer zweiten Stelle zu suchen.
**Beide Male hätte nur ein Browser die Wahrheit gesagt**, und beide Male stand im Bericht, dass genau
das fehlt. Die Lehre ist nicht „mehr lesen", sondern: **Wo ein Kriterium von Browserzustand handelt,
ist Code-Lektüre kein Beleg, sondern eine Vermutung** — und gehört als `[!]` markiert, nicht als `[x]`.

**Was trotzdem steht:** 18 von 19 AC und 8 von 9 EC sind erfüllt, davon die schwierigen Teile gegen
den echten Kursdienst — das Einfrieren, die Wochenendregel, die Nachrechenbarkeit, die Summen, der
Export, die neun SSRF-Nutzlasten. Der Kern des Features trägt. Was nicht trägt, sind zwei Stellen im
Browserzustand der Oberfläche.
