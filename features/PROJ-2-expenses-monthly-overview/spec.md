# PROJ-2: Ausgaben & Monatsübersicht

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. A contract that is read-only during /build
     cannot carry a field that changes during /build. -->

## Dependencies

- **Erfordert PROJ-1 (Konto & Anmeldung)** — für die angemeldete Person, den Zugriffsschutz auf `/`,
  das RLS-Muster, das `expenses` von `profiles` übernimmt, und die Seite `/konto`, auf der der
  Datenexport (AC-27) seinen Platz bekommt.
- **PROJ-3 (Fremdwährung & Wechselkurs)** setzt auf diesem Feature auf. Alles hier ist **Euro**;
  PROJ-3 ergänzt Fremdwährung, ohne ein Kriterium dieser Spec umzukehren.
- **PROJ-2 besitzt den App-Rahmen** (`docs/app-shell.md`): Header mit Wortmarke, Monatswechsler und
  Abmelden, dazu das Seitenmuster. Die Platzhalterseite auf `/` wird ersetzt; ihr Zugriffsschutz
  bleibt, wie PROJ-1 ihn gelegt hat.

## User Stories

- Als Gewerbetreibende:r möchte ich eine Ausgabe in wenigen Sekunden festhalten, während ich sie
  tätige, damit sie nicht auf einem Zettel verloren geht.
- Als Gewerbetreibende:r möchte ich am Monatsende mehrere Belege hintereinander nachtragen, ohne
  jedes Mal dieselben Felder neu auszufüllen.
- Als Gewerbetreibende:r möchte ich auf einen Blick sehen, wie viel dieser Monat gekostet hat und
  welche Kategorie den größten Anteil daran hat.
- Als Nutzer:in möchte ich einen Vertipper sofort korrigieren oder die Zeile wieder löschen können,
  damit die Monatssumme stimmt.
- Als Nutzer:in möchte ich in einen früheren Monat zurückblättern, damit ich nachsehen kann, was
  damals angefallen ist.
- Als Nutzer:in möchte ich meine erfassten Ausgaben als Datei mitnehmen können, damit ich nicht an
  dieses Produkt gebunden bin.

## Out of Scope

- **Fremdwährung, Wechselkurs, jede Währung außer Euro** — vollständig PROJ-3. Diese Spec kennt nur
  Euro-Beträge.
- **Negative Beträge, Erstattungen, Gutschriften** — bewusst ausgeschlossen (siehe Decision Log).
  Wer eine Rücksendung abbilden will, löscht oder korrigiert die ursprüngliche Ausgabe.
- **Ausgaben mit Datum in der Zukunft** — bewusst ausgeschlossen. Was noch nicht ausgelegt wurde, ist
  keine Auslage.
- **Wiederkehrende Ausgaben, Vorlagen, Duplizieren einer Zeile** — nicht im MVP.
- **Seitenblätterung, Suche, Freitextsuche, umschaltbare Sortierung, Filter außer dem Kategorieklick
  aus AC-15** — nicht im MVP.
- **Mehrfachauswahl und Massenlöschung, Papierkorb, Rückgängig-Funktion** — nicht im MVP.
- **Beleg-Foto-Upload, Steuerberater-Export (DATEV), Mehrjahres-Historie und Jahresauswertung,
  Budget-Warnungen, eigene Kategorienverwaltung, Einnahmen und EAR, Mehrbenutzer-Teams** — Non-Goals
  laut `docs/PRD.md`.
- **E-Mail-Adresse ändern** (Art. 16 DSGVO) — bleibt offen aus PROJ-1; die Ausgabendaten selbst sind
  über AC-20 berichtigungsfähig.
- **Datenschutzerklärung und Impressum** — fällig vor öffentlicher Erreichbarkeit, siehe
  `docs/privacy.md`.

## Acceptance Criteria

