# PROJ-2 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Dies ist der geordnete, nachverfolgbare Bauplan —
> die Brücke zwischen dem Vertrag (WAS) und dem Bau (WIE).
> `[P]` = parallelisierbar: die Dateien der Aufgabe sind von jeder anderen `[P]`-Aufgabe derselben
> Ebene disjunkt, `/build` kann sie also in einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Barriere). Aufgaben **innerhalb** einer Ebene laufen
> parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt — das ist die
> Kette AC → Task → Test.
> Kein Statusfeld hier — die Häkchen unten sind der Fortschritt dieser Datei, der Status des Features
> lebt ausschließlich in `features/INDEX.md`.
> **Keine `[user]`-Aufgaben:** `design.md` → *Settings the user makes* sagt „Keine". PROJ-2 prüft keine
> Zugangsdaten, also gibt es hier keine Drosselung und kein CAPTCHA einzustellen (TD-22).

## Level 1 — Datenbank & reine Bausteine

<!-- Fundament: Schema und die Module ohne jede Abhängigkeit. Alle vier schreiben in verschiedene
     Dateien und importieren einander nicht. -->

- [x] T1 [P]  Migration `expenses`: Spalten aus `design.md` → Data Model, Prüfregeln (Betrag 1 bis
      999.999.999, Notiz höchstens 200 Zeichen, Kategorie aus den neun Schlüsseln, `spent_on` nicht vor
      2000-01-01), Eindeutigkeit `(user_id, client_token)`, Index `(user_id, spent_on ↓, created_at ↓)`,
      Fremdschlüssel auf `profiles.id` mit Löschweitergabe, RLS an mit vier Policies für
      `authenticated` und keinerlei Recht für `anon`  · files: supabase/migrations/20260831120000_expenses.sql
      · → AC-5, AC-9, AC-10, AC-24, AC-26, AC-29, AC-30, EC-1
- [x] T2 [P]  Kategorien-Modul: die neun stabilen Schlüssel mit ihren deutschen Anzeigenamen in der
      Reihenfolge aus `docs/data-model.md`, dazu Typ und Prüfhilfe — die einzige Quelle für Auswahlfeld,
      Liste, Übersicht, Export und Prüfregel  · files: src/lib/expenses/categories.ts  · → AC-8, AC-10, AC-14
- [x] T3 [P]  Monat und Zeitzone: „heute" als Datum in Europe/Vienna, erster und letzter Tag eines
      Monats, `?monat=YYYY-MM` auflösen — fehlend, unbekanntes Format oder `2026-13` ergeben den
      laufenden Monat ohne Weiterleitung  · files: src/lib/expenses/month.ts  · → AC-2, AC-17, AC-19, EC-6
- [x] T4 [P]  Darstellung: Betrag als `1.284,50 €` über `Intl.NumberFormat('de-AT')` mit geschütztem
      Leerzeichen und nachgestelltem Zeichen (nicht `style: 'currency'`), Datum `14.08.2026`, Monatsname
      `August 2026`  · files: src/lib/expenses/format.ts  · → AC-6, AC-13

## Level 2 — Regeln, Rechnung, Zugriff

<!-- Setzt auf dem Datenvertrag aus Ebene 1 auf. Vier disjunkte Dateien, keine gegenseitigen Importe:
     T5 und T6 lesen aus categories.ts, T8 aus categories.ts und format.ts — alle aus Ebene 1. -->

- [x] T5 [P]  Eingabeschema für Erfassen **und** Ändern (AC-21, ein Schema, keine zweite Quelle):
      Betrag aus Text lesen mit der Regel für Komma und Punkt (das rechteste der beiden trennt die
      Dezimalen), Betrag > 0 und höchstens 9.999.999,99 €, höchstens zwei Nachkommastellen, Datum nicht
      in der Zukunft und nicht vor dem 01.01.2000, Kategorie Pflicht und aus der Liste, Notiz höchstens
      200 Zeichen und optional — jede Regel mit ihrer deutschsprachigen Meldung aus `design.md`
      · files: src/lib/validation/expense.ts  · → AC-5, AC-6, AC-7, AC-8, AC-9, AC-21, AC-25, AC-29, AC-30
- [x] T6 [P]  Summenmodul als reine Funktion ohne Datenbank und ohne Oberfläche: Gesamtsumme in Cent,
      Kategoriesummen absteigend (bei Gleichstand alphabetisch nach Anzeigename), Kategorien ohne Betrag
      fallen raus, Prozentanteile kaufmännisch gerundet und nur für die Anzeige
      · files: src/lib/expenses/summary.ts  · → AC-13, AC-14, EC-7
