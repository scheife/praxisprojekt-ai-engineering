# PROJ-3: Fremdwährung & Wechselkurs

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. A contract that is read-only during /build
     cannot carry a field that changes during /build. -->

## Dependencies

- **Erfordert PROJ-2** (Ausgaben & Monatsübersicht) — dieses Feature ergänzt die bestehende
  Erfassungszeile, Liste, Monatsübersicht, den Änderungsdialog und den CSV-Export um die Währung.
  Es baut nichts davon neu.
- **Erfordert PROJ-1** mittelbar über PROJ-2 (Anmeldung, Zugriffsschutz je Konto).

## User Stories

- Als Gewerbetreibende:r möchte ich eine Rechnung in US-Dollar so erfassen, wie sie dasteht, damit ich
  nicht vor dem Eintragen selbst umrechnen muss.
- Als Gewerbetreibende:r möchte ich, dass eine Fremdwährungsausgabe mit dem Kurs **ihres Ausgabetags**
  umgerechnet wird, damit der Euro-Betrag dem entspricht, was an diesem Tag tatsächlich abgeflossen ist.
- Als Gewerbetreibende:r möchte ich sehen, welcher Kurs von welchem Tag verwendet wurde, damit ich die
  Umrechnung gegen eine Kursquelle nachprüfen kann, wenn jemand nachfragt.
- Als Gewerbetreibende:r möchte ich, dass eine abgeschlossene Monatsübersicht stehen bleibt, damit im
  August nicht plötzlich eine andere März-Summe steht, nur weil sich der Dollar bewegt hat.
- Als Gewerbetreibende:r möchte ich meine Monatssumme weiterhin als eine einzige Euro-Zahl sehen, damit
  ich nicht mehrere Währungen im Kopf zusammenrechnen muss.

## Out of Scope

- **Eine eigene Standardwährung je Konto** — die Erfassungszeile beginnt immer bei EUR und behält
  danach die zuletzt gewählte Währung (AC-6). Eine gespeicherte Voreinstellung wäre eine
  Kontoeinstellung; `profiles` ist dafür vorbereitet, aber es ist nicht Teil dieses Features.
- **Umrechnung zwischen zwei Fremdwährungen** — umgerechnet wird immer nach Euro, nie von USD nach CHF.
- **Nachträgliches Aktualisieren eingefrorener Kurse**, ein „Kurse neu holen"-Knopf, ein Kursverlauf
  oder eine Kurs-Historie je Währung — der eingefrorene Kurs ist endgültig, solange Währung und Datum
  stehen bleiben.
- **Kursgewinne und -verluste, Bewertungsdifferenzen, Stichtagsbewertung zum Jahresende** — das ist
  Buchhaltung und ausdrücklich nicht das Versprechen von `auslage.` (`docs/PRD.md`).
- **Ein Kurs von Hand** — weder als Regelweg noch als Rückfallebene bei einem Ausfall (siehe Decision
  Log). Das PRD verspricht ausdrücklich, dass **nicht** von Hand umgerechnet wird.
- **Eine Kurs-Cache-Tabelle oder ein Vorratsladen von Kursen** — das Anzeigen von Listen und Summen
  ruft den Dienst nie auf (siehe Technical Requirements), damit erübrigt sich der Vorrat.
- **Ausgaben ohne Euro-Wert**, in welcher Form auch immer — es gibt keinen Zustand „Kurs wird
  nachgeholt" (siehe Decision Log).
- **Beleg-Foto-Upload, DATEV-Export, Mehrjahres-Historie, Budget-Warnungen, eigene
  Kategorienverwaltung, Einnahmen und EAR, Mehrbenutzer-Teams** — Non-Goals laut `docs/PRD.md`.
- **Negative Beträge und Zukunftsdaten** — bleiben ausgeschlossen wie in PROJ-2; die Währung ändert
  daran nichts.

## Acceptance Criteria

<!-- Deutsch: Angenommen [Vorbedingung], wenn [Aktion], dann [Ergebnis]
     Jedes AC hat eine stabile ID. Tasks referenzieren sie, qa-report.md berichtet pro AC-ID.
     Kette: AC → Task → Test. IDs werden nie neu vergeben. -->

### Währung wählen und erfassen

- [ ] **AC-1** — Angenommen jemand ist angemeldet und auf `/`, wenn die Erfassungszeile angezeigt
  wird, dann gibt es dort ein Währungsfeld, das mit **EUR** vorbelegt ist und alle vom Kursdienst
  geführten Währungen zur Wahl stellt; EUR, USD, CHF und GBP stehen am Anfang der Liste, die übrigen
  folgen alphabetisch nach ihrem Währungscode