<!-- Deutsch: Angenommen [Vorbedingung], wenn [Aktion], dann [Ergebnis]
     Jedes AC hat eine stabile ID. Tasks referenzieren sie, qa-report.md berichtet pro AC-ID.
     Kette: AC → Task → Test. IDs werden nie neu vergeben. -->

### Ausgabe erfassen

- [ ] **AC-1** — Angenommen jemand ist angemeldet und auf `/`, wenn in der dauerhaft sichtbaren
  Erfassungszeile Betrag, Kategorie und Datum ausgefüllt und abgeschickt werden, dann ist die Ausgabe
  gespeichert und erscheint ohne Neuladen in der Liste des Monats, zu dem ihr Datum gehört
- [ ] **AC-2** — Angenommen die Erfassungszeile wird angezeigt, wenn der angezeigte Monat der
  laufende ist, dann ist das Datumsfeld mit dem heutigen Tag vorbelegt; steht die Ansicht auf einem
  früheren Monat, dann mit dem ersten Tag dieses Monats
- [ ] **AC-3** — Angenommen eine Ausgabe wurde soeben erfasst, wenn die Erfassungszeile danach
  angezeigt wird, dann sind Betrag und Notiz geleert, Kategorie und Datum stehen unverändert, und der
  Eingabefokus liegt im Betragsfeld
- [ ] **AC-4** — Angenommen die Ansicht steht auf einem Monat und es wird eine Ausgabe mit einem Datum
  aus einem anderen Monat erfasst, wenn gespeichert wird, dann behält die Ausgabe das eingegebene
  Datum, die Ansicht wechselt auf den Monat dieses Datums, und eine Rückmeldung nennt den Wechsel
- [ ] **AC-5** — Angenommen die Erfassungszeile ist ausgefüllt, wenn der Betrag 0, negativ oder mit
  mehr als zwei Nachkommastellen abgeschickt wird, dann erscheint eine Fehlermeldung am Betragsfeld
  und es wird nichts gespeichert
- [ ] **AC-6** — Angenommen ein Betrag wird eingegeben, wenn als Dezimaltrenner ein Komma oder ein
  Punkt verwendet wird, dann werden beide gleich verstanden und der Betrag erscheint danach überall
  in deutschsprachiger Schreibweise mit zwei Nachkommastellen (`1.284,50 €`)
- [ ] **AC-7** — Angenommen die Erfassungszeile ist ausgefüllt, wenn ein Datum nach dem heutigen Tag
  abgeschickt wird, dann erscheint eine Fehlermeldung am Datumsfeld und es wird nichts gespeichert
- [ ] **AC-8** — Angenommen die Erfassungszeile ist ausgefüllt, wenn keine Kategorie gewählt wurde,
  dann erscheint eine Fehlermeldung am Kategoriefeld und es wird nichts gespeichert
- [ ] **AC-9** — Angenommen eine Notiz wird eingegeben, wenn sie länger als 200 Zeichen ist, dann
  erscheint eine Fehlermeldung am Notizfeld und es wird nichts gespeichert; eine leere Notiz ist
  jederzeit zulässig
- [ ] **AC-10** — Angenommen eine Ausgabe wird angelegt oder geändert, wenn die Kategorie nicht aus der
  festen Liste stammt — Büromaterial · Software & Abos · Hardware & Geräte · Reise & Fahrt ·
  Bewirtung · Fortbildung · Marketing & Werbung · Gebühren & Beiträge · Sonstiges —, dann wird sie
  abgelehnt, auch wenn der Anwendungscode umgangen wird
- [ ] **AC-29** — Angenommen die Erfassungszeile ist ausgefüllt, wenn ein Betrag über 9.999.999,99 €
  abgeschickt wird, dann erscheint eine Fehlermeldung am Betragsfeld, die die Obergrenze nennt, und es
  wird nichts gespeichert
