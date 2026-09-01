# Technisches Design — PROJ-3: Fremdwährung & Wechselkurs

<!-- Dieses Dokument (design.md) beschreibt das WIE — Aufbau, Datenmodell, technische
     Entscheidungen. Der Vertrag (WAS) steht in spec.md und ist während /build unveränderlich.
     Testergebnisse stehen in qa-report.md. Owner: /architecture. -->

## Überblick in drei Sätzen

PROJ-3 gibt der Ausgabe eine **Währung**. Ist sie EUR — die Vorbelegung —, ändert sich am Verhalten
von PROJ-2 nichts und kein fremder Dienst wird aufgerufen; ist sie eine andere, holt der Server beim
Speichern **einmal** den EZB-Kurs zum Ausgabetag, rechnet daraus den Euro-Betrag und friert Kurs und
Kursdatum auf der Zeile ein.

Alles, was danach passiert — Listen, Summen, Monatsübersichten, der Export —, rechnet ausschließlich
mit dem eingefrorenen Euro-Betrag und ruft **nie** einen Kursdienst auf.

---

## Was PROJ-3 an PROJ-2 ändert — und was ausdrücklich nicht

Das ist die tragende Entwurfsregel: **jedes Acceptance Criterion von PROJ-2 bleibt unverändert wahr.**
PROJ-3 ergänzt nur, es kehrt nichts um.

| PROJ-2 | Was PROJ-3 tut |
|---|---|
| AC-1 – AC-10, AC-29, AC-30 (Erfassen) | **unberührt.** Ein Währungsfeld kommt dazu; alle Betrags-, Datums-, Kategorie- und Notizregeln gelten unverändert und zusätzlich für den Originalbetrag |
| AC-3 (Zeile leert sich) | Die Währung verhält sich wie Kategorie und Datum: sie **bleibt stehen** (PROJ-3 AC-6). Betrag und Notiz werden weiterhin geleert |
| AC-11, AC-12 (Liste) | Eine Fremdwährungszeile bekommt eine **zweite Zeile**; eine Euro-Zeile bleibt exakt wie sie ist (PROJ-3 AC-7, EC-8) |
| AC-13 – AC-16 (Summen) | **unberührt.** Sie rechnen weiter mit `amount_cents`, das jetzt garantiert für jede Zeile existiert |
| AC-17 – AC-19 (Monatsnavigation) | **unberührt** |
| AC-20 – AC-23 (Ändern, Löschen) | Der Dialog bekommt das Währungsfeld; die Regeln bleiben |
| AC-24, AC-25 (Zugriffsschutz) | **unberührt.** Die neuen Felder liegen in derselben Zeile und fallen unter dieselben Policies |
| AC-26 (Kontolöschung) | **unberührt** — die Löschweitergabe kennt keine Spalten |
| AC-27 (Export) | Bekommt **vier Spalten dazu** (PROJ-3 AC-19). Bestehende Spalten behalten Reihenfolge und Bedeutung |

**Kein `/refine PROJ-2` nötig**, mit einer Ausnahme, die unter *Offene Punkte* steht: PROJ-2 AC-27
zählt die Spalten des Exports auf. Die Aufzählung wird durch PROJ-3 AC-19 erweitert, nicht ersetzt —
beide Kriterien sind gleichzeitig erfüllbar, und `/qa` prüft sie einzeln.

**Am gemeinsamen Rahmen (`docs/app-shell.md`) ändert PROJ-3 nichts.** Kein neuer Bereich, kein
Eintrag im Header, keine Layout-Region, kein neues Seitenmuster. Die Änderungen liegen vollständig im
Inhalt von `/` und im Änderungsdialog — beides gehört PROJ-2. `docs/app-shell.md` bleibt daher
unangetastet.

---

## Component Structure

```
/ (Ausgaben & Monatsübersicht — PROJ-2)
│
├── AppHeader                              unverändert (PROJ-2)
│
├── ExpenseComposer  (Erfassungszeile)     ERWEITERT
│   ├── Betrag
│   ├── ▸ Währungsfeld                     NEU — Auswahl, EUR vorbelegt
│   ├── Kategorie
│   ├── Datum
│   ├── Notiz
│   └── Kurs-Fehlerzeile                   NEU — formularweite Meldung (AC-5)
│
├── MonthPanel / CategoryBreakdown         unverändert — rechnet mit Euro-Cent
│
├── ExpenseList
│   └── ExpenseRow                         ERWEITERT
│       ├── Euro-Betrag (Hauptzahl)        unverändert bei EUR-Ausgaben
│       ├── ▸ Kurs-Beizeile                NEU — nur bei Fremdwährung
│       │      „1.250,00 USD · 1 € = 1,1643 USD · Kurs vom 14.08.2026"
│       ├── Kategorie · Datum
│       └── Notiz
│
└── EditExpenseDialog                      ERWEITERT
    └── ▸ Währungsfeld                     NEU — wie in der Erfassungszeile

Serverseitig
├── Währungsliste (Code, keine Abfrage)    NEU — 30 Codes + deutsche Namen
├── Kurs-Abruf                             NEU — einziger Ort mit Außenkontakt
├── createExpense / updateExpense          ERWEITERT — rufen den Kurs-Abruf
└── CSV-Export (/konto/export)             ERWEITERT — vier Spalten mehr
```

---

## Data Model

### Was `expenses` dazubekommt

Drei Felder, alle **additiv**. Bestehende Zeilen bleiben gültig (EC-8).