- [ ] **AC-2** — Angenommen in der Erfassungszeile steht EUR, wenn die Ausgabe abgeschickt wird, dann
  wird **kein** Kursdienst aufgerufen und die Ausgabe verhält sich in jeder Hinsicht wie in PROJ-2
- [ ] **AC-3** — Angenommen in der Erfassungszeile steht eine Fremdwährung, wenn die Ausgabe
  abgeschickt wird, dann wird der Kurs **zum Ausgabedatum** geholt, der Euro-Wert daraus berechnet, und
  gespeichert werden zusätzlich: die gewählte Währung, der Originalbetrag, der verwendete Kurs und das
  Datum, zu dem dieser Kurs gilt
- [ ] **AC-4** — Angenommen für das Ausgabedatum gibt es keinen Kurs — Wochenende, Feiertag, oder der
  Tageskurs ist noch nicht veröffentlicht —, wenn die Ausgabe erfasst wird, dann wird der Kurs des
  **letzten davorliegenden Werktags** verwendet, und als Kursdatum wird **dieser Tag** festgehalten,
  nicht das Ausgabedatum
- [ ] **AC-5** — Angenommen der Kurs lässt sich nicht ermitteln — der Dienst antwortet nicht, zu
  langsam, mit einem Fehler oder mit einem unbrauchbaren Wert —, wenn eine Fremdwährungsausgabe
  abgeschickt wird, dann **entsteht keine Ausgabe**, die eingegebenen Werte bleiben in der
  Erfassungszeile stehen, und eine verständliche Meldung nennt beides: dass es am Kurs liegt und dass
  eine Erfassung in Euro weiterhin möglich ist
- [ ] **AC-6** — Angenommen eine Fremdwährungsausgabe wurde soeben erfasst, wenn die Erfassungszeile
  danach angezeigt wird, dann bleibt die gewählte Währung stehen — wie Kategorie und Datum in PROJ-2
  (AC-3), während Betrag und Notiz geleert werden

### Anzeigen

- [ ] **AC-7** — Angenommen eine Ausgabe in Fremdwährung steht in der Liste, wenn die Zeile angezeigt
  wird, dann führt sie den **Euro-Wert als Hauptbetrag** und darunter den Originalbetrag mit seiner
  Währung, den verwendeten Kurs und das Kursdatum; eine Ausgabe in Euro wird unverändert einzeilig
  dargestellt wie in PROJ-2
- [ ] **AC-8** — Angenommen der Kurs wird angezeigt, wenn er gelesen wird, dann steht er in der
  Richtung, in der sich die Umrechnung nachrechnen lässt: Originalbetrag × Kurs ergibt den
  angezeigten Euro-Wert
- [ ] **AC-9** — Angenommen ein Monat enthält Ausgaben in mehreren Währungen, wenn Monatsübersicht,
  Kategoriesummen und Gesamtsumme angezeigt werden, dann sind sie **ausschließlich in Euro** und
  enthalten jede Ausgabe mit ihrem eingefrorenen Euro-Wert
- [ ] **AC-10** — Angenommen eine Fremdwährungsausgabe wurde vor Wochen erfasst, wenn ihre Liste oder
  ihre Monatsübersicht später erneut angezeigt wird, dann stehen Euro-Wert, Kurs und Kursdatum
  unverändert da — unabhängig davon, wie sich der Kurs seither entwickelt hat

### Ändern

- [ ] **AC-11** — Angenommen eine Fremdwährungsausgabe wird über „Ändern" geöffnet, wenn der Dialog
  erscheint, dann zeigt er die Währung als änderbares Feld, vorbelegt mit der gespeicherten Währung
- [ ] **AC-12** — Angenommen der Änderungsdialog ist offen, wenn **Währung oder Datum** geändert und
  gespeichert wird, dann wird der Kurs für die dann geltende Kombination aus Währung und Datum **neu
  geholt** und zusammen mit dem neuen Kursdatum gespeichert
- [ ] **AC-13** — Angenommen der Änderungsdialog ist offen, wenn **nur der Betrag** geändert wird,
  dann bleiben Kurs und Kursdatum unverändert und der Euro-Wert wird mit dem bestehenden Kurs neu
  berechnet
- [ ] **AC-14** — Angenommen der Änderungsdialog ist offen, wenn **nur Kategorie oder Notiz** geändert
  werden, dann bleiben Währung, Kurs, Kursdatum und Euro-Wert unangetastet und es wird kein Kursdienst
  aufgerufen