- [ ] **AC-30** — Angenommen die Erfassungszeile ist ausgefüllt, wenn ein Datum vor dem 01.01.2000
  abgeschickt wird, dann erscheint eine Fehlermeldung am Datumsfeld, die auf die Jahreszahl hinweist,
  und es wird nichts gespeichert

### Liste des Monats

- [ ] **AC-11** — Angenommen jemand ist angemeldet, wenn `/` angezeigt wird, dann listet die Seite
  genau die eigenen Ausgaben des angezeigten Monats mit Datum, Kategorie, Notiz und Betrag —
  absteigend nach Datum, bei gleichem Datum die zuletzt erfasste zuerst
- [ ] **AC-12** — Angenommen im angezeigten Monat gibt es keine Ausgabe, wenn die Seite angezeigt
  wird, dann erscheint ein ausformulierter Leerzustand statt einer leeren Tabelle, und die
  Erfassungszeile bleibt benutzbar

### Monatsübersicht

- [ ] **AC-13** — Angenommen der angezeigte Monat enthält Ausgaben, wenn die Seite angezeigt wird,
  dann steht die Gesamtsumme des Monats als hervorgehobener Betrag über der Liste
- [ ] **AC-14** — Angenommen der angezeigte Monat enthält Ausgaben, wenn die Übersicht angezeigt wird,
  dann steht je Kategorie **mit** Betrag eine Zeile mit Kategoriename, Summe und Prozentanteil an der
  Gesamtsumme, absteigend nach Summe sortiert; Kategorien ohne Betrag erscheinen nicht
- [ ] **AC-15** — Angenommen die Kategorienübersicht wird angezeigt, wenn eine Kategoriezeile gewählt
  wird, dann zeigt die Liste darunter nur noch die Ausgaben dieser Kategorie; eine erneute Auswahl
  derselben Zeile hebt den Filter wieder auf
- [ ] **AC-16** — Angenommen eine Ausgabe wird angelegt, geändert oder gelöscht, wenn der Vorgang
  abgeschlossen ist, dann stimmen Gesamtsumme und Kategoriesummen ohne Neuladen der Seite

### Monatsnavigation

- [ ] **AC-17** — Angenommen jemand öffnet `/` ohne Monatsangabe, wenn die Seite erscheint, dann wird
  der laufende Monat angezeigt; wird ein anderer Monat gewählt, dann steht er in der Adresse
  (`/?monat=2026-07`) und übersteht Neuladen, Lesezeichen und den Zurück-Button
- [ ] **AC-18** — Angenommen der laufende Monat wird angezeigt, wenn der Vorwärtspfeil betrachtet wird,
  dann ist er inaktiv; angenommen der Monat der ältesten eigenen Ausgabe wird angezeigt, dann ist der
  Rückwärtspfeil inaktiv. Beide bleiben sichtbar statt zu verschwinden
- [ ] **AC-19** — Angenommen die Adresse enthält eine Monatsangabe, die es nicht gibt oder die nicht
  dem erwarteten Format entspricht, wenn die Seite aufgerufen wird, dann wird der laufende Monat
  angezeigt statt einer Fehlerseite

### Ändern und Löschen

- [ ] **AC-20** — Angenommen eine Ausgabe steht in der Liste, wenn „Ändern" gewählt wird, dann öffnet
  sich ein Dialog mit Betrag, Kategorie, Datum und Notiz im gespeicherten Zustand; nach dem Speichern
  zeigen Liste und Summen den neuen Stand
- [ ] **AC-21** — Angenommen der Änderungsdialog ist offen, wenn ein Wert eingegeben wird, dann gelten
  dieselben Regeln wie beim Erfassen (AC-5 bis AC-10 sowie AC-29 und AC-30) mit denselben
  Fehlermeldungen
- [ ] **AC-22** — Angenommen eine Ausgabe steht in der Liste, wenn „Löschen" gewählt wird, dann
  erscheint ein Bestätigungsdialog, der Betrag, Kategorie und Datum der betroffenen Ausgabe nennt;
  „Abbrechen" lässt alles unverändert
