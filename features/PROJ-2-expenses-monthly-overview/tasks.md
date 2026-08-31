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

## Parallelization

- **Ebenen sind Barrieren.** Eine Ebene beginnt erst, wenn die vorige vollständig integriert und gegen
  ihre AC-IDs geprüft ist. So bleibt der Datenvertrag vor der Oberfläche: Schema (L1) → Regeln und
  Zugriff (L2) → Schreibweg (L3) → Bausteine (L4) → Zusammenbau (L5).
- **`[P]` verlangt disjunkte Dateien.** Keine zwei `[P]`-Aufgaben einer Ebene nennen denselben Pfad unter
  `files:`. Geprüft: die vier Aufgaben jeder Ebene schreiben in paarweise verschiedene Dateien.
- **Innerhalb einer Ebene importiert keine Aufgabe eine andere.** Deshalb liegt `MonthPanel` in Ebene 5
  und nicht bei den Bausteinen — es steckt Composer, Übersicht und Liste zusammen und wäre in Ebene 4
  eine Parallelaufgabe, die auf drei Geschwister wartet.
- **Grobkörnig, nicht kleinteilig.** 16 Aufgaben, jede ein sinnvoller Prüfpunkt.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit eigenem
  Arbeitsbaum; danach integriert der Hauptagent, prüft gegen die AC-IDs der Ebene und setzt die Häkchen
  hier. Subagenten erklären sich nie selbst für fertig — es gibt genau einen Ort, an dem geprüft wird.

## Abdeckung

Alle **30 Acceptance Criteria** und alle **11 Edge Cases** sind mindestens einer Aufgabe zugeordnet:

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