| Feld | Typ | Regeln |
|---|---|---|
| `currency` | Text, genau 3 Zeichen | Pflicht. Vorgabewert `EUR`. Nur einer der 30 bekannten ISO-4217-Codes — als Prüfregel in der Datenbank, nach demselben Muster wie die Kategorie (PROJ-2, TD-2) |
| `rate_per_eur` | Dezimalzahl, 18 Stellen gesamt / 8 Nachkommastellen | **Nur bei Fremdwährung gesetzt, bei `EUR` leer.** Bedeutung: **wie viele Einheiten der Fremdwährung ein Euro kostet** — die Richtung, in der die EZB veröffentlicht (siehe TD-2). Muss größer 0 sein |
| `rate_date` | Datum | **Nur bei Fremdwährung gesetzt, bei `EUR` leer.** Der Tag, für den der Kurs tatsächlich gilt — nicht zwingend der Ausgabetag (AC-4) |

`amount_cents` bleibt, was es ist: **der Euro-Betrag in ganzen Cent**, und trägt weiterhin jede Summe.
Neu ist nur, dass er bei Fremdwährung ein *errechneter* Wert ist.

Der **Originalbetrag** braucht ein eigenes Feld:

| Feld | Typ | Regeln |
|---|---|---|
| `amount_original` | Ganzzahl | Pflicht. Der eingegebene Betrag in **Hundertsteln seiner Währung**, also mit festem Exponenten 2 — genau wie `amount_cents`. Zwischen 1 und 999.999.999 (AC-17, dieselben Grenzen wie PROJ-2 AC-5/AC-29) |

Bei einer Euro-Ausgabe sind `amount_original` und `amount_cents` **gleich**. Das ist Absicht: Es gibt
keinen Sonderfall „Euro hat keinen Originalbetrag", jede Zeile ist gleich aufgebaut, und der Export
kann stumpf beide Spalten füllen.

### Die Zusicherung, die die Datenbank selbst hält

Eine Prüfregel über mehrere Spalten, weil ein halb gefüllter Zustand sonst schleichend entsteht:

> **Entweder** `currency` ist `EUR`, **dann** sind `rate_per_eur` und `rate_date` leer und
> `amount_original` gleich `amount_cents` — **oder** `currency` ist etwas anderes, **dann** sind
> `rate_per_eur` und `rate_date` beide gesetzt.

Damit ist „Fremdwährung ohne Kurs" auf Datenbankebene **unmöglich**, nicht nur unwahrscheinlich. Das
ist die technische Entsprechung der Produktentscheidung aus der Spec: es gibt keinen Zustand
„Kurs wird nachgeholt" (TD-8).

### Zugriff, Aufbewahrung, Eigentum

Unverändert gegenüber PROJ-2: Jede Ausgabe gehört genau einer Person, Row Level Security je
Nutzer-ID **zusätzlich** zur Prüfung im Anwendungscode, Löschweitergabe beim Konto.
**Aufbewahrung: bis zur Kontolöschung**, kein automatischer Ablauf — die neuen Felder ändern daran
nichts und führen keine neue Art personenbezogener Daten ein.

---

## Der Kursdienst

### Wo er wirklich liegt

**`https://api.frankfurter.dev/v1`** — nicht `api.frankfurter.app`, wie `docs/PRD.md` und `spec.md`
den Dienst nennen. Die alte Adresse antwortet mit **HTTP 301** auf die neue (nachgemessen am
31.08.2026). Der Name des Dienstes bleibt „Frankfurter"; nur der Host ist ein anderer. Der Abruf folgt
Weiterleitungen **nicht** blind, sondern spricht die neue Adresse direkt an — eine Weiterleitung, der
man automatisch folgt, ist eine Stelle, an der ein fremder Dienst den Zielort bestimmt.

**Kein Schlüssel, kein Konto, keine Registrierung.** Der Dienst ist offen; es gibt nichts zu
hinterlegen und damit auch kein Geheimnis, das schiefgehen kann.

### Was abgefragt wird

Ein einziger HTTP-GET je Erfassung: **das Ausgabedatum, die Fremdwährung als Ziel, EUR als Basis.**
Mehr verlässt die Anwendung nicht — kein Betrag, keine Notiz, keine Kategorie, keine Kennung der
Person. Der Aufruf geschieht **auf dem Server**, nie aus dem Browser: sonst ginge die IP-Adresse der
anfragenden Person an den Dienst, und genau das schließt die Spec aus (TD-6).

Die Antwort trägt zwei Angaben, die beide gespeichert werden: den **Kurs** und das **Datum, für das er
gilt**. Dieses Datum ist die ganze Umsetzung von AC-4 — der Dienst rückt selbst auf den letzten
Werktag zurück und sagt, welcher es war. Nachgemessen:

| Angefragt | Geliefertes Kursdatum |
|---|---|
| Sa 15.08.2026 | **14.08.2026** (Freitag) |
| So 16.08.2026 | **14.08.2026** (Freitag) |
| Mo 17.08.2026 | 17.08.2026 |
| Sa 01.01.2000 (PROJ-2-Untergrenze) | **30.12.1999** |

Es braucht dafür **keine eigene Werktags- oder Feiertagsrechnung** — die wäre der wahrscheinlichste
Ort für einen Fehler, und sie müsste die Feiertage des EZB-Kalenders kennen.

### Die zwei Fehlerklassen — und warum es genau zwei sind

