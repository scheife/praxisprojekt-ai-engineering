# PROJ-3 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Der geordnete, nachvollziehbare Bauplan — die
> Brücke zwischen Vertrag (WAS) und Bau (WIE).
> `[P]` = parallelisierbar: die Dateien der Aufgabe sind disjunkt von jeder anderen `[P]`-Aufgabe
> derselben Ebene, `/build` kann sie an einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Innerhalb einer Ebene läuft parallel, was
> `[P]` trägt. Jede Aufgabe nennt die AC-IDs aus `spec.md`, die sie erfüllt — das ist die Kette
> AC → Task → Test.
> Owner: `/tasks` legt diese Datei an; `/build` hakt ab.
> Kein Statusfeld hier — der Fortschritt sind die Haken unten, der Status des Features lebt
> ausschließlich in `features/INDEX.md`.

**Es gibt in diesem Feature keine `[user]`-Aufgabe.** `design.md` → *Settings the user makes* hält
ausdrücklich „Keine" fest: Der Kursdienst braucht weder Konto noch Schlüssel, und PROJ-3 fügt der
Liste aus PROJ-1 (`GATE_SECRET`, `TRUSTED_PROXY_HOPS`) keine Umgebungsvariable hinzu. Nach zwei
solchen Aufgaben in PROJ-1 ist das erwähnenswert, nicht selbstverständlich.

---

## Ebene 1 — Fundament

<!-- Vier Bausteine ohne Abhängigkeit untereinander: keiner importiert einen der anderen. Deshalb
     alle vier [P]. Die Migration liegt hier, weil jede spätere Ebene den Datenvertrag braucht. -->

- [x] **T1** `[P]`  Migration: `expenses` bekommt `currency` (Text, 3 Zeichen, Vorgabe `EUR`), `amount_original` (Ganzzahl, 1 bis 999.999.999), `rate_per_eur` (Dezimal 18/8) und `rate_date` (Datum). Dazu **drei** Prüfregeln: Währung aus den 30 bekannten Codes · Kurs größer 0 · und die **spaltenübergreifende** Regel, die `EUR ⇒ kein Kurs, kein Kursdatum, amount_original = amount_cents` und `Fremdwährung ⇒ Kurs UND Kursdatum gesetzt` erzwingt. Bestandszeilen werden auf `EUR` gesetzt, `amount_original` aus `amount_cents` befüllt  · files: `supabase/migrations/20260831140000_expenses_currency.sql`  · → AC-3, AC-16, AC-17, EC-8
- [x] **T2** `[P]`  Die Währungsliste im Code: 30 ISO-Codes mit deutschen Namen, Reihenfolge **EUR, USD, CHF, GBP**, dann die übrigen 26 alphabetisch nach Code; dazu Typ und Prüffunktion. Muster und Begründung wie bei den Kategorien in PROJ-2 (Schlüssel in den Daten, Anzeigename im Code) — die Liste wird **nicht** vom Dienst geholt, sonst hinge auch die Euro-Erfassung an dessen Verfügbarkeit (design.md, TD-7)  · files: `src/lib/expenses/currencies.ts`  · → AC-1
- [x] **T3** `[P]`  Kurs-Abruf **und** Umrechnung: Abruf gegen `https://api.frankfurter.dev/v1` (die feste Adresse, Weiterleitungen werden nicht verfolgt — TD-1), Richtung `1 EUR = X Fremdwährung`, **5 Sekunden** Frist, das vom Dienst gelieferte Kursdatum wird übernommen. **Zwei unterscheidbare Fehlerklassen** (HTTP 404 bzw. fehlende Währung = dauerhaft · Netzwerk, Zeitüberschreitung, 5xx, unlesbar, Kurs ≤ 0 = vorübergehend). Zwischenspeicher **nur für abgeschlossene Tage**, der laufende Tag ausdrücklich nicht (TD-11). Umrechnung durch Division, kaufmännisch auf ganze Cent, Ergebnis unter 0,01 € gilt als Ablehnung statt als Null  · files: `src/lib/expenses/rate.ts`  · → AC-3, AC-4, AC-5, AC-8, EC-2, EC-3, EC-4, EC-5, EC-6
- [x] **T4** `[P]`  Formatierung für Fremdwährung: Betrag mit Code (`1.250,00 USD`) und Kurs in Leserichtung (`1 € = 1,1643 USD`). Alles über `Intl`, an derselben Stelle wie die Euro-Formatierung aus PROJ-2 — nichts von Hand  · files: `src/lib/expenses/format.ts`  · → AC-7, AC-8