- [ ] **AC-15** — Angenommen bei einer Änderung müsste ein Kurs neu geholt werden und das gelingt
  nicht, wenn gespeichert wird, dann wird die Änderung **nicht** übernommen, die gespeicherte Ausgabe
  bleibt vollständig unverändert, und eine verständliche Meldung erklärt es
- [ ] **AC-16** — Angenommen eine Fremdwährungsausgabe wird auf **EUR** umgestellt, wenn gespeichert
  wird, dann gilt der eingegebene Betrag unmittelbar als Euro-Betrag, und Kurs sowie Kursdatum werden
  von dieser Ausgabe entfernt

### Grenzen

- [ ] **AC-17** — Angenommen ein Betrag wird in einer Fremdwährung eingegeben, wenn er 0, negativ oder
  größer als 9.999.999,99 ist, dann wird er abgelehnt — dieselben Grenzen wie in PROJ-2 (AC-5, AC-29),
  angewendet auf den Originalbetrag
- [ ] **AC-18** — Angenommen ein zulässiger Fremdwährungsbetrag ergibt umgerechnet einen Euro-Wert
  über 9.999.999,99 € oder unter 0,01 €, wenn gespeichert wird, dann wird die Ausgabe abgelehnt und
  die Meldung nennt den umgerechneten Wert als Grund

### Datenschutz

> AC-19 kommt aus der Datenschutz-Betrachtung, nicht aus dem Interview: Der Auskunfts- und
> Übertragbarkeitsanspruch (Art. 15 und 20 DSGVO) ist nur erfüllt, wenn der Export **alles** enthält,
> was gespeichert ist. Mit PROJ-3 sind das vier Felder mehr.

- [ ] **AC-19** — Angenommen jemand hat Fremdwährungsausgaben erfasst, wenn der Datenexport aus PROJ-2
  (AC-27) erzeugt wird, dann enthält er zu jeder Ausgabe auch Währung, Originalbetrag, verwendeten
  Kurs und Kursdatum

## Edge Cases

- **EC-1** — Angenommen jemand klickt zweimal schnell auf „Erfassen", wenn beide Anfragen durchgehen,
  dann entsteht genau **eine** Fremdwährungsausgabe mit **einem** Kurs — es entstehen nicht zwei
  Zeilen mit womöglich verschiedenen Kursen
- **EC-2** — Angenommen der Kursdienst antwortet sehr langsam, wenn eine Ausgabe erfasst wird, dann
  wird nach einer begrenzten Wartezeit abgebrochen und wie ein Ausfall behandelt (AC-5) — die
  Erfassung hängt nicht minutenlang
- **EC-3** — Angenommen der Kursdienst antwortet, liefert aber keinen brauchbaren Kurs — kein Wert
  für die gewählte Währung, 0, negativ oder keine Zahl —, wenn die Ausgabe erfasst wird, dann gilt
  das als Ausfall (AC-5) und **nicht** als Kurs; eine Ausgabe mit unsinnigem Euro-Wert entsteht nicht
- **EC-4** — Angenommen der Kurs ist für die gewählte Währung am gewünschten Tag grundsätzlich nicht
  verfügbar, weil er damals noch nicht veröffentlicht wurde, wenn eine Ausgabe mit weit
  zurückliegendem Datum erfasst wird, dann greift AC-5 und die Meldung führt nicht in die Irre — sie
  behauptet insbesondere keinen vorübergehenden Ausfall
- **EC-5** — Angenommen die Umrechnung ergibt Bruchteile eines Cents, wenn der Euro-Wert gespeichert
  wird, dann wird kaufmännisch auf ganze Cent gerundet, und ein Betrag größer 0 wird dabei **nie zu
  0,00 €** — er wird gegebenenfalls nach AC-18 abgelehnt statt still auf null gerundet
- **EC-6** — Angenommen zwei Ausgaben mit **derselben** Währung und **demselben** Ausgabedatum werden
  nacheinander erfasst, wenn beide gespeichert sind, dann tragen sie denselben Kurs und dasselbe
  Kursdatum
- **EC-7** — Angenommen dieselbe Ausgabe ist in zwei Browser-Tabs offen und wird in Tab A auf eine
  andere Währung umgestellt, wenn Tab B danach mit seinem alten Stand speichert, dann gilt der zuletzt
  gespeicherte Stand **vollständig** — es entsteht keine Mischung aus der Währung des einen und dem
  Kurs des anderen Tabs