Nachgemessen: Der Dienst antwortet auf **jede** Kombination, für die es keinen Kurs gibt, mit
**HTTP 404** und `{"message":"not found"}` — gleich, ob das Datum außerhalb liegt, die Währung damals
noch nicht veröffentlicht wurde oder der Code gar nicht existiert. Er unterscheidet diese Fälle nicht.
Unterscheidbar sind deshalb nur zwei Klassen, und mehr behauptet der Entwurf auch nicht (EC-3, EC-4):

| Klasse | Woran erkennbar | Was die Person sieht | Hilft ein zweiter Versuch? |
|---|---|---|---|
| **Für diese Währung gibt es zu diesem Datum keinen Kurs** | HTTP 404 · oder HTTP 200, in dem die angefragte Währung fehlt | „Für [Währung] gibt es zum [Datum] keinen Kurs. Bitte prüf das Datum oder wähl eine andere Währung." | **Nein** — und die Meldung behauptet es auch nicht |
| **Der Kurs ist gerade nicht abrufbar** | Netzwerkfehler · Zeitüberschreitung · HTTP 5xx · unlesbare Antwort · Kurs ≤ 0 oder keine Zahl | „Der Wechselkurs ist gerade nicht abrufbar. Bitte versuch es in einem Moment noch einmal — oder trag den Betrag in Euro ein." | **Ja** |

Beide führen zum selben Ergebnis in den Daten: **keine Zeile** (AC-5). Sie unterscheiden sich nur in
dem, was sie der Person zu tun geben — und genau das verlangt EC-4.

**Wartezeit: 5 Sekunden**, danach gilt der Abruf als Störung (EC-2). Begründung in TD-5.

### Die Währungsliste liegt im Code, nicht im Netz

Die 30 Codes und ihre deutschen Namen stehen als feste Liste im Anwendungscode — nach demselben
Muster wie die neun Kategorien aus PROJ-2 (dort TD-2): **Schlüssel in den Daten, Anzeigename im Code.**

Der Grund ist ein harter: Würde die Liste beim Öffnen der Seite vom Dienst geholt, hinge das
Erfassungsformular an dessen Verfügbarkeit — und damit **auch die Euro-Erfassung**. Das verletzt AC-2
unmittelbar. Die Liste ändert sich alle paar Jahre; ein Ausfall passiert häufiger.

Reihenfolge in der Auswahl (AC-1): **EUR, USD, CHF, GBP**, dann die übrigen 26 alphabetisch nach Code.

---

## Die Umrechnung

### Richtung und Genauigkeit — der Kern des Entwurfs

Der Kurs wird als **„1 EUR = X Fremdwährung"** geholt und gespeichert, und der Euro-Betrag entsteht
durch **Division**:

```
Euro-Betrag = Originalbetrag ÷ Kurs        (kaufmännisch auf ganze Cent gerundet)
```

**Warum nicht andersherum** — das ist keine Geschmacksfrage, sondern ein gemessener Fehler. Der Dienst
liefert Kurse auf feste Nachkommastellen. In der Richtung „1 Fremdwährung = X EUR" bleiben bei
Währungen mit großen Zahlen nur zwei signifikante Stellen übrig:

| Weg | 10.000.000 IDR ergeben |
|---|---|
| `1 IDR = 0,000048 EUR`, multipliziert | 480,00 € |
| `1 EUR = 20.628,08 IDR`, dividiert | **484,78 €** |
| Gegenprobe: der Dienst rechnet selbst | **484,78 €** |

Rund **1 % Abweichung**, allein aus der Rundung des Kurses. Betroffen sind IDR, KRW, JPY, HUF, ISK —
alle Währungen, bei denen ein Euro viele Einheiten kostet. Bei USD, CHF und GBP fällt es nicht auf,
aber die Regel muss für alle 30 gelten.

Nebeneffekt, der die Wahl bestätigt: „1 € = 1,1643 USD" ist in Europa **die übliche Leseweise**. Die
technisch richtige Richtung ist zugleich die vertraute.

> **AC-8 verlangt seit dem `/refine` vom 31.08.2026 genau diese Richtung und diese Rechenart.** Der
> ursprüngliche Wortlaut sagte „Originalbetrag × Kurs"; der Vertrag hat nachgezogen, nicht die
> Genauigkeit.

### Rundung (EC-5)

Kaufmännisch auf ganze Cent. Ergibt die Division **weniger als einen halben Cent**, wäre das Ergebnis
0,00 € — dann wird die Ausgabe **abgelehnt** (AC-18) statt still auf null gerundet. Praktisch trifft
das nur Kleinstbeträge in Weichwährungen (etwa 5 IDR).

### Die Grenzen greifen zweimal (AC-17, AC-18)

1. **Auf den Originalbetrag**, vor dem Kursabruf: größer 0, höchstens 9.999.999,99. Ein Betrag, der
   hier scheitert, löst **keinen** Aufruf des fremden Dienstes aus.
2. **Auf den errechneten Euro-Betrag**, nach der Umrechnung: mindestens 0,01 €, höchstens
   9.999.999,99 € — die Grenze, die `expenses` ohnehin erzwingt.

Die Meldung nennt, welche der beiden griff, und bei der zweiten den umgerechneten Wert — sonst wirkt
die Ablehnung eines zulässig aussehenden Betrags willkürlich.

---

## Behaviors & Access

Alle Operationen sind die von PROJ-2; sie bekommen Währung und Kurs dazu. Zugriff unverändert: nur
angemeldet, nur eigene Zeilen, doppelt geprüft (Anwendungscode **und** Row Level Security).