## Ebene 2 — Regeln, Lesen, Formularzustand

<!-- T5 importiert die Währungsliste aus T2, liegt deshalb eine Ebene dahinter. T6 und T7 kommen ohne
     neue Importe aus, könnten also auch in Ebene 1 stehen — sie liegen hier, weil die Actions in
     Ebene 3 alle drei zusammenziehen und eine Schranke davor die Reihenfolge sichert. -->

- [x] **T5** `[P]`  Eingabeprüfung erweitern: Währung muss aus der Liste stammen; die Betragsgrenzen aus PROJ-2 (größer 0, höchstens 9.999.999,99) gelten jetzt auf den **Originalbetrag**. Die zweite Grenze — auf den umgerechneten Euro-Wert — gehört in die Action (T8), weil sie den Kurs braucht  · files: `src/lib/validation/expense.ts`  · → AC-17
- [x] **T6** `[P]`  Abfragen und Typ `Expense` um die vier Felder erweitern, in allen lesenden Wegen (Monatsliste, Gesamtliste für den Export). Die Summen lesen unverändert `amount_cents` — genau das ist der Zweck des Einfrierens, und es ist der Grund, warum an der Monatsrechnung von PROJ-2 nichts zu ändern ist  · files: `src/lib/expenses/queries.ts`  · → AC-7, AC-9, AC-10, AC-19
- [x] **T7** `[P]`  Formularzustand: Feldname `currency` ergänzen, damit ein Währungsfehler am Feld landen kann und die Kursmeldungen als formularweite Zeile Platz haben  · files: `src/lib/expenses/form-state.ts`  · → AC-5

## Ebene 3 — Server Actions

<!-- Bewusst EINE Aufgabe und ohne [P]: Anlegen und Ändern liegen in derselben Datei und teilen die
     Logik. Sie zu trennen hieße, zwei parallele Agenten auf dieselbe Datei zu setzen — genau das,
     was die Disjunktheitsregel verhindert. Diese Ebene zieht aus vier Dateien der Ebenen 1 und 2
     zusammen. -->

- [x] **T8**  Anlegen und Ändern um Währung und Kurs erweitern. **Reihenfolge im Erfassungspfad: Anmeldung → Eingaberegeln → Kursabruf → Datenbank** (TD-13) — ein ungültiger Betrag löst damit keinen Aufruf des fremden Dienstes aus, und ein Kursproblem kann nie als Datenbankproblem erscheinen. Bei `EUR` **kein** Außenkontakt. Beim Ändern wird der Kurs **nur** neu geholt, wenn Währung oder Datum von der **gelesenen Zeile** abweichen (nicht von dem, was das Formular mitschickt — TD-10); nur der Betrag geändert heißt: bestehender Kurs, neu gerechneter Euro-Wert; nur Kategorie oder Notiz geändert heißt: gar kein Abruf. Umstellung auf `EUR` leert Kurs und Kursdatum. Alle vier Felder werden **in einer einzigen Schreiboperation** gesetzt. Grenzprüfung auf den umgerechneten Euro-Wert, mit einer Meldung, die den umgerechneten Wert nennt. Scheitert der Abruf, wird nichts geschrieben — beim Ändern bleibt die bestehende Zeile vollständig unverändert  · files: `src/lib/actions/expenses.ts`  · → AC-2, AC-3, AC-5, AC-10, AC-12, AC-13, AC-14, AC-15, AC-16, AC-18, EC-1, EC-7, EC-9

## Ebene 4 — Oberfläche und Export

<!-- Vier disjunkte Dateien. Der Export liegt hier statt in Ebene 2, weil er den Typ aus T6 und die
     Formatierung aus T4 braucht — und weil er von den drei Oberflächendateien unabhängig ist. -->