- [x] T7 [P]  Abfragen über den vorhandenen Server-Client: alle eigenen Zeilen eines Monats, absteigend
      nach `spent_on` und bei gleichem Datum nach `created_at`; dazu der älteste eigene Monat für die
      Rückwärtsgrenze. Beide tragen die Zugehörigkeitsbedingung im Anwendungscode, zusätzlich zu RLS
      · files: src/lib/expenses/queries.ts  · → AC-11, AC-18, AC-24, AC-25, EC-8, EC-9
- [x] T8 [P]  CSV-Erzeuger: Kopfblock mit E-Mail und Registrierungsdatum, Spalten Datum · Kategorie ·
      Betrag (EUR) · Notiz · Erfasst am; Semikolon als Trennzeichen, BOM am Anfang, CRLF, Feldbegrenzung
      nach RFC 4180 mit verdoppelten Anführungszeichen, Betrag ohne Tausenderpunkt und ohne
      Währungszeichen, Kategorie als deutscher Anzeigename, Erfassungszeitpunkt in Europe/Vienna. Ohne
      Ausgaben bleibt der Kopfblock stehen  · files: src/lib/expenses/csv.ts  · → AC-27, EC-10

## Level 3 — Server Actions & Export-Route

<!-- Der Schreibweg. Beide Aufgaben schreiben verschiedene Dateien und hängen nur an Ebene 1 und 2. -->

- [x] T9 [P]  Server Actions Anlegen, Ändern, Löschen: jede prüft zuerst `requireUser()` aus PROJ-1, dann
      das Schema aus T5, dann die Zugehörigkeit — die Nutzer-ID kommt immer aus der Sitzung, nie aus dem
      Formular. Anlegen trägt die Vorgangskennung und wertet eine Verletzung der Eindeutigkeit als „schon
      erledigt" statt als Fehler (EC-1). Ändern schreibt alle vier Felder in **einer** Anweisung, nie als
      Upsert, und zählt die betroffenen Zeilen; null Zeilen heißt „gibt es nicht mehr" — dieselbe Meldung
      wie für eine fremde Ausgabe (EC-2). Alle drei geben den Monat nach dem Vorgang zurück und rufen
      `refresh()` auf  · files: src/lib/actions/expenses.ts
      · → AC-1, AC-4, AC-16, AC-20, AC-23, AC-24, AC-25, EC-1, EC-2, EC-3, EC-4, EC-5, EC-11
- [x] T10 [P]  Route Handler `GET /konto/export`: `requireUser()`, E-Mail und Registrierungsdatum lesen,
      alle eigenen Ausgaben in der Reihenfolge der Liste holen, Datei bei jedem Abruf neu erzeugen und
      nirgends ablegen. Antwortköpfe `text/csv; charset=utf-8`, Anhang mit Dateinamen
      `auslage-export-JJJJ-MM-TT.csv`, `Cache-Control: no-store`  · files: src/app/konto/export/route.ts
      · → AC-27, EC-10

## Level 4 — Oberflächen-Bausteine

<!-- Vier Bausteine, die einander nicht importieren — der Zusammenbau passiert erst in Ebene 5.
     Alle sprechen ausschließlich mit den Actions aus Ebene 3 und den Modulen aus Ebene 1 und 2. -->

- [x] T11 [P]  `AppHeader` mit Wortmarke, Konto-Link und dem Abmelde-Button aus PROJ-1 (dieselbe Server
      Action, nicht nachgebaut), dazu `MonthSwitcher`: die Pfeile sind echte Links auf `?monat=`, der
      Vorwärtspfeil ist im laufenden Monat inaktiv, der Rückwärtspfeil, wenn es davor keine eigene
      Ausgabe gibt. Beide bleiben sichtbar und tragen inaktiv eine Erklärung für Screenreader
      · files: src/components/shell/app-header.tsx, src/components/shell/month-switcher.tsx  · → AC-17, AC-18