| Operation | Wer | Was PROJ-3 ergänzt |
|---|---|---|
| **Ausgabe anlegen** | angemeldet, für sich selbst | Währung entgegennehmen. Bei `EUR`: **kein** Außenkontakt, Betrag ist der Euro-Betrag. Sonst: Kurs holen, umrechnen, alle vier Felder gemeinsam schreiben. Scheitert der Abruf, wird **nichts** geschrieben |
| **Ausgabe ändern** | nur die eigene | Kurs **nur dann** neu holen, wenn sich Währung **oder** Datum gegenüber der gespeicherten Zeile unterscheiden (AC-12 – AC-14). Der Vergleich passiert gegen die **gelesene Zeile**, nicht gegen das, was das Formular mitschickt |
| **Ausgabe löschen** | nur die eigene | unverändert |
| **Liste, Summen, Monatsübersicht** | nur eigene | unverändert — **null** Kursabrufe |
| **CSV-Export** | nur eigene | vier Spalten mehr — **null** Kursabrufe |

**Abgelehnt wird**, zusätzlich zu allem aus PROJ-2: eine unbekannte Währung, ein nicht ermittelbarer
Kurs, ein Euro-Betrag außerhalb der Grenzen.

**Umstellung auf EUR (AC-16):** Der eingegebene Betrag gilt unmittelbar als Euro-Betrag,
`rate_per_eur` und `rate_date` werden geleert. Die Prüfregel der Datenbank erzwingt genau das.

---

## Anzeige

### Die Zeile in der Liste (AC-7, AC-8)

Nur Fremdwährungszeilen werden zweizeilig; Euro-Zeilen bleiben unverändert (EC-8).

```
  1.073,60 €        Software & Abos        15.08.2026
  1.250,00 USD · 1 € = 1,1643 USD · Kurs vom 14.08.2026
  Jahreslizenz

     42,90 €        Büromaterial           17.08.2026
  Druckerpapier
```

- **Hauptzahl ist der Euro-Betrag** — er trägt die Monatssumme.
- Die Beizeile in gedämpfter Farbe, kleiner Schrift, wie die Notiz.
- **Das Kursdatum steht immer da**, auch wenn es dem Ausgabedatum entspricht (Produktentscheidung).
- Beträge und Kurse werden über `Intl` formatiert, an derselben Stelle wie in PROJ-2 — nichts von
  Hand.

### Monatsübersicht und Summen (AC-9)

**Keine Änderung.** Sie lesen `amount_cents` und wissen von Währungen nichts. Genau das ist der Zweck
des Einfrierens: Die Rechnung von PROJ-2 bleibt eine reine Euro-Rechnung, und AC-10 (spätere Ansicht
zeigt dasselbe) ergibt sich daraus von selbst, ohne eigenen Mechanismus.

---

## Der Export (AC-19)

Vier Spalten hinter den bestehenden, damit die Reihenfolge der alten erhalten bleibt:

```
Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am;Währung;Betrag (Original);Kurs (1 EUR =);Kursdatum
15.08.2026;Software & Abos;1073,60;Jahreslizenz;15.08.2026 09:12;USD;1250,00;1,1643;14.08.2026
17.08.2026;Büromaterial;42,90;Druckerpapier;17.08.2026 10:03;EUR;42,90;;
```

Bei Euro-Ausgaben bleiben Kurs und Kursdatum **leer** — nicht „1,0000". Ein Kurs, den es nie gab,
wäre eine Behauptung. Alle Regeln aus PROJ-2 gelten unverändert: Semikolon, BOM, CRLF, RFC-4180-
Begrenzung, Formelschutz (EC-10 dort).

---

## Gleichzeitigkeit — die Garantie hinter jedem Timing-Fall