- [ ] **AC-23** — Angenommen der Bestätigungsdialog ist offen, wenn das Löschen bestätigt wird, dann
  ist die Ausgabe entfernt, eine Rückmeldung bestätigt es, und Liste sowie Summen stimmen ohne
  Neuladen

### Zugriffsschutz

- [ ] **AC-24** — Angenommen es existieren zwei Konten A und B mit eigenen Ausgaben, wenn Konto A die
  Ausgaben von Konto B zu lesen, zu ändern oder zu löschen versucht, dann liefert die Datenbank kein
  Ergebnis und führt keine Änderung aus — auch wenn der Anwendungscode umgangen wird
  *(Art. 32 DSGVO)*
- [ ] **AC-25** — Angenommen eine Ausgabe wird angelegt, geändert oder gelöscht, wenn die Anfrage auf
  dem Server ankommt, dann werden Anmeldung, Zugehörigkeit der Ausgabe und alle Feldregeln dort
  erneut geprüft, unabhängig davon, was der Browser gesendet hat

### Datenschutz

> **Diese drei Kriterien stammen aus der Datenschutzprüfung (`/dsgvo PROJ-2`), nicht aus dem
> Spec-Interview.** Sie sind nicht im selben Sinn verhandelbar wie der Rest dieser Spec.

- [ ] **AC-26** — Angenommen jemand hat Ausgaben erfasst, wenn das Konto über PROJ-1 gelöscht wird,
  dann sind auch sämtliche Ausgaben dieser Person entfernt und es bleibt keine verwaiste Zeile zurück
  *(Art. 17 DSGVO)*
- [ ] **AC-27** — Angenommen jemand ist angemeldet und auf `/konto`, wenn der Datenexport gewählt
  wird, dann lädt eine maschinenlesbare CSV-Datei herunter, die alle eigenen Ausgaben mit Datum,
  Kategorie, Betrag, Notiz und Erfassungszeitpunkt sowie die E-Mail-Adresse und das
  Registrierungsdatum enthält und sich in einer Tabellenkalkulation ohne Nacharbeit öffnen lässt
  *(Art. 15, Art. 20 DSGVO)*
- [ ] **AC-28** — Angenommen das Notizfeld wird angezeigt, wenn es leer ist, dann weist ein sichtbarer
  Hinweis darauf hin, dass dort keine Namen Dritter und keine Gesundheits- oder ähnlich sensiblen
  Angaben stehen sollen; das Feld bleibt optional *(Art. 5 Abs. 1 lit. c, Art. 9 DSGVO)*

## Edge Cases

- **EC-1** — Angenommen jemand klickt zweimal schnell auf „Erfassen", wenn beide Anfragen durchgehen,
  dann entsteht genau eine Ausgabe und die Person sieht keinen Fehler
- **EC-2** — Angenommen dieselbe Ausgabe ist in zwei Browser-Tabs offen und wird in Tab A gelöscht,
  wenn Tab B sie danach ändern oder löschen will, dann erscheint eine verständliche Meldung, dass es
  diese Ausgabe nicht mehr gibt, die Liste in Tab B bringt sich auf Stand, und die Ausgabe entsteht
  dabei nicht erneut
- **EC-3** — Angenommen dieselbe Ausgabe wird in zwei Tabs gleichzeitig geändert, wenn beide
  speichern, dann gilt der zuletzt gespeicherte Stand vollständig, und beide Tabs zeigen nach ihrer
  nächsten Aktion denselben Stand — es entsteht keine Mischung aus beiden Eingaben
- **EC-4** — Angenommen die Datenbank ist nicht erreichbar, wenn eine Ausgabe erfasst oder geändert
  wird, dann erscheint eine verständliche Meldung und die eingegebenen Werte bleiben im Formular
  stehen, damit die Eingabe nicht verloren ist