- [x] T12 [P]  Erfassungszeile, dauerhaft sichtbar über der Liste: Betrag, Kategorie, Datum (natives
      Datumsfeld), Notiz und der Hinweis darunter, dass dort keine Namen Dritter und keine sensiblen
      Angaben stehen sollen. Datumsvorbelegung nach AC-2, nach dem Speichern Betrag und Notiz leeren,
      Kategorie und Datum stehen lassen (solange das Datum im angezeigten Monat liegt), Fokus zurück ins
      Betragsfeld und eine neue Vorgangskennung. Button während des Absendens gesperrt, Feldfehler am
      verursachenden Feld, formularweite Fehler als Zeile darüber, Werte bleiben nach einem Fehler stehen
      · files: src/components/expenses/expense-composer.tsx
      · → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-28, AC-29, AC-30, EC-1, EC-4
- [x] T13 [P]  Monatsübersicht: Gesamtsumme als einzige Zahl in `2xl` über der Liste, darunter je belegter
      Kategorie eine Zeile mit Name, Anteilsbalken, Summe und Prozent — der Balken in der Olive-Rampe nach
      Rang (`chart-1` bis `chart-5`, darunter `--muted-foreground`), kein Amber. Die Zeilen sind
      Schaltflächen mit gedrückt/nicht-gedrückt-Zustand für Screenreader; den Filterzustand bekommen sie
      von außen  · files: src/components/expenses/month-total.tsx, src/components/expenses/category-breakdown.tsx
      · → AC-13, AC-14, AC-15
- [x] T14 [P]  Liste mit Datum, Kategorie, Notiz und Betrag (rechtsbündig, Tabellenziffern), dazu der
      ausformulierte Leerzustand statt einer leeren Tabelle, der Änderungsdialog mit dem gespeicherten
      Stand und denselben Regeln wie beim Erfassen, und die Löschbestätigung, die Betrag, Kategorie und
      Datum der betroffenen Ausgabe nennt  · files: src/components/expenses/expense-list.tsx,
      src/components/expenses/edit-expense-dialog.tsx, src/components/expenses/delete-expense-dialog.tsx
      · → AC-11, AC-12, AC-20, AC-21, AC-22, AC-23, EC-2, EC-3, EC-11

## Level 5 — Zusammenbau

<!-- Erst hier werden die Bausteine aus Ebene 4 zusammengesteckt. Beide Aufgaben schreiben verschiedene
     Dateien: T15 die Monatsansicht, T16 die Kontoseite. -->

- [x] T15 [P]  `/` zusammensetzen: `requireUser()`, Monat aus der Adresse auflösen, die zwei Abfragen aus
      T7, Suspense-Grenze mit Skeleton in `--muted` an der Stelle von Kopf, Summe, Übersicht und drei
      Listenzeilen (bewusst keine `app/loading.tsx`, die auch für `/login` und `/signup` gälte). `MonthPanel`
      hält den Kategoriefilter im Browserzustand — ein zweiter Klick auf dieselbe Zeile hebt ihn auf,
      Gesamtsumme und Kategoriezeilen bleiben ungefiltert, ein Monatswechsel setzt ihn zurück. Toasts
      unten rechts für Monatswechsel und Löschen  · files: src/components/expenses/month-panel.tsx,
      src/components/expenses/month-view.tsx, src/components/expenses/month-view-skeleton.tsx, src/app/page.tsx
      · → AC-11, AC-12, AC-15, AC-16, AC-17, AC-19, EC-5
- [x] T16 [P]  `/konto`: den `AppHeader` aus T11 ergänzen (ohne Monatswechsler), die Karte „Deine Daten
      mitnehmen" mit Erklärsatz und Link-Button auf `/konto/export` zwischen Konto- und Löschkarte, und
      im Ladezustand eine Skeleton-Karte dafür. Zugriffsschutz und die beiden Karten von PROJ-1 bleiben
      unangetastet  · files: src/app/konto/page.tsx, src/app/konto/loading.tsx  · → AC-27

### Ebene 6 — Fundament der Frist (EC-4, EC-12)

<!-- Nachgetragen nach `/refine` und `/architecture` vom 01.09.2026. Die bestehenden T1–T16 bleiben
     unangetastet — sie sind der Bauplan dessen, was steht. Zwei neue Dateien ohne Bezug zueinander,
     deshalb beide [P]. Kein `[user]`-Task: `design.md` → Settings the user makes hält „Keine" fest,
     und daran ändert die Frist nichts. -->

