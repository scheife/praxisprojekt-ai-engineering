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
| **J3** Ändern und Löschen | AC-20, AC-21, AC-22, AC-23 · EC-11 | ❌ **rot auf beiden — BUG-5** |
| **J4** Die eigenen Daten als CSV mitnehmen | AC-27 · EC-10 (inkl. Regressionswache für BUG-1) | ✅ grün auf beiden |
| **J5** Niemand sieht fremde Zahlen | AC-24 | ✅ grün auf beiden |

**Jede Journey wurde rot nachgewiesen** — nacheinander, mit einem gezielten Bruch am Produkt, und
jedes Mal fiel genau der Schritt, um den es geht:

| Journey | Was gebrochen wurde | Was fiel |
|---|---|---|
| J1 | zweiter Klick hebt den Filter nicht mehr auf | `aria-pressed` und die wieder sichtbare Zeile |
| J2 | `resolveMonth` ignoriert die Adresse | die Ausgabe im Vormonat war nicht auffindbar |
| J3 | — | fällt derzeit von selbst, an einem echten Fehler (BUG-5) |
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

**Grenze der Testumgebung:** `supabase/config.toml` erlaubt lokal `sign_in_sign_ups = 30` je
5 Minuten und IP. Ein Suite-Lauf legt rund 20 Konten an und passt darunter; **zwei Läufe kurz
hintereinander nicht** — dann scheitert die Registrierung mit „Die Registrierung ist gerade nicht
möglich." Das ist die Auth-Drosselung von Supabase, nicht die der Anwendung und kein Produktfehler.

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
- [!] EC-4 — der echte Datenbankausfall (hätte den lokalen Stack angehalten)
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

### BUG-3: `/konto` zeigt zwei gleich benannte „Abmelden"-Schaltflächen
- **Severity:** ~~Low~~ → **Medium** (hochgestuft am 2026-08-31 durch `/e2e-tests`)
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
- **Severity:** Low
- **Betrifft:** keine AC — EC-4 deckt das **Schreiben** ab, für das Lesen sieht `design.md` → *Zustände je Seite* keinen Seitenfehler vor
- **Schritte zur Reproduktion:** Schlägt die Monatsabfrage fehl, wirft `queries.ts` weiter (`src/lib/expenses/queries.ts:40,61,76`), und es gibt weder `error.tsx` noch `global-error.tsx` in `src/app/`
- **Tatsächlich:** die Person sieht Next.js' eigene, englische Standardseite „This page couldn't load — A server error occurred." in einer sonst durchgehend deutschsprachigen Anwendung (im `/build`-Durchlauf einmal so beobachtet)
- **Priorität:** Nächste Runde — eine `error.tsx` mit einem deutschen Satz und einem „Neu laden"-Knopf schließt das

### BUG-5: Nach einer Änderung bleibt der Dialog dauerhaft auf „Moment …" stehen
- **Severity:** **High**
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
- **Der Lösch-Dialog ist nicht betroffen:** dort verschwindet die Zeile immer, die Komponente wird also stets ausgehängt
- **Priorität:** Vor dem Deploy beheben

---

## Zusammenfassung

- **Acceptance Criteria:** **30 von 30 geprüft** — 29 vollständig bestanden, 1 mit einem offenen Befund (AC-14 → BUG-2). AC-27 und EC-10 sind nach der Behebung von BUG-1 vollständig bestanden. Bei 8 Kriterien ist eine rein browserabhängige Teilzusicherung als `[!]` offen (oben einzeln benannt)
- **Edge Cases:** 11 von 11 geprüft, alle bestanden
- **Gefundene Bugs:** 5 (0 Critical, **1 High**, 2 Medium, 2 Low). BUG-1 (Medium) ist behoben und nachgeprüft. Offen: **BUG-5 (High)**, BUG-3 (Medium, hochgestuft), BUG-2 und BUG-4 (Low)
- **Sicherheit:** 9 Prüfungen belegt, 4 NICHT GEPRÜFT — Drosselung (bewusst nicht implementiert, TD-22), Brute Force und Kontoaufzählung (in diesem Feature gegenstandslos), CSRF (nur als Indiz belegt)
- **Regression:** PROJ-1 unverändert funktionsfähig; ein Low-Befund (BUG-3) aus der Header-Ergänzung
- **Neue Tests:** 18 — 15 im QA-Durchlauf (`src/lib/expenses/queries.test.ts`, `src/components/shell/month-switcher.test.tsx`) und 3 für die Behebung von BUG-1 (`src/lib/expenses/csv.test.ts`). Alle drei Dateien wurden **rot nachgewiesen**: ohne `.eq('user_id', …)`, mit dauerhaft aktivem Vorwärtspfeil bzw. ohne die Textmarkierung fallen genau die Tests, die es dafür gibt. Gesamtstand: **164 Tests, 14 Dateien, alle grün**
- **Production Ready:** **NEIN** — BUG-5 ist ein High-Bug (Stand 2026-08-31 nach `/e2e-tests`; der ursprüngliche QA-Durchlauf kam ohne Browser an diesen Fall nicht heran)
- **Empfehlung:** **BUG-5 über `/build` beheben, dann `/qa` und `/e2e-tests` erneut.** Danach BUG-3 über `/refine PROJ-1` entscheiden; BUG-2 und BUG-4 bleiben ohne Einfluss auf den Deploy

> Die browserabhängigen `[!]`-Punkte oben sind durch die fünf E2E-Journeys inzwischen zu großen
> Teilen geschlossen — offen bleiben Darstellung in weiteren Browsern und an weiteren
> Bildschirmbreiten sowie der echte Datenbankausfall (EC-4).