- **EC-5** — Angenommen die Sitzung ist abgelaufen, wenn eine Ausgabe erfasst, geändert oder gelöscht
  werden soll, dann erfolgt die Weiterleitung auf `/login` mit dem Hinweis aus PROJ-1 (EC-3) statt
  einer stummen Fehlermeldung
- **EC-6** — Angenommen es ist der 1. eines Monats um 00:30 Uhr in Wien, wenn eine Ausgabe mit dem
  vorbelegten „heute" erfasst wird, dann gehört sie in den neuen Monat — Monatsgrenzen und „heute"
  richten sich nach der Zeitzone Europe/Vienna, nicht nach der Zeitzone des Servers
- **EC-7** — Angenommen die Prozentanteile der Kategorien werden gerundet, wenn sie angezeigt werden,
  dann darf ihre Summe 99 % oder 101 % ergeben; die Kategoriesummen in Euro ergeben dagegen exakt die
  angezeigte Gesamtsumme, ohne Rundungsdifferenz
- **EC-8** — Angenommen die einzige Ausgabe des ältesten Monats wird gelöscht, wenn die Ansicht danach
  angezeigt wird, dann bleibt sie auf diesem Monat mit dem Leerzustand stehen, und die Rückwärtsgrenze
  aus AC-18 rückt auf den nun ältesten Monat nach
- **EC-9** — Angenommen ein Monat enthält mehrere hundert Ausgaben, wenn die Seite angezeigt wird,
  dann bleiben Liste und Summen vollständig und bedienbar — im MVP ohne Seitenblätterung
- **EC-10** — Angenommen eine Notiz enthält ein Semikolon, ein Anführungszeichen oder einen
  Zeilenumbruch, wenn der Export aus AC-27 erzeugt wird, dann bleibt die Datei korrekt lesbar und die
  Spalten verrutschen nicht
- **EC-11** — Angenommen eine Ausgabe wird geändert und dabei in einen anderen Monat verschoben, wenn
  gespeichert wird, dann verschwindet sie aus der Liste des angezeigten Monats, die Summen dort
  stimmen weiterhin, und die Rückmeldung nennt den neuen Monat

## Technical Requirements

- Der Zugriffsschutz auf `expenses` wird **zusätzlich auf Datenbankebene** durchgesetzt (Row Level
  Security) — dasselbe Muster, das PROJ-1 an `profiles` etabliert hat, nicht ein zweites daneben
- Beträge werden als exakte Dezimalwerte gehalten und summiert; Gleitkomma-Rundungsfehler dürfen in
  keiner Summe auftauchen
- „Heute" und die Monatsgrenzen richten sich nach Europe/Vienna
- Alle Währungsangaben sind Euro; PROJ-3 ergänzt Fremdwährung additiv
- Die Monatsansicht ist nach demselben Maßstab zügig wie PROJ-1 es für die Anmeldung festlegt: am
  eingeschwungenen Produktions-Build mindestens 95 % der Antworten unter 500 ms, keine über 1 Sekunde
  — gemessen bei bis zu 300 Ausgaben im Monat
- Der Export aus AC-27 wird bei jedem Abruf erzeugt und nicht dauerhaft auf dem Server abgelegt

## Open Questions

- [ ] **§ 132 BAO — jetzt mit echten Daten.** Greift die 7-jährige Aufbewahrungspflicht auf die in
  `auslage.` erfassten Belegdaten durch? Dann kehrt sie AC-26 und AC-15 aus PROJ-1 um. Die Frage stand
  schon in PROJ-1, betraf dort aber eine leere Tabelle. Kontext in `docs/privacy.md`, Antwort von
  Jurist:innen.