- [x] T17 [P]  Ein eigenes Modul für die Frist: der `fetch`, der jede Anfrage nach **2 Sekunden**
      abbricht; die Client-Optionen, die die **eingebauten Wiederholversuche abschalten** (seit
      `supabase-js` 2.102.0 aktiv, installiert ist 2.112.4 — sonst wirkte die Frist je Versuch und die
      zugesagten 2 Sekunden wären ein Vielfaches, TD-28); dazu die Prüffunktion „war das eine **Antwort**
      oder ein **Nichterreichen**". Eigenes Modul und nicht `server.ts`, weil `proxy.ts` dieselbe Frist
      braucht, aber `next/headers` nicht mitziehen darf  · files: src/lib/supabase/deadline.ts
      · → EC-4
- [x] T18 [P]  Rahmen-Komponente `UnavailableNotice`: ein Satz, was gerade nicht geht, plus „Erneut
      versuchen". Kein automatischer Neuversuch — er belastet eine ohnehin überlastete Gegenstelle und
      verändert die Seite unter den Händen der Person. Gehört zum Rahmen, den PROJ-2 besitzt
      · files: src/components/shell/unavailable-notice.tsx  · → EC-4, EC-12

### Ebene 7 — Die drei Wartestellen

<!-- Alle drei importieren T17, keine schreibt in die Datei einer anderen. `auth.ts` importiert
     `server.ts`, ohne es anzufassen — die Import-Richtung ist geprüft, nicht nur die Schreibrichtung. -->

- [x] T19 [P]  Der Client für Seiten und Actions bekommt Frist und abgeschaltete Wiederholversuche aus
      T17  · files: src/lib/supabase/server.ts  · → EC-4
- [x] T20 [P]  Sitzungsprüfung mit **drei** Ausgängen statt zwei: „angemeldet", „nicht angemeldet" (der
      Auth-Server hat **geantwortet**) und „nicht feststellbar" (Frist, Netzwerkfehler, 5xx).
      Unterschieden an der **Art des Fehlers**, nicht am Fehlen der Person. Nur der zweite Fall leitet
      auf `/login` — der dritte nie  · files: src/lib/auth.ts  · → EC-12, EC-5
- [x] T21 [P]  Die Vorprüfung bekommt dieselbe Frist an ihrem eigenen Client und **lässt bei „nicht
      feststellbar" durch**, statt umzuleiten. Sie läuft vor jeder Anfrage; ohne das wäre der Zustand aus
      T18 nie erreichbar. Fail-open hier, fail-closed auf der Seite dahinter (TD-29)
      · files: src/proxy.ts  · → EC-12

### Ebene 8 — Die Aufrufer

<!-- Drei disjunkte Sätze. Sie liegen hinter Ebene 7, weil sie den dritten Ausgang aus T20 behandeln. -->

- [x] T22 [P]  Beide geschützten Seiten zeigen `UnavailableNotice` an der Stelle des Inhalts; Kopfzeile
      und Rahmen bleiben stehen, damit die App nicht abgestürzt wirkt  · files: src/app/page.tsx,
      src/app/konto/page.tsx  · → EC-4, EC-12
- [x] T23 [P]  Die Export-Route antwortet mit **HTTP 503** und kurzem deutschsprachigem Text — eine
      Route, die eine Datei liefert, kann keine Karte zeigen  · files: src/app/konto/export/route.ts
      · → EC-4
- [x] T24 [P]  Die Actions melden das Nichterreichen als **formularweite** Zeile; **alle Eingaben bleiben
      stehen** (EC-4). `account.ts` zieht mechanisch mit, weil `requireUser()` nicht mehr in jedem Fall
      umleitet — PROJ-1s Kriterien kehren sich dadurch nicht um  · files: src/lib/actions/expenses.ts,
      src/lib/actions/account.ts  · → EC-4

### Ebene 9 — Tests

<!-- Zwei disjunkte Sätze. Drei der vier Dateien sind neu: für `auth.ts` und `proxy.ts` gab es bisher
     keine Tests, obwohl beide auf jedem Weg durch die App liegen. -->

- [x] T25 [P]  Die Frist greift **wirklich** nach 2 Sekunden · die Wiederholversuche sind aus (sonst wäre
      die Frist ein Vielfaches — der Test, der TD-28 absichert) · „Antwort" wird von „Nichterreichen"
      unterschieden · die drei Ausgänge der Sitzungsprüfung, jeder einzeln  · files:
      src/lib/supabase/deadline.test.ts, src/lib/auth.test.ts  · → EC-4, EC-12
- [x] T26 [P]  Die Vorprüfung lässt bei „nicht feststellbar" durch, statt umzuleiten — und leitet bei
      „nicht angemeldet" weiterhin um · der Unerreichbar-Zweig der Actions, mit stehen bleibenden
      Eingaben  · files: src/proxy.test.ts, src/lib/actions/expenses.test.ts  · → EC-12, EC-4