| Fall | Was ihn hält |
|---|---|
| **EC-1** — Doppelklick erzeugt eine Zeile mit einem Kurs | Die **Eindeutigkeit auf (Nutzer, Vorgangskennung)** aus PROJ-2. Beide Anfragen holen womöglich je einen Kurs, aber nur **ein** Einfügen gelingt; das zweite verliert an der Datenbank. Der gesperrte Knopf ist die bequemere erste Verteidigung, nicht die tragende |
| **EC-6** — gleicher **Kurstag** ⇒ gleicher Kurs | Ergibt sich aus dem Dienst: Für ein abgeschlossenes Datum ist der EZB-Kurs unveränderlich, und der Zwischenspeicher (TD-11) hält genau diese Fälle fest. Für **heute** kann er sich mit der Veröffentlichung am Nachmittag ändern — dann tragen zwei am selben Tag erfasste Ausgaben verschiedene Kurse mit **verschiedenen Kursdaten**, und die Beizeile macht das sichtbar statt es zu verschweigen. **EC-6 ist seit dem `/refine` vom 31.08.2026 genau so formuliert** und verlangt nicht mehr, was die Veröffentlichungspraxis der EZB nicht hergibt |
| **EC-7** — zwei Tabs, einer stellt die Währung um | Währung, Kurs, Kursdatum und Euro-Betrag werden **in einer einzigen Schreiboperation** gesetzt, nie einzeln. Damit gilt der zuletzt gespeicherte Stand vollständig; eine Mischung aus der Währung des einen und dem Kurs des anderen Tabs kann nicht entstehen (PROJ-2 EC-3, „letzter Stand gewinnt vollständig") |
| **EC-9** — Sitzung abgelaufen / Datenbank weg | Unverändert aus PROJ-2. Die **Reihenfolge** sorgt für unterscheidbare Meldungen: erst Anmeldung, dann Eingaberegeln, dann Kursabruf, dann Datenbank. Ein Kursproblem kann so nie als Datenbankproblem erscheinen |

---

## Zwischenspeicher für Kurse

Kurse für **abgeschlossene** Tage sind unveränderlich, und der Dienst sagt das selbst: seine Antworten
tragen `Cache-Control: public, max-age=86400`. Der Abruf nutzt den **Datencache des Frameworks**,
geschlüsselt über die Abrufadresse (Datum + Währung).

**Die Unterscheidung ist wesentlich (TD-11):**

| Angefragtes Datum | Zwischenspeicher |
|---|---|
| **vor heute** (Europe/Vienna) | dauerhaft wiederverwendbar — der EZB-Kurs eines abgeschlossenen Tages ändert sich nie mehr |
| **heute** | **nicht zwischenspeichern** |

Der Grund für die zweite Zeile ist ein Fehler, der sonst entstünde: Der Kurs des laufenden Tages wird
erst am Nachmittag veröffentlicht. Wer vormittags erfasst, bekommt den Kurs des Vortags — würde diese
Antwort 24 Stunden festgehalten, bekämen **alle** weiteren Erfassungen dieses Tages weiterhin den
Vortageskurs, obwohl der richtige längst vorliegt. Über ein Wochenende wäre er bis zu drei Tage alt.

Das ist kein Vorratsspeicher und keine Kurs-Tabelle — die schließt das Datenmodell ausdrücklich aus.
Es ist die Wiederverwendung einer Antwort, die ohnehin identisch wäre. Wirkung: Wer zehn Belege
eines **vergangenen** Tages in derselben Währung erfasst, löst **einen** Aufruf aus statt zehn. Das
ist zugleich die Antwort auf die offene Frage der Spec nach der Last auf einem kostenlosen fremden
Dienst.

---

## Dependencies

**Keine neuen Pakete.** Der Kursabruf ist ein HTTP-GET mit den Bordmitteln des Frameworks; für die
Formatierung von Beträgen und Kursen ist `Intl` zuständig, das schon in PROJ-2 genutzt wird. Kein SDK,
kein Datumsrechner, keine Währungsbibliothek.

Das ist eine bewusste Entscheidung und keine Auslassung: Eine Währungsbibliothek würde hier vor allem
Genauigkeitsregeln mitbringen, die dieses Design ohnehin selbst festlegt (Ganzzahl-Cent, Division,
kaufmännische Rundung).

## Settings the user makes

**Keine.** Der Kursdienst braucht weder Konto noch Schlüssel, und es gibt nichts, was in einer
fremden Verwaltungsoberfläche einzustellen wäre. PROJ-3 fügt der Liste aus PROJ-1 (`GATE_SECRET`,
`TRUSTED_PROXY_HOPS`) **keine** Umgebungsvariable hinzu.

---

## Technical Decisions

| # | Entscheidung | Begründung | Alternative erwogen | Preis / Abwägung | Datum |
|---|---|---|---|---|---|
| **TD-1** | Der Kurs kommt von **`api.frankfurter.dev/v1`**, nicht von `api.frankfurter.app` | Nachgemessen am 31.08.2026: die alte Adresse antwortet mit HTTP 301 auf die neue. Der Dienst heißt weiter „Frankfurter", nur der Host ist umgezogen | Der Weiterleitung automatisch folgen | Ein fremder Dienst bestimmte dann das Ziel jedes Aufrufs. Die Adresse steht deshalb fest im Code, und ein erneuter Umzug fällt als Fehler auf, statt still woandershin zu zeigen | 2026-08-31 |
| **TD-2** | Der Kurs wird als **„1 EUR = X Fremdwährung"** geholt und gespeichert; der Euro-Betrag entsteht durch **Division** | Die Gegenrichtung verliert bei Währungen mit großen Zahlen Genauigkeit: gemessen **1 % Fehler** bei IDR (480,00 € statt 484,78 €), weil der Kurs dort nur zwei signifikante Stellen hat. Das ist zugleich die Richtung, in der die EZB veröffentlicht und in der Europa Kurse liest | „1 Fremdwährung = X EUR" und Multiplikation — näher am ursprünglichen Wortlaut von AC-8 | Der Vertrag musste nachziehen, nicht die Genauigkeit: **AC-8 ist per `/refine` vom 31.08.2026 auf die Division umgestellt.** Damit besteht kein Widerspruch mehr | 2026-08-31 |
| **TD-3** | Der Kurs wird mit **8 Nachkommastellen** als Dezimalzahl gespeichert, nicht als Gleitkommazahl | Ein Kurs wie 20.628,08 und einer wie 0,85889 müssen beide exakt liegen; Gleitkomma bringt Rundungsfehler in eine Zahl, aus der ein Geldbetrag entsteht. Dieselbe Haltung wie bei `amount_cents` in PROJ-2 | Gleitkommazahl | Etwas mehr Speicher je Zeile — bei einer Handvoll Belegen pro Monat bedeutungslos | 2026-08-31 |
| **TD-4** | **Zwei** unterscheidbare Fehlerklassen, nicht drei | Nachgemessen: Der Dienst antwortet auf „Datum außerhalb", „Währung damals nicht geführt" und „Code unbekannt" **einheitlich mit HTTP 404**. Eine dritte Klasse wäre erfunden | Aus dem Datum selbst ableiten, ob es am Datum oder an der Währung liegt | Eine Herleitung, die den Kalender des Dienstes nachbaut und bei jeder Änderung dort falsch wird. Der Preis der Ehrlichkeit: die Meldung nennt beide möglichen Ursachen („prüf das Datum oder wähl eine andere Währung") | 2026-08-31 |
| **TD-5** | **5 Sekunden** Wartezeit auf den Kursabruf, danach gilt er als Störung | Ein einzelner GET gegen einen zwischengespeicherten Dienst; 5 s sind großzügig genug, dass eine langsame Verbindung nicht grundlos scheitert, und kurz genug, dass die Erfassung nicht hängt. PROJ-1 nutzt für die Datenbank 2 s — über das Internet ist mehr angemessen | 2 s wie bei den Drosselungs-Toren | Bei einem trägen Dienst wartet die Person bis zu 5 s auf die Fehlermeldung. Die Alternative wäre, Erfassungen abzubrechen, die noch geglückt wären | 2026-08-31 |
| **TD-6** | Der Kurs wird **serverseitig** geholt, nie aus dem Browser | Ein Abruf aus dem Browser schickte die **IP-Adresse der Person** an den fremden Dienst. Die Spec sagt zu, dass nichts Personenbezogenes die Anwendung verlässt — das ist die technische Umsetzung dieser Zusage | Abruf im Browser (spart einen Serverweg) | Der Server hat einen Außenaufruf mehr im Erfassungspfad. Das ist der Punkt, nicht der Preis | 2026-08-31 |
| **TD-7** | Die **Währungsliste liegt fest im Code**, sie wird nicht vom Dienst geholt | Würde sie geholt, hinge das Erfassungsformular an der Verfügbarkeit des Dienstes — **auch für Euro-Ausgaben**, was AC-2 unmittelbar verletzt. Dasselbe Muster wie die Kategorien in PROJ-2 (dort TD-2) | Liste beim Seitenaufbau abrufen | Kommt eine Währung dazu, braucht es eine Codeänderung. Die EZB-Liste ändert sich alle paar Jahre; Ausfälle sind häufiger | 2026-08-31 |
| **TD-8** | Eine **Prüfregel über mehrere Spalten** erzwingt: EUR ⇒ kein Kurs · Fremdwährung ⇒ Kurs **und** Kursdatum | Macht den Zustand „Fremdwährung ohne Kurs" **unmöglich** statt unwahrscheinlich, und zwar auch dann, wenn der Anwendungscode umgangen wird. Es ist die Entsprechung der Produktentscheidung „keine Ausgabe ohne Euro-Wert" | Nur im Anwendungscode prüfen | Eine Migration mehr Sorgfalt. Dafür kann keine spätere Änderung — auch keine fehlerhafte — halbe Zeilen hinterlassen | 2026-08-31 |
| **TD-9** | Der **Originalbetrag** wird als Ganzzahl mit **festem Exponenten 2** gespeichert, für jede Währung gleich | Eine Tabelle der Nachkommastellen je Währung (JPY und KRW führen keine) wäre eine zweite Wahrheit, die gepflegt werden müsste. Die Eingaberegel bleibt exakt die von PROJ-2, die die Person schon kennt | Exponent je Währung aus einer Tabelle | Ein Yen-Betrag zeigt „1.500,00 JPY" statt „1.500 JPY". Fachlich unschön, praktisch folgenlos — und die Alternative bringt eine Pflegeaufgabe für alle 30 Währungen | 2026-08-31 |
| **TD-10** | Beim Ändern entscheidet der Vergleich gegen die **gelesene Zeile**, ob ein Kurs neu geholt wird | Nur so ist „hat sich Währung oder Datum geändert?" verlässlich zu beantworten (AC-12 – AC-14). Was das Formular mitschickt, sagt nichts darüber, was vorher dastand | Ein verstecktes Feld im Formular mitführen | Ein Lesevorgang mehr je Änderung — derselbe, den die Berechtigungsprüfung ohnehin macht. Ein verstecktes Feld wäre dagegen vom Browser beeinflussbar | 2026-08-31 |
| **TD-11** | Kurse werden zwischengespeichert, aber **nur für abgeschlossene Tage**: liegt das angefragte Datum vor dem heutigen (Europe/Vienna), wird die Antwort dauerhaft wiederverwendet; ist es **der laufende Tag, wird nicht zwischengespeichert** | Kurse vergangener Tage sind unveränderlich — dort ist Wiederverwendung risikolos und spart Aufrufe (zehn Belege desselben Tages ⇒ **ein** Aufruf). Der Kurs für **heute** ändert sich dagegen mit der Veröffentlichung am Nachmittag: Würde die Vormittagsantwort 24 Stunden festgehalten, bekämen alle späteren Erfassungen dieses Tages **weiterhin den Kurs des Vortags**, obwohl der richtige längst vorliegt — und über ein Wochenende wäre er bis zu drei Tage alt | Pauschal 24 Stunden für jedes Datum, wie es die `Cache-Control`-Kopfzeile des Dienstes nahelegt | Für den laufenden Tag ein Aufruf je Erfassung statt einer für alle. Das ist der Preis dafür, dass eine heutige Ausgabe den aktuellsten veröffentlichten Kurs bekommt — und bei einer Handvoll Belege im Monat sind es einzelne Aufrufe | 2026-08-31 |
| **TD-12** | Bei Euro-Ausgaben ist `amount_original` **gleich** `amount_cents`, nicht leer | Jede Zeile ist gleich aufgebaut; Export und Anzeige brauchen keinen Sonderfall „Euro hat keinen Originalbetrag" | `amount_original` bei EUR leer lassen | Eine redundante Zahl je Euro-Zeile. Dafür entfällt eine Fallunterscheidung an jeder lesenden Stelle | 2026-08-31 |
| **TD-13** | Die Reihenfolge im Erfassungspfad ist **Anmeldung → Eingaberegeln → Kursabruf → Datenbank** | Ein Betrag, der die Regeln reißt, löst **keinen** Aufruf des fremden Dienstes aus, und die Meldungen bleiben unterscheidbar (EC-9): ein Kursproblem kann nie als Datenbankproblem erscheinen | Kurs zuerst holen, dann prüfen | Unnötige Außenaufrufe für Eingaben, die ohnehin abgelehnt werden | 2026-08-31 |