- **EC-8** — Angenommen es gibt Ausgaben aus PROJ-2, die vor diesem Feature in Euro erfasst wurden,
  wenn Liste und Monatsübersicht nach der Einführung angezeigt werden, dann erscheinen sie unverändert
  als Euro-Ausgaben, ohne Kursangabe und ohne Nachfrage
- **EC-9** — Angenommen die Sitzung ist abgelaufen oder die Datenbank nicht erreichbar, wenn eine
  Fremdwährungsausgabe erfasst oder geändert wird, dann gelten unverändert EC-4 und EC-5 aus PROJ-2 —
  ein Kursproblem und ein Datenbankproblem sind für die Person unterscheidbar benannt

## Technical Requirements

- Der Kurs wird **auf der Ausgabe eingefroren**, zusammen mit dem Datum, zu dem er gilt. Das Anzeigen
  von Listen, Summen und Monatsübersichten ruft **keinen** Kursdienst auf — null Aufrufe im Lesepfad
  (`docs/data-model.md`).
- Beträge werden weiterhin in ganzen Cent geführt, damit keine Summe je runden muss (PROJ-2). Der
  Originalbetrag in Fremdwährung folgt derselben Regel.
- **An den Kursdienst gehen keine personenbezogenen Daten** — ein Aufruf besteht aus einem Datum und
  zwei Währungscodes. Weder Betrag, Notiz, Kategorie noch eine Kennung der Person verlassen die
  Anwendung. Diese Eigenschaft ist Teil des Vertrags und darf nicht aus Bequemlichkeit aufgegeben
  werden (etwa durch Mitsenden einer Kennung zur Nachverfolgung).
- Der verwendete Kursdienst ist **frankfurter.app** (EZB-Referenzkurse), wie in `docs/PRD.md`
  festgehalten. Ein Wechsel des Dienstes ist eine Entscheidung für `/architecture`, solange das
  Verhalten dieses Vertrags erhalten bleibt.
- Die Umrechnung muss aus den gespeicherten Werten nachvollziehbar sein: Originalbetrag, Kurs und
  Euro-Wert müssen zueinander passen (AC-8).

## Open Questions

- [ ] **Deckt der Kursdienst jede angebotene Währung über den ganzen zulässigen Datumsbereich ab?**
  PROJ-2 lässt Ausgabedaten ab dem 01.01.2000 zu (AC-30). Nicht jede heute geführte Währung wurde
  damals schon von der EZB veröffentlicht. Wo das auseinanderfällt, greift AC-5 und EC-4 — die Frage
  ist, ob das oft genug vorkommt, um die Währungsliste vom gewählten Datum abhängig zu machen. Vor
  `/build` an einer Stichprobe zu prüfen.
- [ ] **Verlässlichkeit und Grenzen von frankfurter.app.** Der Dienst ist kostenlos und ohne
  zugesicherte Verfügbarkeit. Wie oft er ausfällt und ob er die Zahl der Aufrufe begrenzt, ist nicht
  bekannt. AC-5 fängt den Ausfall sauber ab; sollte er häufig sein, wäre das ein Grund, die
  Entscheidung gegen einen Kurs von Hand noch einmal aufzurufen.
- [ ] **Wie viele Kursaufrufe darf eine angemeldete Person auslösen?** Jede Erfassung und jede
  Änderung von Währung oder Datum ruft den Dienst auf. Das ist kein Zugangsdaten-Pfad und braucht
  darum keine Drosselung nach dem Muster von PROJ-1 — aber wer das Formular schnell genug bedient,
  erzeugt auf Kosten eines fremden, kostenlosen Dienstes Last, und ein Aussperren unserer Anwendung
  träfe alle Nutzer:innen zugleich. Ob eine Obergrenze nötig ist und welche, gehört zu
  `/architecture`; im normalen Gebrauch (eine Handvoll Belege im Monat) stellt sich die Frage nicht.
- [ ] **Rundung und Steuerberatung.** EC-5 legt kaufmännisches Runden auf ganze Cent fest. Ob eine
  österreichische Steuerberatung dieselbe Rundung erwartet, ist nicht geprüft — für den Zweck von
  `auslage.` (Überblick, keine Buchhaltung) ist es unkritisch, vor einem DATEV-Export wäre es zu
  klären.
- [ ] **Formale Datenschutz-Prüfung.** Dieses Feature legt keine neue Art personenbezogener Daten an
  und sendet nichts Personenbezogenes nach außen; die eine Folge, der Export, steht als AC-19 im
  Vertrag. Ein vollständiger `/dsgvo PROJ-3`-Lauf wurde deshalb **nicht** durchgeführt — er wäre vor
  dem ersten öffentlichen Zugang nachzuholen, gemeinsam mit der ohnehin offenen Datenschutzerklärung.