### Ebene 10 — Behebung aus `/qa`, zweiter Durchlauf (01.09.2026)

<!-- Kein neuer Bauteil, sondern die Lücke, die der zweite QA-Lauf gezeigt hat: Die Behebung der
     Ebenen 6-9 hing vollständig an der Sitzungsprüfung und deckte den Lesepfad nicht ab. -->

- [x] T27  **BUG-4 (High):** Der Lesepfad bekommt denselben Ausgang wie die Sitzungsprüfung. Fällt **nur** der Datenzugriff aus, während der Auth-Server erreichbar bleibt, ist die Sitzung feststellbar und erst die Monatsabfrage scheitert — dort fing sie niemand, und die Person sah dauerhaft das Ladegerüst. `MonthView` fängt jetzt ein **Nichterreichen** ab und zeigt `UnavailableNotice`; **jeder andere Fehler fliegt weiter**, denn ihn als „gerade nicht erreichbar" auszugeben wäre dieselbe falsche Behauptung, gegen die EC-12 geschrieben wurde  · files: `src/components/expenses/month-view.tsx`, `src/components/expenses/month-view.test.tsx`  · → EC-4

### Ebene 11 — Die Gesamtgrenze aus EC-4 festhalten (01.09.2026)

<!-- Nach dem zweiten `/refine` und `/architecture`. Der Entwurf hält fest: Es wird **kein neuer
     Mechanismus** gebaut — die Anwendung erfüllt die präzisierte Fassung von EC-4 bereits
     (gemessen 2,12 s / 2,27 s / 4,07 s, alle unter 5 Sekunden). Was fehlt, ist eine Zusicherung,
     die es so hält. Zwei Aufgaben, disjunkte Dateien, deshalb beide [P]. -->

- [x] T28 [P]  **Die Ausfall-Zusicherung**, mit `@outage` markiert und über `grepInvert` aus dem Standardlauf **ausgeschlossen**, dazu ein eigenes Skript `npm run test:outage`. Sie hält **nur PostgREST** an — nicht die Datenbank, dann bleibt die Anmeldung prüfbar und der Eingriff kleiner —, misst das Laden von `/` **und** einen POST darauf, prüft beide gegen die **5-Sekunden-Grenze** und gibt in einem `finally` wieder frei. **Bewusst nicht im Alltagslauf:** Ein pausierter Container reißt bei `workers: 2` jeden gleichzeitig laufenden Test mit, und ein Test, der grundlos rot wird, wird abgeschaltet — dann ist er gar nicht da. Der Preis ist benannt: Wer `npm test` und `npm run test:e2e` grün sieht, hat die Gesamtgrenze **nicht** geprüft; das tut erst `/qa`  · files: `tests/outage.spec.ts`, `playwright.config.ts`, `package.json`  · → EC-4
- [x] T29 [P]  **Die strukturelle Zusicherung, die im Alltagslauf mitläuft:** Die beiden Abfragen der Monatsansicht laufen **parallel**, nicht nacheinander. Genau diese Eigenschaft spart eine Wartestation und trägt damit die Rechnung aus `design.md` → *Das Zeitbudget einer Anfrage*. Sie schlägt bei der häufigsten Art an, wie jemand versehentlich eine dritte Wartestation einbaut: die zweite Abfrage hinter die erste zu hängen. Geprüft wird, dass beide begonnen haben, bevor die erste fertig ist — nicht die Uhrzeit, sondern die Reihenfolge  · files: `src/components/expenses/month-view.test.tsx`  · → EC-4

**Nachtrag aus dem Bau (01.09.2026): `account.test.ts` fehlte in T26.** Ebene 9 hatte die
Testdateien aufgezählt, deren Prüfgegenstand sich ändert — `expenses.test.ts` war dabei,
`account.test.ts` nicht. Beide mocken aber `requireUser()`, und dessen Rückgabetyp hat sich
geändert. `expenses.test.ts` wurde davon rot (22 Tests) und fiel sofort auf; `account.test.ts`
blieb **grün**, weil `deleteAccount` den Rückgabewert vorher gar nicht las — sein Mock lieferte
danach still eine Form, die es in Wirklichkeit nicht mehr gibt. Berichtigt.