---

## Abdeckung: jedes Kriterium hat eine Stelle

| AC / EC | Wo es umgesetzt wird |
|---|---|
| AC-1 | Währungsfeld in der Erfassungszeile · feste Liste im Code (TD-7) |
| AC-2 | Verzweigung im Anlege-Vorgang: `EUR` überspringt den Kursabruf vollständig |
| AC-3 | Kursabruf + gemeinsames Schreiben aller vier Felder |
| AC-4 | Das vom Dienst gelieferte Kursdatum wird gespeichert, nicht das angefragte |
| AC-5 | Beide Fehlerklassen enden ohne Schreibvorgang; Formularwerte bleiben stehen |
| AC-6 | Rücksetzverhalten der Erfassungszeile (wie Kategorie/Datum in PROJ-2 AC-3) |
| AC-7 | Zweite Zeile in `ExpenseRow`, nur bei Fremdwährung |
| AC-8 | Beizeile zeigt den Kurs als „1 € = X"; die Umrechnung ist die Division aus TD-2 |
| AC-9 | Keine Änderung nötig: Summen lesen `amount_cents` |
| AC-10 | Ergibt sich aus dem Einfrieren; kein eigener Mechanismus |
| AC-11 | Währungsfeld im Änderungsdialog |
| AC-12 | Vergleich gegen die gelesene Zeile (TD-10), dann Neuabruf |
| AC-13 | Kein Neuabruf; Euro-Betrag aus bestehendem Kurs neu gerechnet |
| AC-14 | Kein Neuabruf, keine Änderung an den vier Feldern |
| AC-15 | Fehlgeschlagener Abruf bricht die Änderung ab, bevor geschrieben wird |
| AC-16 | Leeren von Kurs und Kursdatum, erzwungen durch die Prüfregel (TD-8) |
| AC-17 | Eingaberegel auf den Originalbetrag, **vor** dem Kursabruf (TD-13) |
| AC-18 | Prüfung des errechneten Euro-Betrags nach der Umrechnung |
| AC-19 | Vier zusätzliche Spalten im CSV-Export |
| EC-1 | Eindeutigkeit auf (Nutzer, Vorgangskennung) aus PROJ-2 |
| EC-2 | 5-Sekunden-Grenze (TD-5) |
| EC-3 | Kurs ≤ 0, fehlend oder unlesbar zählt als Störung, nicht als Kurs |
| EC-4 | HTTP 404 als eigene, dauerhafte Fehlerklasse (TD-4) |
| EC-5 | Kaufmännische Rundung; Ergebnis unter 0,01 € wird abgelehnt |
| EC-6 | Unveränderlichkeit abgeschlossener EZB-Tage + Cache (TD-11) |
| EC-7 | Alle vier Felder in einer Schreiboperation |
| EC-8 | Additive Felder; bestehende Zeilen bleiben `EUR` ohne Kurs |
| EC-9 | Reihenfolge im Erfassungspfad (TD-13) |