- [x] **T9** `[P]`  Erfassungszeile: Währungsfeld mit `EUR` vorbelegt und der Reihenfolge aus T2. Nach dem Erfassen bleibt die Währung stehen, während Betrag und Notiz geleert werden — wie Kategorie und Datum in PROJ-2 (AC-3 dort). Die beiden Kursmeldungen erscheinen als formularweite Zeile über den Feldern, mit dem Unterschied aus EC-4: „gibt es nicht" nennt keinen vorübergehenden Ausfall, und die Eingaben bleiben in jedem Fall stehen  · files: `src/components/expenses/expense-composer.tsx`  · → AC-1, AC-5, AC-6, EC-4
- [x] **T10** `[P]`  Liste: Fremdwährungszeilen bekommen eine **Beizeile** mit Originalbetrag, Kurs und Kursdatum, in gedämpfter Farbe wie die Notiz. Der Euro-Betrag bleibt die Hauptzahl. **Euro-Zeilen bleiben unverändert einzeilig** — das ist die Zusicherung aus EC-8, nicht nur eine Gestaltungsfrage  · files: `src/components/expenses/expense-list.tsx`  · → AC-7, AC-8, EC-8
- [x] **T11** `[P]`  Änderungsdialog: Währungsfeld, vorbelegt mit der gespeicherten Währung; die Kursmeldungen aus T9 gelten hier genauso, und ein gescheiterter Neuabruf lässt den Dialog mit unveränderten Werten stehen  · files: `src/components/expenses/edit-expense-dialog.tsx`  · → AC-11, AC-15
- [x] **T12** `[P]`  CSV-Export: vier Spalten **hinten** anhängen (`Währung`, `Betrag (Original)`, `Kurs (1 EUR =)`, `Kursdatum`), damit Reihenfolge und Bedeutung der bestehenden erhalten bleiben. Bei Euro-Ausgaben bleiben Kurs und Kursdatum **leer**, nicht `1,0000` — ein Kurs, den es nie gab, wäre eine Behauptung. Alle Regeln aus PROJ-2 gelten unverändert (Semikolon, BOM, CRLF, RFC-4180, Formelschutz)  · files: `src/lib/expenses/csv.ts`  · → AC-19

## Ebene 5 — Tests

<!-- Drei disjunkte Sätze. Sie liegen hinter dem Code, weil sie ihn prüfen — nicht, weil er ohne sie
     fertig wäre. Jeder Test muss nachweislich rot werden können, bevor er zählt. -->

- [x] **T13** `[P]`  Tests für Abruf und Umrechnung: beide Fehlerklassen einzeln (404 gegen Netzwerkfehler), dass die Frist eine **echte** Frist ist, dass ein Kurs ≤ 0 als Störung und nicht als Kurs gilt, dass das **gelieferte** Kursdatum gespeichert wird und nicht das angefragte, dass der laufende Tag **nicht** zwischengespeichert wird, und die Rundung samt Nie-auf-null-Regel  · files: `src/lib/expenses/rate.test.ts`  · → AC-4, AC-8, EC-2, EC-3, EC-4, EC-5, EC-6
- [x] **T14** `[P]`  Tests für Prüfregeln und Formatierung: unbekannte Währung wird abgelehnt, die Grenzen greifen auf den Originalbetrag, und der Kurs wird in Leserichtung `1 € = X` ausgegeben  · files: `src/lib/validation/expense.test.ts`, `src/lib/expenses/format.test.ts`  · → AC-8, AC-17
- [x] **T15** `[P]`  Tests für den Export: eine Euro- und eine Fremdwährungsausgabe in derselben Datei, Kurs-Spalten bei Euro leer, bestehende Spalten unverändert an ihrer Stelle  · files: `src/lib/expenses/csv.test.ts`  · → AC-19
- [x] **T16** `[P]`  Tests für die Verzweigung beim Ändern — **im Plan übersehen, beim Bau nachgetragen** (siehe Notiz unten): Währung oder Datum geändert ⇒ Kurs wird neu geholt; nur Betrag geändert ⇒ bestehender Kurs bleibt, Euro-Wert neu gerechnet; nur Kategorie oder Notiz ⇒ kein Abruf; Umstellung auf EUR ⇒ Kurs und Kursdatum werden geleert; gescheiterter Abruf ⇒ es wird nicht geschrieben  · files: `src/lib/actions/expenses.test.ts`  · → AC-12, AC-13, AC-14, AC-15, AC-16

### Ebene 6 — Behebungen aus `/e2e-tests` (01.09.2026)