Das ist dieselbe Lehre wie bei PROJ-3s T16, eine Stufe schärfer: Eine Aufgabe, die einen
**Vertrag** ändert, erbt die Tests **jeder** Datei, die diesen Vertrag mockt — auch der, die
davon nicht rot wird. Ein grüner Test auf einem veralteten Mock ist gefährlicher als ein roter.

**Kein E2E-Test, und das ist eine Entscheidung.** Ihn zu schreiben hieße, die Datenbank mitten im Lauf
anzuhalten — dieselbe Instanz, gegen die die übrigen 28 E2E-Tests laufen. Das macht die Suite flockig
und stört den lokalen Stack. `/qa` hat den echten Ausfall schon einmal herbeigeführt (`docker pause`)
und ist die Stelle dafür. Die Frist wird hier von Unit-Tests belegt, der **echte** Ausfall von `/qa`.

## Parallelization

- **Ebenen sind Barrieren.** Eine Ebene beginnt erst, wenn die vorige vollständig integriert und gegen
  ihre AC-IDs geprüft ist. So bleibt der Datenvertrag vor der Oberfläche: Schema (L1) → Regeln und
  Zugriff (L2) → Schreibweg (L3) → Bausteine (L4) → Zusammenbau (L5).
- **`[P]` verlangt disjunkte Dateien.** Keine zwei `[P]`-Aufgaben einer Ebene nennen denselben Pfad unter
  `files:`. Geprüft: die vier Aufgaben jeder Ebene schreiben in paarweise verschiedene Dateien.
- **Innerhalb einer Ebene importiert keine Aufgabe eine andere.** Deshalb liegt `MonthPanel` in Ebene 5
  und nicht bei den Bausteinen — es steckt Composer, Übersicht und Liste zusammen und wäre in Ebene 4
  eine Parallelaufgabe, die auf drei Geschwister wartet.
- **Grobkörnig, nicht kleinteilig.** 29 Aufgaben, jede ein sinnvoller Prüfpunkt — 16 aus dem
  ursprünglichen Bau, 10 aus der Runde vom 01.09.2026 (Ebenen 6 bis 9).
- **Die Ebenen 6 bis 9 folgen derselben Ordnung:** gemeinsames Fundament (L6) → die Stellen, an denen
  gewartet wird (L7) → ihre Aufrufer (L8) → Tests (L9). Disjunktheit geprüft: L6 zwei, L7 drei, L8 drei,
  L9 zwei Sätze, paarweise verschiedene Pfade.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit eigenem
  Arbeitsbaum; danach integriert der Hauptagent, prüft gegen die AC-IDs der Ebene und setzt die Häkchen
  hier. Subagenten erklären sich nie selbst für fertig — es gibt genau einen Ort, an dem geprüft wird.

## Abdeckung

Alle **30 Acceptance Criteria** und alle **12 Edge Cases** sind mindestens einer Aufgabe zugeordnet:

| | Aufgaben |
|---|---|
| AC-1 | T9, T12 · AC-2 T3, T12 · AC-3 T12 · AC-4 T9, T12 · AC-5 T1, T5, T12 |
| AC-6 | T4, T5 · AC-7 T5 · AC-8 T2, T5 · AC-9 T1, T5 · AC-10 T1, T2, T5 |
| AC-11 | T7, T14, T15 · AC-12 T14, T15 · AC-13 T4, T6, T13 · AC-14 T2, T6, T13 · AC-15 T13, T15 |
| AC-16 | T9, T15 · AC-17 T3, T11, T15 · AC-18 T7, T11 · AC-19 T3, T15 · AC-20 T9, T14 |
| AC-21 | T5, T14 · AC-22 T14 · AC-23 T9, T14 · AC-24 T1, T7, T9 · AC-25 T5, T7, T9 |
| AC-26 | T1 · AC-27 T8, T10, T16 · AC-28 T12 · AC-29 T1, T5, T12 · AC-30 T1, T5, T12 |
| EC-1 | T1, T9, T12 · EC-2 T9, T14 · EC-3 T9, T14 · EC-4 T12 · EC-5 T9, T15 · EC-6 T3 |
| EC-7 | T6 · EC-8 T7 · EC-9 T7 · EC-10 T8, T10 · EC-11 T9, T14 |
| **EC-4** (neu gefasst) | T17, T19, T22, T23, T24, T25, T26, **T27**, **T28**, **T29** — ersetzt die alte Zuordnung „T12" |
| **EC-12** (neu) | T18, T20, T21, T22, T25, T26 |