- [x] **Wem gehört der Export-Abschnitt auf `/konto`?** ~~`docs/app-shell.md` weist `/konto` PROJ-1 zu,
  der Export (AC-27) betrifft aber Ausgabendaten.~~ **Beantwortet von `/architecture PROJ-2`, wie
  vorgeschlagen:** Der Abschnitt „Deine Daten mitnehmen" und die Route `/konto/export` gehören PROJ-2,
  der Bereich `/konto` und sein Zugriffsschutz bleiben bei PROJ-1. Festgehalten in `docs/app-shell.md`.

- [x] **Zwei Feldgrenzen, die der Entwurf ergänzt** (`design.md`, TD-18): höchstens 9.999.999,99 € je
  Ausgabe und kein Datum vor dem 01.01.2000. → Beide bleiben, mit den Werten aus dem Entwurf, und
  stehen seit `/refine PROJ-2` als **AC-29** und **AC-30** im Vertrag (2026-08-31).
- [ ] **Keine Seitenblätterung im MVP** (EC-9). Ab welcher Monatsgröße das spürbar wird, lässt sich
  erst mit echten Daten beantworten. Bei einer Handvoll Belege pro Monat — dem Zielbild des PRD —
  stellt sich die Frage nicht.
- [ ] **Umbenennen oder Entfernen einer Kategorie** trifft bereits erfasste Ausgaben. Ein Migrationsweg
  ist nicht festgelegt, weil eigene Kategorienverwaltung Non-Goal ist. Vor einer Änderung der Liste zu
  klären.
- [ ] **Datenschutzerklärung** (Art. 13 DSGVO) muss den Export und die Speicherung der Ausgaben
  abdecken — fällig vor dem ersten öffentlichen Zugang, nicht vorher.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Dauerhaft sichtbare Erfassungszeile statt Dialog hinter einem Knopf | Das PRD verspricht eine Ausgabe in unter 30 Sekunden. Ein Dialog kostet pro Ausgabe einen Klick und einen Kontextwechsel; die offene Zeile macht Erfassen zum Normalzustand der Seite statt zu einer Aktion, die man erst startet | 2026-08-29 |