---

## Offene Punkte

- [x] **AC-8 muss umformuliert werden, bevor gebaut wird.** ~~Er sagt „Originalbetrag × Kurs" …~~
  **Erledigt durch `/refine PROJ-3` am 31.08.2026:** AC-8 verlangt jetzt die Richtung
  „1 EUR = X Fremdwährung" und die Division. TD-2 und der Vertrag sind wieder deckungsgleich.
- [x] **Der Kurs für heute kann sich im Tagesverlauf ändern** (EZB veröffentlicht nachmittags).
  ~~EC-6 ist damit für vergangene Tage erfüllt, für „heute" nur mit dieser Einschränkung.~~
  **Erledigt durch dasselbe `/refine`:** EC-6 gilt jetzt je **Kurstag** statt je Ausgabetag und
  benennt den Vormittagsfall ausdrücklich. Zusätzlich hat der Punkt einen Fehler in diesem Entwurf
  aufgedeckt — der Zwischenspeicher hätte den Vortageskurs 24 Stunden festgehalten; **TD-11 wurde
  daraufhin korrigiert** (heutiges Datum wird nicht zwischengespeichert).
- [ ] **Die Währungsliste ist datumsabhängig, die Auswahl im Formular ist es nicht.** Gemessen: Zum
  03.01.2000 fehlen BRL, CNY, ILS und INR; zum 04.01.2010 fehlt ISK. Wer eine solche Kombination
  wählt, bekommt die 404-Meldung aus TD-4 — sachlich richtig, aber erst nach dem Absenden. Eine vom
  Datum abhängige Auswahlliste wäre die Alternative; für den Zeitrahmen und die realistische
  Nutzung (Belege der letzten Monate) ist sie nicht vorgesehen.

---

## Notizen aus dem Bau (`/build`, 2026-08-31)

Der Entwurf hat gehalten; die Abweichungen sind klein und benannt.