<!-- Keine neuen Bauteile, sondern drei Fehler, die erst ein echter Browser gezeigt hat. Die
     Ursache von T18 sitzt in PROJ-2 und wird dort mitbehoben. -->

- [x] **T17**  **BUG-1:** Der Änderungsdialog belegte den Betrag beim Öffnen aus `amount_cents` vor — bei 1.250,00 USD stand dort der Euro-Betrag 1078,24, und Speichern schrieb ihn als Dollar-Betrag zurück. Jetzt aus `amount_original`, und die Währung wird beim Öffnen mit zurückgesetzt. Die Initialisierung war beim Bau schon korrigiert worden, diese **zweite** Stelle war übersehen  · files: `src/components/expenses/edit-expense-dialog.tsx`  · → AC-11 (und PROJ-2 AC-20)
- [x] **T18**  **BUG-2:** Nach dem Speichern verloren Währung **und** Kategorie ihren Wert. Ursache: React 19 setzt ein Formular nach einer Server Action zurück, Radix hängt zu jedem `Select` ein unkontrolliertes natives Auswahlfeld ein und reicht dessen `change`-Ereignis in den React-Zustand zurück. Behoben, indem die Erfassungszeile über `onSubmit` + `startTransition` abschickt statt über `action=` — dann gibt es kein automatisches Zurücksetzen. Die Auswahl geht zusätzlich über eigene versteckte Felder ins Formular  · files: `src/components/expenses/expense-composer.tsx`  · → AC-6 (und PROJ-2 AC-3)
- [x] **T19**  **BUG-4:** Der zugängliche Name der Währungsoptionen lautete „USDUS-Dollar". Ein echtes Leerzeichen zwischen Code und Anzeigename  · files: `src/components/expenses/expense-composer.tsx`, `src/components/expenses/edit-expense-dialog.tsx`  · → AC-1
- [x] **T20**  Die fehlende Zusicherung nachtragen, die den Fehler hätte zeigen müssen: PROJ-2s Journey 1 prüft unter „AC-3" jetzt auch die **Kategorie**  · files: `tests/PROJ-2-expenses-monthly-overview.spec.ts`  · → PROJ-2 AC-3

### Ebene 7 — Behebung aus `/qa`, Lauf 2 (01.09.2026)

<!-- Kein neuer Bauteil, sondern die Rücknahme von T18: dessen Behebung hatte eine harte
     Zusicherung des Projekts gebrochen. T22 ist ein Fund aus derselben Messung. -->

- [x] **T21**  **BUG-5:** Die Erfassungszeile wurde ohne `method` ausgeliefert und sendete ohne JavaScript nativ per **GET** — Betrag, Kategorie, Datum und Notiz in der Adresszeile. Ursache war T18: der Wechsel von `action=` auf `onSubmit`. Jetzt trägt ein `<form … hidden>` nur die versteckten Felder, die sichtbaren gehören über `form="…"` dazu und liegen außerhalb — so entsteht Radix' verstecktes natives Auswahlfeld gar nicht erst, und `action={formAction}` kann bleiben. `method="POST"` und die `$ACTION_*`-Felder stehen wieder im ausgelieferten Markup  · files: `src/components/expenses/expense-composer.tsx`  · → AC-6 (und `.claude/rules/security.md` → *Sensitive Data in URLs*)
- [x] **T22**  **Neuer Fund derselben Messung:** Im Änderungsdialog griff derselbe Mechanismus. Auf dem Erfolgsweg unsichtbar, weil der Dialog schließt — auf dem **Fehlerweg** sprang die gewählte Währung auf die gespeicherte zurück, während die Meldung noch von der gewählten sprach. Ein zweiter Klick auf „Speichern" hätte still eine andere Währung geschrieben. Dasselbe Muster angewandt  · files: `src/components/expenses/edit-expense-dialog.tsx`  · → AC-11, AC-15
- [x] **T23**  Die zwei fehlenden Zusicherungen nachtragen: dass die Erfassungszeile **als POST ausgeliefert** wird (am rohen HTML geprüft, nicht am hydrierten DOM — genau dort lag die Lücke), und dass der Änderungsdialog seine Auswahl behält, wenn das Speichern scheitert  · files: `tests/PROJ-3-foreign-currency-exchange-rate.spec.ts`  · → AC-11, AC-15

---

## Abdeckung