| Damit weicht PROJ-2 vom Seitenmuster „genau eine Hauptaktion rechts" aus `docs/app-shell.md` ab | Das Muster stammt aus dem Vorschlag von `/init`, bevor der Erfassungsweg entschieden war. PROJ-2 besitzt den Rahmen und darf ihn festlegen; `/architecture PROJ-2` zieht `docs/app-shell.md` nach | 2026-08-29 |
| Ausgabe außerhalb des angezeigten Monats: Ansicht springt mit | Die Alternative — Ansicht bleibt stehen — lässt die eben erfasste Ausgabe unsichtbar verschwinden. Das ist genau der Moment, in dem jemand glaubt, das Speichern sei fehlgeschlagen, und die Ausgabe ein zweites Mal einträgt | 2026-08-29 |
| Kategorie und Datum bleiben nach dem Speichern stehen, Betrag und Notiz werden geleert | Belege werden typischerweise gebündelt nachgetragen: mehrere Zeilen vom selben Tag, oft derselben Kategorie. So kostet die zweite Ausgabe nur noch Betrag und Enter | 2026-08-29 |
| Datumsvorbelegung hängt vom angezeigten Monat ab (AC-2) | Wäre sie immer „heute", würde beim Nachtragen alter Belege die Ansicht nach jeder Zeile in den laufenden Monat springen — die Regel aus AC-4 würde sich gegen ihren eigenen Zweck wenden | 2026-08-29 |
| Übersicht zeigt nur belegte Kategorien, absteigend nach Betrag | Neun Zeilen, von denen fünf auf 0,00 € stehen, verbergen die Information, statt sie zu zeigen. Die Sortierung nach Betrag beantwortet die eigentliche Frage — „wo ist das Geld hingegangen" — ohne Lesearbeit | 2026-08-29 |
| Ändern im Dialog, Löschen mit Bestätigung statt Rückgängig-Toast | Dasselbe Muster wie die Kontolöschung in PROJ-1, dieselbe Komponente, kein zusätzlicher Mechanismus im Datenmodell. Ein Rückgängig-Toast ist im Alltag schneller, verliert die Ausgabe aber endgültig, sobald er weggeklickt wird | 2026-08-29 |
| Nur positive Beträge, kein Datum in der Zukunft | Der Produktname ist die Grenze: was ausgelegt wurde, steht drin. Negative Beträge zögen Folgefragen nach sich (negative Gesamtsumme, Prozentanteile bei gemischten Vorzeichen) und rückten das Produkt Richtung Buchhaltung — laut PRD ausdrücklich nicht das Ziel. Zukunftsdaten würden Planzahlen in abgeschlossene Monatssummen mischen | 2026-08-29 |
| Komma **und** Punkt werden als Dezimaltrenner akzeptiert | Wer vom Ziffernblock tippt, bekommt einen Punkt; wer deutschsprachig schreibt, ein Komma. Eine Fehlermeldung für den falschen Trenner ist reine Schikane, die Anzeige bleibt trotzdem einheitlich deutschsprachig | 2026-08-29 |
| Der Monat steht in der Adresse, Grenzen kommen aus den Daten | Ohne Adresse verlässt der Zurück-Button die App statt einen Monat zurückzugehen, und ein Neuladen wirft die Navigation weg. Die Grenzen verhindern das Blättern in Monate, in denen garantiert nichts steht — vorwärts, weil Zukunftsdaten ausgeschlossen sind, rückwärts, weil es vor der ersten Ausgabe nichts gibt | 2026-08-29 |
| Die neun Kategorien aus `docs/data-model.md` unverändert | Deckt die typischen Ausgaben eines österreichischen Freelancers ab — SVS und Kammerumlage unter Gebühren & Beiträge, Telefon und Internet unter Software & Abos. Neun Einträge lassen sich noch ohne Suchen auswählen, und eigene Kategorienverwaltung ist Non-Goal | 2026-08-29 |
| CSV-Export in PROJ-2 statt als eigenes Feature oder händisch | Art. 15 und Art. 20 DSGVO ließen sich auch händisch innerhalb eines Monats erfüllen. Ein Knopf und eine Route kosten hier aber weniger als der Prozess drumherum, schließen zwei offene Punkte in `docs/privacy.md` und machen das Recht überhaupt erst benutzbar | 2026-08-29 |
| Hinweis am Notizfeld statt Einwilligungsdialog | In einem österreichischen Ausgabenkontext sind Kirchenbeitrag, Gewerkschaftsbeitrag und Apotheke gängige Positionen — also Art.-9-Daten. Die Person tippt sie über sich selbst; ein Einwilligungsdialog wäre unverhältnismäßig, ein Feld, das solche Angaben gar nicht erst einlädt, ist das billigere Mittel (Art. 5 Abs. 1 lit. c) | 2026-08-29 |
| „Letzter gewinnt" bei gleichzeitiger Änderung (EC-3) | Eine Ausgabe hat vier Felder und genau eine:n Eigentümer:in — zwei Personen können sie nicht gleichzeitig bearbeiten, nur eine Person in zwei Tabs. Ein Sperrmechanismus oder eine Konfliktauflösung wäre mehr Bauwerk als der Fall wert; entscheidend ist nur, dass keine Mischung aus beiden Ständen entsteht | 2026-08-29 |
| Höchstbetrag 9.999.999,99 € und frühestes Datum 01.01.2000 werden Kriterien (AC-29, AC-30) | Beide Grenzen waren im Entwurf längst gebaut, standen aber in keinem Kriterium — QA hätte sie zu Recht als Abweichung gemeldet. Die Datumsgrenze ist dabei keine Kosmetik: ein vertippter Jahrgang wie `0202` macht aus der Rückwärtsgrenze von AC-18 eine Navigation über 1.800 Jahre. Beide melden sich mit einem eigenen Satz, statt still zu scheitern | 2026-08-31 |