**Drei Dinge, die der Bau am Entwurf nachgeschärft hat**

1. **`toEuroCents` gibt den umgerechneten Betrag auch bei einer Ablehnung zurück.** AC-18
   verlangt, dass die Meldung den Wert nennt („Das sind umgerechnet 19.999.999,98 € …"). Ohne ihn
   wirkt die Ablehnung eines in seiner Währung zulässigen Betrags willkürlich.
2. **Die Betragsgrenze meldet sich ohne Währungszeichen.** Sie lautete „höchstens 9.999.999,99 €";
   bei ausgewähltem Dollar ist das schlicht falsch, denn die Grenze gilt für den Betrag in
   **seiner** Währung (AC-17). Ein bestehender Test aus PROJ-2 prüfte den Wortlaut und wurde
   mitgezogen. PROJ-2 AC-29 bleibt erfüllt — es beschreibt den Betrag, nicht den Meldungstext.
3. **Der Änderungsdialog belegte den Betrag aus `amount_cents` vor.** Bei einer
   Fremdwährungsausgabe hätte dort der **Euro**-Betrag gestanden statt der eingegebenen
   1.250,00 USD. Jetzt kommt er aus `amount_original`; bei Euro sind beide ohnehin gleich (TD-12).

**Eine Lücke im Aufgabenplan, aufgedeckt beim Bauen**

`tasks.md` sah Tests nur für die drei *neuen* Dateien vor — nicht für `actions/expenses.test.ts`,
die den von T8 geänderten Code prüft. Aufgefallen ist es, als T8 den bestehenden Test rot machte.
Nachgetragen als **T16**, samt Lehre für den nächsten Plan (siehe `tasks.md`, Nachtrag).

**Was `/qa` besonders ansehen sollte**

- **Der Fremdwährungsweg durch einen echten Browser ist nicht belegt.** Radix füllt das versteckte
  native Auswahlfeld erst im Browser; serverseitig steht dort nichts. Für **Euro** ist der Weg
  durch PROJ-2s E2E-Journey 1 gedeckt (sie erfasst über dieselbe Zeile), für eine **ausgewählte
  Fremdwährung** nicht. Der Anwendungscode fängt eine fehlende Angabe als Euro ab, ein still nach
  Euro gekippter Dollar-Beleg wäre aber ein ernster Fehler — gehört in `/e2e-tests`.
- **Die Beizeile ist als Markup geprüft, nicht als Bild.** Die Betragsspalte wurde von `w-32` auf
  `w-56` verbreitert, damit Kurs und Kursdatum nicht umbrechen; wie das auf 375 px wirkt, ist offen.
- **Der Höchstbetrag beißt bei Weichwährungen früh.** 9.999.999,99 IDR sind rund 484 €; größere
  Rupiah-Beträge lassen sich nicht erfassen. Das ist genau, was AC-17 sagt (die Grenze gilt auf den
  Originalbetrag), aber es ist eine spürbare Folge, die niemand beim Schreiben der Spec vor Augen
  hatte.

**Gemessen am Ende des Baus:** 209 Unit- und Integrationstests grün (vorher 164), 18 von 18 E2E
grün als Regression gegen PROJ-1 und PROJ-2, Lint und Build ohne Befund. Für die neuen Tests wurde
der Rot-Nachweis geführt: sieben gezielte Brüche an `rate.ts` und `actions/expenses.ts`, jeder von
genau dem Test gefangen, der ihn verhindern soll.

---

## Nachtrag: die Behebungen aus `/e2e-tests` (01.09.2026)

**TD-14 (neu): Die Erfassungszeile schickt über `onSubmit` ab, nicht über `action=`.**

| | |
|---|---|
| **Entscheidung** | `<form onSubmit={…}>` mit `startTransition(() => formAction(formData))` statt `<form action={formAction}>` |
| **Begründung** | React 19 setzt ein Formular nach einer Server Action **automatisch** zurück. Radix hängt zu jedem `Select` in einem Formular ein **unkontrolliertes** natives Auswahlfeld ein und reicht dessen `change`-Ereignis über `onValueChange` in den React-Zustand zurück (`@radix-ui/react-select`, `index.mjs:1122` und `:1126`). Das Zurücksetzen löschte damit Währung **und** Kategorie. Die einfachen Eingabefelder blieben verschont, weil sie kontrolliert sind — genau dieses Muster war messbar |
| **Alternative erwogen** | Das versteckte Feld per `form="…"` einem nicht existierenden Formular zuordnen. Funktionierte in Chromium und **brach die Auswahlliste in WebKit** — zu clever und von Radix-Interna abhängig |
| **Preis** | Ein `preventDefault()` mehr. Abgeschickt wird weiter per POST über dieselbe Server Action; die Zusicherung „Formulare senden nie nativ per GET" bleibt unberührt |

**Warum das erst der Browser zeigen konnte.** Der Fehler lebt ausschließlich im Zustand der
Oberfläche nach einem Formular-Zurücksetzen. Weder `/build` noch `/qa` konnten ihn sehen: Beide
haben aus dem Quelltext geschlossen, dass „der Rücksetz-Effekt die Währung nicht anfasst" — was
stimmte und trotzdem das Falsche bewies. **Die Kategorie verhielt sich seit PROJ-2 so**, und PROJ-2s
eigener E2E-Test prüfte unter der Überschrift „AC-3" Betrag, Notiz, Datum und Fokus — nur die
Kategorie nicht. Diese Zusicherung ist jetzt nachgetragen (T20).