- [ ] **§ 132 BAO** — unverändert offen aus PROJ-1 und PROJ-2: Greift die 7-jährige
  Aufbewahrungspflicht auf die erfassten Belegdaten durch? Betrifft auch die hier ergänzten Felder.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Kurs **vom Ausgabedatum**, nicht vom Erfassungstag | Der Euro-Betrag soll dem entsprechen, was an diesem Tag abgeflossen wäre — das ist die Rechnung, die eine Buchhaltung erwartet. Bei einer drei Wochen alten Rechnung liegen sonst leicht mehrere Prozent dazwischen. Der Dienst liefert historische Kurse ohne Mehraufwand mit | 2026-08-31 |
| Ohne Kurs entsteht **keine** Ausgabe; Euro-Erfassung bleibt unberührt | Damit gilt die Zusicherung, auf der die ganze Monatsübersicht steht: jede gespeicherte Ausgabe hat einen Euro-Wert, also stimmt jede Summe immer. Die Alternative (Kurs nachholen) verlangt einen zweiten Zustand je Ausgabe, einen Nachhol-Lauf und einen Sonderfall in jeder Summe — zu viele Bauteile für den Zeitrahmen, und sie zeigt zwischenzeitlich falsche Summen | 2026-08-31 |
| **Kein** Kurs von Hand, auch nicht als Rückfallebene | Das PRD verspricht ausdrücklich, dass nicht von Hand umgerechnet wird — genau das ist der Schmerz, den `auslage.` nimmt. Ein Tippfehler im Kurs schlägt zudem still auf die Monatssumme durch und ist später nicht mehr als Fehler erkennbar | 2026-08-31 |
| Alle vom Dienst geführten Währungen, häufige oben | Eine feste Kurzliste kostet im Bau dasselbe, kann aber jemanden hart aussperren: eine Rechnung in CZK oder SEK — Nachbarländer — wäre nicht korrekt erfassbar. Der Kurs kommt für jede Währung vom selben Dienst | 2026-08-31 |
| Kurs nur neu holen, wenn **Währung oder Datum** sich ändert | Der Kurs hängt an genau diesen beiden Angaben. Bei jeder Änderung neu zu holen hieße, dass eine Notizkorrektur an einem fremden Dienst scheitern kann. Nie neu zu holen hieße, dass ein korrigiertes Datum eine Zeile mit widersprüchlichem Kursdatum hinterlässt | 2026-08-31 |
| Bei fehlendem Tageskurs der letzte Werktag — und das **Kursdatum sagt es** | Der Freitagskurs für einen Samstag ist übliche Praxis und kommt vom Dienst selbst. Entscheidend ist die Ehrlichkeit der Anzeige: Ein ausgewiesener Kurs, den es an diesem Tag nie gab, lässt jede Nachprüfung scheitern und die Zahl falsch wirken. Wochenendausgaben deshalb zu sperren war keine Option — Bewirtung, Tanken und Reise fallen überwiegend aufs Wochenende | 2026-08-31 |
| Kurs und Kursdatum stehen **in der Liste**, nicht nur im Dialog | `features/INDEX.md` sagt „den verwendeten Kurs samt Datum ausweisen" zu. Hinter einem Klick pro Zeile wäre die Nachprüfbarkeit bei der Monatsdurchsicht praktisch nicht gegeben. Nur Fremdwährungszeilen werden zweizeilig — reine Euro-Listen bleiben so ruhig wie in PROJ-2 | 2026-08-31 |
| Kursdatum **immer** nennen, nicht nur bei Abweichung | Eine Zeile ohne Kursdatum wäre zweideutig — „gleicher Tag" oder „weggelassen"? Eine Darstellung statt zweier ist außerdem einfacher zu prüfen | 2026-08-31 |
| Die gewählte Währung bleibt nach dem Erfassen stehen | Folgt der Regel aus PROJ-2 (AC-3): Betrag und Notiz werden geleert, Kategorie und Datum bleiben. Wer einen Stapel Dollar-Belege eingibt, wählt die Währung damit einmal statt jedes Mal | 2026-08-31 |
| Betragsgrenzen gelten **doppelt** — auf Originalbetrag und Euro-Wert | Die Grenze aus PROJ-2 hängt an der gespeicherten Euro-Zahl; ein zulässiger Fremdwährungsbetrag kann sie nach der Umrechnung reißen. Beide Prüfungen sind nötig, und die Meldung muss sagen, welche griff | 2026-08-31 |