| AC / EC | Aufgaben |
|---|---|
| AC-1 | T2, T9 |
| AC-2 | T8 |
| AC-3 | T1, T3, T8 |
| AC-4 | T3, T13 |
| AC-5 | T3, T7, T8, T9 |
| AC-6 | T9, T21 |
| AC-7 | T4, T6, T10 |
| AC-8 | T3, T4, T10, T13, T14 |
| AC-9 | T6 |
| AC-10 | T6, T8 |
| AC-11 | T11, T22, T23 |
| AC-12 | T8 |
| AC-13 | T8 |
| AC-14 | T8 |
| AC-15 | T8, T11, T22, T23 |
| AC-16 | T1, T8 |
| AC-17 | T1, T5, T14 |
| AC-18 | T1, T8 |
| AC-19 | T6, T12, T15 |
| EC-1 | T8 |
| EC-2 | T3, T13 |
| EC-3 | T3, T13 |
| EC-4 | T3, T9, T13 |
| EC-5 | T3, T13 |
| EC-6 | T3, T13 |
| EC-7 | T8 |
| EC-8 | T1, T10 |
| EC-9 | T8 |

**Alle 19 AC und alle 9 EC sind abgedeckt.** Umgekehrt trägt jede Aufgabe mindestens eine AC-Referenz.

**Zwei Kriterien werden erfüllt, ohne dass etwas Neues gebaut wird**, und das ist Absicht:
**AC-9** (Summen ausschließlich in Euro) und **AC-10** (spätere Ansicht zeigt dasselbe) ergeben sich
daraus, dass die Monatsrechnung von PROJ-2 unverändert `amount_cents` liest und der Lesepfad keinen
Kursdienst kennt. T6 sorgt nur dafür, dass das so bleibt. Ein Kriterium ohne eigenen Mechanismus ist
hier ein gutes Zeichen — es heißt, das Einfrieren trägt.

---

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen
  ihre AC-IDs geprüft ist. Das hält den Datenvertrag vor der Oberfläche: Schema und Bausteine (E1) →
  Regeln und Lesen (E2) → Actions (E3) → Oberfläche (E4) → Tests (E5).
- **`[P]` verlangt disjunkte Dateien.** Geprüft: E1 vier disjunkte Sätze, E2 drei, E4 vier, E5 drei.
  Keine zwei `[P]`-Aufgaben derselben Ebene nennen denselben Pfad.
- **Zusätzlich wurde die Import-Richtung geprüft**, nicht nur die Schreibrichtung. Ein paralleler
  Agent darf keine Datei importieren müssen, die es in seiner Ebene noch nicht gibt — deshalb liegt
  die Eingabeprüfung (T5) hinter der Währungsliste (T2), und deshalb steht T8 allein: es zieht aus
  `rate.ts`, `currencies.ts`, `validation` und `queries` zusammen. Dieselbe Überlegung hat schon in
  PROJ-1 die Ebenen getrennt.
- **T8 ist bewusst nicht `[P]`** — es ist die Integration, nicht ein weiterer Baustein.
- **Grobkörnig, nicht kleinteilig:** 16 Aufgaben für 19 AC und 9 EC. Die Migration ist *eine*
  Aufgabe, nicht vier („Spalte hinzufügen", „Prüfregel", „Backfill" …).

---

## Nachtrag aus dem Bau (31.08.2026)

**T16 fehlte im ursprünglichen Plan.** Ebene 5 hatte Tests für die drei *neuen* Dateien vorgesehen,
aber nicht für `src/lib/actions/expenses.test.ts` — die Datei, die den von T8 geänderten Code prüft.
Aufgefallen ist es, als T8 den bestehenden PROJ-2-Test rot machte: Die Update-Anweisung trägt jetzt
vier Felder mehr, und sie ist auf **zwei** Anweisungen gewachsen (erst lesen, dann schreiben).

Beides war richtig und der Test musste nachziehen — aber die *neue* Verzweigungslogik (AC-12 bis
AC-16) hatte damit noch keine Aufgabe, die sie absichert. Genau die ist T16.

**Die Lehre für den nächsten Plan:** Eine Aufgabe, die eine bestehende Datei ändert, erbt deren
Tests. Ebene 5 darf nicht nur die neuen Testdateien auflisten, sondern muss jede bestehende
mitnehmen, deren Prüfgegenstand sich verändert hat.
