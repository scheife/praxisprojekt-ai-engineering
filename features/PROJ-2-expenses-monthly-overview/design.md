# PROJ-2 — Technisches Design: Ausgaben & Monatsübersicht

<!-- Dies ist das technische Design (das WIE). Zwei Leser: die Produktseite (muss zustimmen) und
     /build (baut direkt dagegen). Kein Code — aber baureif genau.
     Der Vertrag (das WAS) steht in spec.md, die Aufgabenliste in tasks.md.
     Kein Status- oder Datumsfeld hier — der Status lebt ausschließlich in features/INDEX.md. -->

## Überblick in drei Sätzen

Der angemeldete Bereich `/` wird **eine einzige Seite**, die ihren Monat aus der Adresse liest, alle
Ausgaben dieses Monats in **einer** Abfrage holt und Gesamtsumme wie Kategoriesummen daraus im
Anwendungscode rechnet — in ganzzahligen Cent, damit keine Rundung entstehen kann. Erfassen, Ändern
und Löschen laufen über **Server Actions**, die nach dem Schreiben `refresh()` aufrufen; damit stimmen
Liste und Summen ohne Neuladen, ohne dass eine zweite Wahrheit im Browser gepflegt werden müsste. Der
Zugriffsschutz kopiert das Muster, das PROJ-1 an `profiles` etabliert hat: Row Level Security in der
Datenbank **plus** die Prüfung von Anmeldung und Zugehörigkeit in jeder Server Action — zwei
unabhängige Schichten, nicht eine.

---

## Component Structure

```
/  (angemeldet — ersetzt die Platzhalterseite von PROJ-1)
+-- page.tsx  (Server)
|   +-- requireUser()                     Zugriffsschutz, unverändert von PROJ-1
|   +-- Monat aus ?monat= auflösen        ungültig/fehlend -> laufender Monat (AC-19)
|   +-- <Suspense fallback=MonthViewSkeleton>
|       +-- MonthView  (Server)           zwei Abfragen: Monatszeilen + ältester eigener Monat
|           +-- AppHeader  (Server)
|           |   +-- Wordmark                          (PROJ-1, wiederverwendet)
|           |   +-- MonthSwitcher  (Client)           ‹ August 2026 ›  (AC-17, AC-18)
|           |   +-- Link „Konto"
|           |   +-- LogoutButton                      (PROJ-1, dieselbe Server Action)
|           +-- MonthPanel  (Client)      hält den Kategoriefilter (AC-15)
|               +-- MonthTotal            Gesamtsumme, einzige Zahl in 2xl   (AC-13)
|               +-- CategoryBreakdown     je belegter Kategorie eine Zeile   (AC-14, AC-15)
|               |   +-- CategoryRow       Name · Anteilsbalken · Summe · Prozent, anklickbar
|               +-- ExpenseComposer  (Client)   die dauerhafte Erfassungszeile (AC-1 – AC-9)
|               |   +-- Betrag · Kategorie · Datum · Notiz · Button „Erfassen"
|               |   +-- Hinweis unter der Notiz                              (AC-28)
|               +-- ExpenseList
|                   +-- ExpenseRow        Datum · Kategorie · Notiz · Betrag · Ändern · Löschen
|                   |   +-- EditExpenseDialog    (Client)                    (AC-20, AC-21)
|                   |   +-- DeleteExpenseDialog  (Client)                    (AC-22, AC-23)
|                   +-- EmptyState        ausformuliert, statt leerer Tabelle (AC-12)

/konto  (angemeldet — gehört PROJ-1, PROJ-2 ergänzt zwei Dinge)
+-- AppHeader                             neu, ohne Monatswechsler          (Entscheidung TD-20)
+-- Card „Konto"                          unverändert (PROJ-1)
+-- Card „Deine Daten mitnehmen"          neu, gehört PROJ-2                (AC-27)
|   +-- Erklärsatz + Link-Button „Ausgaben als CSV herunterladen"
+-- Card „Konto löschen"                  unverändert (PROJ-1)

/konto/export  (angemeldet, neue Route, keine Oberfläche)
+-- Route Handler: erzeugt die CSV-Datei bei jedem Abruf neu               (AC-27)
```

**Vorhandene shadcn/ui-Bausteine — werden benutzt, nie nachgebaut:** `button`, `input`, `label`,
`select`, `dialog`, `alert-dialog`, `table`, `skeleton`, `card`, `sonner`. **Kein neuer
shadcn-Baustein und kein neues Paket** — siehe *Dependencies*.

**Aus PROJ-1 unverändert übernommen:** `Wordmark`, `requireUser()`, der Supabase-Server-Client, die
Abmelde-Action, `proxy.ts`, der Toaster im Wurzel-Layout, die Farb-Tokens.

---

## Routen und Zugriffsschutz

| Route | Abgemeldet | Angemeldet | Gerendert |
|---|---|---|---|
| `/` | Weiterleitung auf `/login` (PROJ-1) | Monatsansicht | dynamisch, `no-store` |
| `/konto` | Weiterleitung auf `/login` (PROJ-1) | Kontoseite + Export-Abschnitt | dynamisch, `no-store` |
| `/konto/export` | Weiterleitung auf `/login` (PROJ-1) | CSV-Download | dynamisch, `no-store` |

Die Vorprüfung in `proxy.ts` greift auf allen drei Routen bereits ohne Änderung — ihr Muster erfasst
alles außer den statischen Auslieferungen. **Trotzdem prüft jede Seite, jede Server Action und der
Export-Handler selbst noch einmal** über `requireUser()`; die Vorprüfung liest nur ein Cookie und
weiß nicht, ob das Konto noch existiert (PROJ-1, TD-2). Damit ist EC-5 ohne eigenen Code erfüllt: die
Weiterleitung geht auf `/login?reason=session-expired`, und den Hinweistext zeigt die Seite von PROJ-1.

---

## Data Model

### `expenses` — eine einzelne Geschäftsausgabe

```
Jede Ausgabe hat:
- id            (UUID, Primärschlüssel, Vorgabe: neu erzeugt)
- user_id       (UUID, Pflicht, Fremdschlüssel auf profiles.id mit Löschweitergabe)
- amount_cents  (ganze Zahl, Pflicht, mindestens 1, höchstens 999.999.999
                 — der Betrag in Cent, nie als Dezimalzahl gespeichert)
- category      (Text, Pflicht, genau einer der neun Schlüssel aus der Tabelle unten,
                 in der Datenbank über eine Prüfregel erzwungen)
- spent_on      (Datum ohne Uhrzeit, Pflicht, frühestens 2000-01-01
                 — der Tag, an dem ausgelegt wurde)
- note          (Text, darf fehlen, höchstens 200 Zeichen; leere Eingabe wird als
                 „fehlt" gespeichert, nicht als leerer Text)
- client_token  (UUID, Pflicht — die Vorgangskennung des Erfassungsvorgangs, siehe EC-1)
- created_at    (Zeitstempel mit Zeitzone, Pflicht, Vorgabe: jetzt)

Gehört: genau einer Person — der, die die Ausgabe angelegt hat.
Zugriff: Lesen, Anlegen, Ändern und Löschen ausschließlich der eigenen Zeilen (Vergleich von
         user_id mit der angemeldeten Nutzer-ID). Für Abgemeldete keinerlei Recht.
Aufbewahrung: bis zur Kontolöschung. Kein automatischer Ablauf. Die Löschweitergabe von
         auth.users über profiles räumt sie mit (AC-26).
Eindeutig: (user_id, client_token) — dieselbe Vorgangskennung kann pro Person nur einmal
         zu einer Zeile werden.
Indizes: (user_id, spent_on absteigend, created_at absteigend) — bedient die Monatsabfrage,
         die Sortierung aus AC-11 und die Suche nach dem ältesten Monat aus AC-18 in einem.
```

**Kein `updated_at`.** Kein Kriterium braucht den Zeitpunkt der letzten Änderung, keine Oberfläche
zeigt ihn, der Export nennt ihn nicht. Ein Feld, das niemand liest, ist trotzdem eine Angabe über das
Verhalten der Person — das billigste Datenschutzmittel ist, es gar nicht erst anzulegen
(Art. 5 Abs. 1 lit. c DSGVO, gleiche Begründung wie PROJ-1, TD-8).

**Kein Speichern der Währung.** Diese Spec kennt nur Euro. Währung, eingefrorener Kurs und Kursdatum
kommen mit PROJ-3 als zusätzliche Felder dazu — additiv, ohne eine Regel hier umzukehren.

### Die neun Kategorien

In der Datenbank steht ein **stabiler englischer Schlüssel**, in der Oberfläche und im Export der
deutsche Name. Die Zuordnung lebt an genau **einer** Stelle im Code (`src/lib/expenses/categories.ts`)
und ist die einzige Quelle für Auswahlfeld, Liste, Übersicht, Export und Prüfregel.

| Schlüssel | Anzeigename |
|---|---|
| `office_supplies` | Büromaterial |
| `software` | Software & Abos |
| `hardware` | Hardware & Geräte |
| `travel` | Reise & Fahrt |
| `hospitality` | Bewirtung |
| `education` | Fortbildung |
| `marketing` | Marketing & Werbung |
| `fees` | Gebühren & Beiträge |
| `other` | Sonstiges |

Die Reihenfolge in dieser Tabelle ist auch die Reihenfolge im Auswahlfeld — sie folgt der Liste aus
`docs/data-model.md`, nicht dem Alphabet.

### Zugriff auf Datenbankebene (AC-24)

Row Level Security ist eingeschaltet, mit **vier** Policies für die Rolle `authenticated` — Lesen,
Anlegen, Ändern, Löschen —, die alle dieselbe Bedingung tragen: die angemeldete Nutzer-ID muss der
`user_id` der Zeile entsprechen; beim Anlegen und Ändern zusätzlich als Bedingung für die
**geschriebene** Zeile, damit sich eine Ausgabe nicht an eine fremde Person weiterreichen lässt. Die
Rolle `anon` bekommt keinerlei Recht. Wie bei PROJ-1 wird die Nutzer-ID in ein Subselect gewickelt,
damit Postgres sie einmal je Abfrage auswertet statt einmal je Zeile.

Damit gilt AC-24 auch dann, wenn jemand den Anwendungscode umgeht und mit dem öffentlichen Schlüssel
direkt gegen die Datenbank spricht — genau der Fall, den `docs/stacks/backend-supabase.md` als den
häufigsten echten Supabase-Fehler beschreibt.

### Was die Datenbank prüft und was der Anwendungscode prüft

| Regel | Datenbank | Anwendungscode | Warum |
|---|---|---|---|
| Kategorie aus der festen Liste | ✅ Prüfregel | ✅ Schema | AC-10 verlangt es ausdrücklich „auch wenn der Anwendungscode umgangen wird" |
| Betrag größer 0, höchstens 9.999.999,99 € | ✅ Prüfregel | ✅ Schema | unveränderliche Bedingung, kostet nichts |
| Notiz höchstens 200 Zeichen | ✅ Prüfregel | ✅ Schema | unveränderliche Bedingung, kostet nichts |
| Datum nicht vor dem 01.01.2000 | ✅ Prüfregel | ✅ Schema | unveränderliche Bedingung |
| **Datum nicht in der Zukunft** | ❌ | ✅ Schema | „heute" bewegt sich; eine Prüfregel, die von der Uhr abhängt, ist beim Wiedereinspielen einer Sicherung nicht reproduzierbar (TD-3) |
| Zugehörigkeit der Zeile | ✅ RLS | ✅ eigene Bedingung in jeder Abfrage | AC-24 und AC-25 verlangen beide Schichten |

---

## Behaviors & Access

```
Operationen:

- Ausgabe anlegen (Betrag, Kategorie, Datum, Notiz, Vorgangskennung)
  Wer: jede angemeldete Person, immer für sich selbst — die Nutzer-ID kommt aus der
       Sitzung, nie aus dem Formular.
  Prüft: Anmeldung, dann alle Feldregeln, dann schreibt.
  Antwort: der Monat der gespeicherten Ausgabe (damit die Ansicht ihm folgen kann, AC-4).
  Ist die Vorgangskennung schon einmal zu einer Zeile geworden, gilt der Vorgang als
  erledigt — es entsteht keine zweite Ausgabe und kein Fehler (EC-1).

- Ausgabe ändern (Kennung der Ausgabe, Betrag, Kategorie, Datum, Notiz)
  Wer: nur die Person, der die Ausgabe gehört.
  Prüft: Anmeldung, Feldregeln (dieselben wie beim Anlegen, AC-21), Zugehörigkeit.
  Schreibt: alle vier Felder in einer Anweisung — nie feldweise (EC-3).
  Antwort: der Monat nach der Änderung; betrifft keine Zeile, dann „gibt es nicht mehr" (EC-2).

- Ausgabe löschen (Kennung der Ausgabe)
  Wer: nur die Person, der die Ausgabe gehört.
  Prüft: Anmeldung, Zugehörigkeit.
  Antwort: gelöscht, oder „gibt es nicht mehr", wenn keine Zeile betroffen war (EC-2).

- Monat lesen (Monat)
  Wer: jede angemeldete Person, immer nur die eigenen Zeilen.
  Liefert: alle eigenen Ausgaben mit spent_on innerhalb des Monats, absteigend nach
  spent_on, bei gleichem Datum absteigend nach created_at (AC-11).

- Ältesten eigenen Monat lesen
  Wer: jede angemeldete Person, für sich selbst.
  Liefert: das kleinste spent_on der eigenen Ausgaben, oder nichts. Bedient die
  Rückwärtsgrenze aus AC-18 und rückt nach dem Löschen von selbst nach (EC-8).

- Export erzeugen
  Wer: jede angemeldete Person, für sich selbst.
  Liefert: eine CSV-Datei mit E-Mail-Adresse, Registrierungsdatum und allen eigenen
  Ausgaben. Wird bei jedem Abruf erzeugt und nirgends abgelegt (AC-27).

Abgelehnt wird: nicht angemeldet (Weiterleitung auf /login), eine Ausgabe, die einer
anderen Person gehört (die Datenbank liefert keine Zeile — dieselbe Meldung wie
„gibt es nicht mehr", damit die Existenz fremder Ausgaben nicht ausplaudert wird),
und jede Eingabe, die eine Feldregel verletzt.
```

**Die Nutzer-ID steht nie im Formular.** Sie kommt in jeder Operation aus der geprüften Sitzung. Ein
Feld, das sie transportiert, wäre ein Feld, das sich fälschen ließe.

---

## Eingaberegeln und Fehlermeldungen

Alle Regeln stehen **einmal**, in einem serverseitigen Schema (`src/lib/validation/expense.ts`), und
gelten für das Erfassen wie für den Änderungsdialog (AC-21). Die Formulare verzichten wie bei PROJ-1
auf die browsereigene Prüfung, damit die Meldungen aus einer Quelle kommen.

### Betrag (AC-5, AC-6)

Gelesen wird ein Text, nicht eine Zahl. Die Umwandlung folgt einer festen Regel:

1. Leerzeichen (auch geschützte) und ein `€` werden entfernt.
2. Kommen **Komma und Punkt beide** vor, ist das **rechteste** der beiden das Dezimaltrennzeichen;
   jedes Vorkommen des anderen wird als Tausendertrennzeichen entfernt (`1.284,50` → `1284.50`).
3. Kommt nur **eines** von beiden vor, ist es das Dezimaltrennzeichen (`1284,50` und `1284.50`
   ergeben denselben Wert, AC-6). Kommt es mehr als einmal vor, ist die Eingabe ungültig.
4. Übrig bleiben müssen Ziffern mit höchstens zwei Nachkommastellen.

| Fall | Meldung am Betragsfeld |
|---|---|
| leer | „Bitte gib einen Betrag ein." |
| nicht lesbar | „Bitte gib den Betrag als Zahl ein, zum Beispiel 24,90." |
| mehr als zwei Nachkommastellen | „Höchstens zwei Nachkommastellen — zum Beispiel 24,90." |
| 0 oder negativ | „Der Betrag muss größer als 0 sein." |
| über 9.999.999,99 € | „Der Betrag darf höchstens 9.999.999,99 € sein." |

### Kategorie (AC-8, AC-10)

| Fall | Meldung am Kategoriefeld |
|---|---|
| nicht gewählt | „Bitte wähl eine Kategorie." |
| kein bekannter Schlüssel | „Diese Kategorie gibt es nicht." |

Der zweite Fall ist über die Oberfläche nicht erreichbar — er fängt den direkten Aufruf ab. Die
Datenbank lehnt ihn zusätzlich ab (AC-10).

### Datum (AC-7)

| Fall | Meldung am Datumsfeld |
|---|---|
| leer oder nicht lesbar | „Bitte gib ein Datum ein." |
| nach heute | „Das Datum darf nicht in der Zukunft liegen." |
| vor dem 01.01.2000 | „Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl." |

„Heute" ist das aktuelle Datum in **Europe/Vienna**, auf dem Server bestimmt — nie aus der Uhr des
Browsers (EC-6).

### Notiz (AC-9, AC-28)

| Fall | Meldung am Notizfeld |
|---|---|
| länger als 200 Zeichen | „Die Notiz darf höchstens 200 Zeichen haben." |

Leer ist immer zulässig. Unter dem Feld steht dauerhaft sichtbar, nicht erst im Fehlerfall:

> „Keine Namen anderer Personen und nichts Sensibles wie Gesundheitsangaben — eine kurze
> Beschreibung reicht."

### Formularweite Meldungen

| Fall | Meldung über dem Formular |
|---|---|
| Datenbank nicht erreichbar (EC-4) | „Das Speichern hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal." |
| Ausgabe nicht mehr vorhanden (EC-2) | „Diese Ausgabe gibt es nicht mehr." |
| mehrere Felder betroffen | zusätzlich eine zusammenfassende Zeile, wie `docs/app-shell.md` es vorschreibt |

### Rückmeldungen als Toast (unten rechts, wie im Rahmen festgelegt)

| Anlass | Text |
|---|---|
| Ausgabe in einem anderen Monat erfasst (AC-4) | „Erfasst — die Ansicht steht jetzt auf Juli 2026." |
| Ausgabe beim Ändern in einen anderen Monat verschoben (EC-11) | „Gespeichert — die Ausgabe liegt jetzt im Juli 2026." |
| Ausgabe gelöscht (AC-23) | „Ausgabe gelöscht." |

Das Erfassen **im angezeigten Monat** bekommt bewusst keinen Toast: die neue Zeile erscheint sofort in
der Liste, und die Summe darüber ändert sich — eine Meldung, die dasselbe noch einmal sagt, ist im
Sekundentakt des Nachtragens nur Lärm.

---

## Die Erfassungszeile im Einzelnen

Sie steht dauerhaft sichtbar über der Liste (Produktentscheidung der Spec) und hält ihre vier Felder
im Browserzustand, damit nach einem Fehler nichts verloren geht (EC-4).

**Vorbelegung des Datums (AC-2):** steht die Ansicht auf dem laufenden Monat, ist heute vorbelegt;
steht sie auf einem früheren Monat, der erste Tag dieses Monats. Der Wert kommt vom Server, damit er
in Europe/Vienna gerechnet ist.

**Nach dem Speichern (AC-3):** Betrag und Notiz werden geleert, Kategorie und Datum bleiben stehen,
der Eingabefokus springt zurück ins Betragsfeld, und für den nächsten Vorgang wird eine **neue**
Vorgangskennung erzeugt.

**Die eine Regel, die AC-2 und AC-3 zusammen erfüllt:** die Zeile behält ihr Datum, **solange es im
angezeigten Monat liegt**; liegt es außerhalb, fällt sie auf die Vorbelegung nach AC-2 zurück. Nach
einer Erfassung, die die Ansicht mitgezogen hat (AC-4), liegt das eingegebene Datum im nun
angezeigten Monat — es bleibt also stehen. Nach einem Monatswechsel über die Pfeile liegt es
außerhalb — die Vorbelegung greift. Ohne diese Regel widersprächen sich AC-2 und AC-3.

**Doppelklick (EC-1):** der Button ist während des Absendens gesperrt — das fängt den zweiten Klick
in der Oberfläche ab, wie bei PROJ-1 (TD-9). Gehen trotzdem zwei Anfragen durch, greift die
Vorgangskennung: beide tragen dieselbe, die Eindeutigkeitsregel lässt nur die erste zu Zeile werden,
und die zweite Anfrage erkennt daran „schon erledigt" und meldet Erfolg. Genau eine Ausgabe, kein
Fehler.

---

## Die Monatsrechnung

### Zeitzone (EC-6)

- `spent_on` ist ein **reines Datum ohne Uhrzeit**. Damit kann es beim Anzeigen gar nicht erst in eine
  andere Zeitzone rutschen — der 1. bleibt der 1., egal wo der Server steht.
- „Heute" und „der laufende Monat" werden auf dem Server als aktuelles Datum in **Europe/Vienna**
  bestimmt. Am 1. um 00:30 Uhr Wiener Zeit ist das der neue Monat, auch wenn der Server in UTC noch
  im alten steht.
- Die Monatsgrenzen sind der erste und der letzte Tag des Monats, beide eingeschlossen.

### Summen (AC-13, AC-14, AC-16, EC-7)

Eine Abfrage holt die Zeilen des Monats. Aus **denselben** Zeilen entstehen:

- die **Gesamtsumme** als Summe aller `amount_cents` — ganzzahlig, also ohne jede Rundung;
- die **Kategoriesummen** als Summe der `amount_cents` je Kategorie, absteigend sortiert; bei
  gleichem Betrag entscheidet der Anzeigename alphabetisch, damit die Reihenfolge stabil ist;
- Kategorien **ohne** Betrag erscheinen nicht (AC-14);
- der **Prozentanteil** als kaufmännisch gerundeter Anteil an der Gesamtsumme — nur für die Anzeige.

Weil beide Summen aus derselben Liste in Cent gerechnet werden, ergeben die Kategoriesummen exakt die
Gesamtsumme; nur die Prozentwerte dürfen sich auf 99 % oder 101 % addieren (EC-7).

Die Rechnung liegt in einer eigenen, reinen Funktion (`src/lib/expenses/summary.ts`) — sie hängt an
keiner Datenbank und keiner Oberfläche und lässt sich deshalb von `/qa` direkt prüfen.

### Darstellung

- Beträge: `Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`,
  danach ein geschütztes Leerzeichen und `€` — also `1.284,50 €`. Bewusst **nicht** über
  `style: 'currency'`: das stellt in `de-AT` das Zeichen voran (`€ 1.284,50`) und widerspricht
  `docs/design-system.md` §5.
- Alle Beträge mit Tabellenziffern und rechtsbündig, die Gesamtsumme als einzige Zahl in `2xl`.
- Datum in der Liste: `14.08.2026`. Monatsname im Wechsler: `August 2026`.
- Die Kategoriezeilen tragen einen schmalen Anteilsbalken in der Olive-Rampe **nach Rang**
  (`chart-1` für die größte Kategorie bis `chart-5`, alles darunter in `--muted-foreground`) — so
  festgelegt in `docs/design-system.md` §6.2. Kein Regenbogen, kein Amber: Amber bleibt für PROJ-3
  reserviert.

---

## Monatsnavigation

- Der Monat steht als `?monat=YYYY-MM` in der Adresse (AC-17). Die Pfeile sind echte Links, damit
  Neuladen, Lesezeichen und der Zurück-Button funktionieren.
- **Ohne** Angabe, mit unbekanntem Format oder mit einem Monat, den es nicht gibt (`2026-13`), wird
  der laufende Monat angezeigt — **ohne Weiterleitung**, einfach als aufgelöster Wert (AC-19). Eine
  Weiterleitung wäre eine zweite Stelle, an der sich ein Kreis schließen könnte.
- **Vorwärtspfeil:** inaktiv, sobald der angezeigte Monat der laufende ist (AC-18). Weiter geht es
  nicht, weil Datumsangaben in der Zukunft ausgeschlossen sind.
- **Rückwärtspfeil:** aktiv genau dann, wenn es eine eigene Ausgabe mit einem Datum **vor** dem ersten
  Tag des angezeigten Monats gibt. Gibt es keine Ausgabe, ist er inaktiv. Damit rückt die Grenze nach
  dem Löschen der letzten Ausgabe eines Monats von selbst nach (EC-8) — sie wird bei jedem Aufbau neu
  bestimmt, nicht gespeichert.
- Beide Pfeile bleiben **sichtbar**, wenn sie inaktiv sind (AC-18), und tragen im inaktiven Zustand
  eine Erklärung für Screenreader („Weiter geht es nicht — das ist der laufende Monat.").

---

## Der Kategoriefilter (AC-15)

Der Filter lebt im **Browserzustand** der Monatsansicht, nicht in der Adresse. Ein Klick auf eine
Kategoriezeile blendet in der Liste darunter nur noch deren Ausgaben ein, ein zweiter Klick auf
dieselbe Zeile hebt ihn auf. **Gesamtsumme und Kategoriezeilen bleiben ungefiltert** — sie sind der
Maßstab, gegen den gefiltert wird; sie mitzufiltern würde jede Zeile auf 100 % setzen.

Die Kategoriezeilen sind Schaltflächen mit einem gedrückt/nicht-gedrückt-Zustand für Screenreader.
Ein Monatswechsel setzt den Filter zurück — der neue Monat hat andere Kategorien.

---

## Der Export (AC-27, EC-10)

**Route:** `GET /konto/export`, ein Route Handler ohne Oberfläche. Er prüft zuerst die Anmeldung,
liest E-Mail-Adresse und Registrierungsdatum aus der Sitzung und aus `profiles`, holt alle eigenen
Ausgaben in derselben Reihenfolge wie die Liste und antwortet mit der Datei. Nichts wird abgelegt —
die Datei entsteht bei jedem Abruf neu (Technical Requirement der Spec).

**Kopfzeilen der Antwort:** `text/csv; charset=utf-8` · als Anhang mit dem Dateinamen
`auslage-export-JJJJ-MM-TT.csv` · `Cache-Control: no-store`.

**Aufbau der Datei** (so vom Nutzer entschieden):

```
Konto;person@example.at
Registriert am;27.08.2026

Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am
14.08.2026;Software & Abos;29,00;Hosting;14.08.2026 09:12
03.08.2026;Bewirtung;42,50;"Mittagessen, Kunde";03.08.2026 14:38
```

**Die Regeln, an denen es sonst scheitert:**

- **Trennzeichen ist das Semikolon**, nicht das Komma — bei deutschsprachigen Zahlen mit
  Dezimalkomma ist alles andere eine Falle.
- **Ein BOM am Dateianfang**, damit Excel die Umlaute nicht zerlegt.
- **Zeilenenden CRLF** und Feldbegrenzung nach RFC 4180: ein Feld, das Semikolon, Anführungszeichen
  oder einen Zeilenumbruch enthält, wird in Anführungszeichen gesetzt, und darin enthaltene
  Anführungszeichen werden verdoppelt (EC-10).
- **Betrag ohne Tausenderpunkt und ohne Währungszeichen**, mit Dezimalkomma (`1234,50`) — so liest
  ihn jede Tabellenkalkulation mit deutschsprachigen Einstellungen als Zahl.
- **Kategorie als deutscher Anzeigename**, nicht als Schlüssel — die Datei ist für Menschen und für
  Steuerberater:innen, nicht für unseren Code.
- **Ein Feld, das mit `=`, `+`, `-`, `@`, Tabulator oder Wagenrücklauf beginnt, bekommt ein
  vorangestelltes Hochkomma** und wird begrenzt. Sonst liest jede Tabellenkalkulation den
  Inhalt als Formel: aus der Notiz `-50% Rabatt Parkhaus` wird `#NAME?`, und `=cmd|' /C calc'!A0`
  ist der bekannte CSV-Injection-Weg. **Begrenzen allein genügt nicht** — die Anführungszeichen
  fallen beim Einlesen zuerst weg, die Formel wird danach gesehen. _(Ergänzt nach `/qa`, BUG-1.)_
- **Erfassungszeitpunkt** als `TT.MM.JJJJ hh:mm` in Europe/Vienna.
- Wer noch keine Ausgabe hat, bekommt die Datei mit Kopfblock und Spaltenüberschriften — eine leere
  Auskunft ist auch eine Auskunft.

Der Abschnitt auf `/konto` heißt **„Deine Daten mitnehmen"** und erklärt in einem Satz, was in der
Datei steht. Damit ist auch die zweite offene Frage der Spec beantwortet: **der Abschnitt und die
Route gehören PROJ-2**, der Zugriffsschutz von `/konto` bleibt bei PROJ-1 — festgehalten in
`docs/app-shell.md`.

---

## Gleichzeitigkeit — die Garantie hinter jedem Timing-Fall

| Fall | Was ihn hält |
|---|---|
| **EC-1** — zweimal schnell auf „Erfassen" | Die Eindeutigkeitsregel über `(user_id, client_token)`. Beide Anfragen tragen dieselbe Vorgangskennung; die Datenbank lässt nur eine Zeile entstehen, die zweite Anfrage liest die Ablehnung als „schon erledigt" und meldet Erfolg. Der gesperrte Button ist die erste, bequemere Verteidigung — die Datenbank ist die, die auch ohne Browser hält. |
| **EC-2** — in Tab A gelöscht, Tab B ändert oder löscht | Ändern und Löschen sind **niemals** ein Upsert. Beide melden die Zahl der betroffenen Zeilen zurück; ist sie 0, gibt es die Ausgabe nicht mehr (oder sie gehört jemand anderem) — die Oberfläche sagt das und ruft trotzdem `refresh()` auf, damit Tab B auf Stand kommt. Eine gelöschte Ausgabe kann so nicht wieder entstehen. |
| **EC-3** — dieselbe Ausgabe in zwei Tabs geändert | Der Änderungsdialog schickt **alle vier Felder** und schreibt sie in **einer** Anweisung. Es gibt kein Lesen-Ändern-Zurückschreiben, also keine Stelle, an der sich zwei Stände mischen könnten. Der zuletzt gespeicherte Stand gilt vollständig — die Produktentscheidung „letzter gewinnt" aus der Spec. |
| **EC-11** — Änderung schiebt die Ausgabe in einen anderen Monat | Die Änderungs-Action liefert den Monat **nach** der Änderung zurück. Weicht er vom angezeigten ab, wechselt die Ansicht und der Toast nennt den neuen Monat; die Summen des verlassenen Monats stimmen, weil sie beim nächsten Aufbau aus den verbliebenen Zeilen neu gerechnet werden. |

**Warum kein Sperrmechanismus:** eine Ausgabe hat genau eine:n Eigentümer:in. Zwei Personen können
sie nicht gleichzeitig bearbeiten — nur eine Person in zwei Tabs. Ein Sperr- oder
Versionsmechanismus wäre mehr Bauwerk als der Fall wert; entscheidend ist allein, dass keine
Mischung entsteht, und das leistet die vollständige Ein-Anweisungs-Änderung.

---

## Wenn Datenbank oder Auth-Server nicht antworten (EC-4, EC-12)

_Nachgetragen von `/architecture PROJ-2` am 01.09.2026, nach dem `/refine`._

**Das Problem in einem Satz:** Es fehlte nicht die Meldung, es fehlte der Punkt, an dem die App
aufgibt. Gemessen bei angehaltener Datenbank: **50,4 Sekunden**, dann HTTP 500 ohne Text — und das
bloße Laden der Seite ebenso.

### Die drei Stellen, an denen gewartet wird

1. **Die Vorprüfung** (`proxy.ts`) — läuft vor **jeder** Anfrage und fragt den Auth-Server.
2. **Die Sitzungsprüfung** (`requireUser()`) — auf jeder geschützten Seite und in jeder Action.
3. **Die Abfragen und Schreibvorgänge selbst.**

Alle drei hängen an derselben Lücke, und die erste ist die wichtigste: Sie läuft **vor** der Seite.
Ein Zustand, den nur die Seite zeigen kann, wäre nie erreicht worden.

### Wo die Frist sitzt

An der Stelle, an der der Datenbank-Client erzeugt wird: ein eigener `fetch`, der jede Anfrage nach
**2 Sekunden** abbricht. Die Supabase-Dokumentation hält ausdrücklich fest, dass ein solcher `fetch`
für **alle** Aufrufe des Clients gilt — Auth eingeschlossen, nicht nur Datenbankabfragen. Genau das
wird hier gebraucht: Eine Frist je Abfrage würde nur die Datenbank treffen und ausgerechnet den
Aufruf auslassen, der zuerst hängt.

Beide Clients bekommen sie — der in `proxy.ts` erzeugte ebenso wie der für Seiten und Actions.

**Die eingebauten Wiederholversuche werden dabei abgeschaltet.** Seit `supabase-js` 2.102.0
wiederholt der Client Netzwerkfehler bei Datenbankabfragen selbsttätig, mit wachsenden Wartezeiten;
installiert ist **2.112.4**. Eine Frist je Anfrage wäre damit **je Versuch** wirksam, und die
zugesagten 2 Sekunden wären in Wahrheit ein Vielfaches — EC-4 wäre still gebrochen geblieben. Es
gilt: ein Versuch, eine Frist.

### Drei Ausgänge statt zwei

Die Sitzungsprüfung liefert künftig nicht mehr „Person" oder „niemand", sondern drei Ergebnisse:

| Ergebnis | Was es heißt | Was passiert |
|---|---|---|
| **Angemeldet** | Der Auth-Server hat die Sitzung bestätigt | wie bisher |
| **Nicht angemeldet** | Der Auth-Server hat **geantwortet**: die Sitzung gilt nicht | wie bisher — Weiterleitung auf `/login` (EC-5, PROJ-1 EC-3) |
| **Nicht feststellbar** | Frist abgelaufen, Netzwerkfehler oder Serverfehler — es kam **keine** Antwort | **keine** Weiterleitung, Nicht-erreichbar-Zustand (EC-12) |

Unterschieden wird an der **Art des Fehlers**, nicht am Fehlen der Person: ein abgebrochener oder
fehlgeschlagener Netzaufruf ist etwas anderes als eine beantwortete Ablehnung. Das ist derselbe
Schnitt, den PROJ-3 beim Kursdienst zieht — dauerhaft gegen vorübergehend.

### Was die Vorprüfung tut, und warum das den Zugriffsschutz nicht schwächt

Bei „nicht feststellbar" **lässt die Vorprüfung die Anfrage durch**, statt umzuleiten. Das sieht auf
den ersten Blick wie eine Lücke aus und ist keine:

- Die Vorprüfung war **nie** die Zugriffskontrolle, sondern eine Vorfilterung (TD-2). Die echte
  Prüfung sitzt auf jeder geschützten Seite.
- Die Seite kommt zum selben Ergebnis und zeigt deshalb **gar keine Daten**, sondern den
  Nicht-erreichbar-Zustand.
- Und es sind auch keine zu holen: Steht der Weg zur Datenbank, liefert Row Level Security nichts.
- **Fail-open an der Vorprüfung, fail-closed an der Seite.** Wer durchgelassen wird, sieht trotzdem
  nur „gerade nicht erreichbar".

**Gegenprobe zur entgegengesetzten Regel:** Die Drosselungs-Tore von PROJ-1 fallen bei jeder Störung
**zu**. Das bleibt so, und es widerspricht dem hier nicht. Dort entscheidet die Regel darüber, ob
jemand ein Passwort raten darf — fällt sie aus, ist Durchwinken das Risiko. Hier entscheidet nichts
über Zugang, weil die Seite dahinter ohnehin nichts herausgibt.

### Was die Person sieht

| Ort | Verhalten |
|---|---|
| `/` und `/konto` | An der Stelle des Inhalts eine Karte: ein Satz, was gerade nicht geht, plus **„Erneut versuchen"**. Kopfzeile und Rahmen bleiben stehen — die App wirkt nicht abgestürzt |
| Server Actions | Formularweite Meldung über den Feldern; **alle Eingaben bleiben stehen** (EC-4) |
| `/konto/export` | HTTP **503** mit kurzem deutschsprachigem Text. Eine Route, die eine Datei liefert, kann keine Karte zeigen |

**Der Text** (überall derselbe, wie die übrigen Meldungen ohne Schuldzuweisung):
„Wir erreichen deine Daten gerade nicht. Das liegt nicht an dir — versuch es in einem Moment noch
einmal."

**Kein automatischer Neuversuch, kein selbsttätiges Nachladen.** Wer erneut versuchen will, drückt
darauf. Ein Hintergrundversuch alle paar Sekunden schickt eine bereits überlastete Gegenstelle
zusätzliche Anfragen und verändert die Seite unter den Händen der Person.

### Neue Rahmen-Komponente

Eine Komponente `UnavailableNotice` unter `src/components/shell/` — sie gehört zum Rahmen, und den
besitzt PROJ-2. Sie nimmt den Satz und die Schaltfläche und wird von `/` und `/konto` an derselben
Stelle eingesetzt. `docs/app-shell.md` ist bereits nachgezogen: Seitenmuster um den
**Nicht-erreichbar-Zustand**, Anmeldezustände um **„nicht prüfbar"**.

### Was das für PROJ-1 heißt

Der Mechanismus sitzt an der gemeinsamen Stelle, also gilt er auch für Anmeldung und Registrierung.
**Kein Kriterium von PROJ-1 kehrt sich dadurch um:** Dessen EC-4 verlangt eine verständliche
Meldung, wenn die Datenbank nicht erreichbar ist — die kommt jetzt nach 2 Sekunden statt nach 50.
Dessen EC-3 (Sitzung abgelaufen) bleibt unberührt, weil „nicht feststellbar" ein Fall ist, den EC-3
nie beansprucht hat. Die Tore behalten ihre eigene 2-Sekunden-Frist und fallen weiterhin zu.

---

## Zustände je Seite

| Seite | Laden | Leer | Fehler | Nicht erreichbar (EC-4, EC-12) |
|---|---|---|---|---|
| `/` | Skeletons in `--muted` an der Stelle von Kopf, Summe, Übersicht und drei Listenzeilen — über eine Suspense-Grenze in der Seite, kein Spinner | Ausformulierter Leerzustand statt leerer Tabelle; die Erfassungszeile bleibt bedienbar (AC-12) | Feldfehler am verursachenden Feld, formularweite Fehler als Zeile darüber; Toast nur für Rückmeldungen |
| `/konto` | unverändert von PROJ-1 (`konto/loading.tsx`), ergänzt um eine Skeleton-Karte für den Export-Abschnitt | — | Der Export-Link führt zu einer Datei; scheitert der Abruf, zeigt der Browser seinen eigenen Fehler | `UnavailableNotice` an der Stelle der Karten; der Export selbst antwortet mit HTTP 503 |

**Text des Leerzustands** (AC-12): „Für **August 2026** ist noch nichts erfasst. Trag deine erste
Ausgabe oben ein — Betrag, Kategorie, Datum, fertig."

**Warum die Suspense-Grenze und nicht `app/loading.tsx`:** eine Ladedatei direkt unter `src/app/`
gälte auch für `/login` und `/signup` — die gehören PROJ-1, haben ein anderes Layout und würden das
Gerüst der Monatsansicht zeigen. Die Grenze in der Seite trifft nur `/` (TD-12).

---

## Was PROJ-2 am gemeinsamen Rahmen ändert

PROJ-2 **besitzt** `docs/app-shell.md`. Diese Punkte werden dort nachgezogen — nicht nur hier
beschrieben:

1. **Der Header steht auf `/` und auf `/konto`.** Auf `/konto` ohne Monatswechsler, weil es dort
   nichts zu wechseln gibt. Damit endet die Übergangsregel „`/konto` folgt dem Login-Muster, solange
   es den Header noch nicht gibt".
2. **`PageHeader` entfällt** aus der Komponententabelle. Bei zwei angemeldeten Seiten, von denen eine
   keine hervorgehobene Hauptaktion hat, gäbe es nichts zu teilen — eine Komponente mit genau einem
   Aufrufer ist keine Abstraktion, sondern eine Zwischenschicht.
3. **Das Seitenmuster wird präzisiert:** „genau eine hervorgehobene Hauptaktion rechts" gilt für
   Seiten, die eine haben. Auf `/` ist das Erfassen die Hauptaktion und steht als dauerhafte Zeile im
   Inhalt statt als Knopf im Seitenkopf — die Produktentscheidung der Spec, die den Rahmen bewusst
   ergänzt.
4. **`/konto` bekommt einen Abschnitt „Deine Daten mitnehmen"** und die neue Route `/konto/export`.
   Der Abschnitt und die Route gehören PROJ-2, Zugriffsschutz und Bereich bleiben bei PROJ-1.
5. **Der Ladezustand von `/`** kommt aus einer Suspense-Grenze, nicht aus einer Ladedatei.

`docs/data-model.md` wird ebenfalls nachgezogen: `expenses` ist ab jetzt eine gebaute Entität, sie
hängt mit Löschweitergabe an `profiles`, ihre Aufbewahrung endet mit dem Konto, die Kategorienliste
wird in der Datenbank erzwungen, und Währung samt eingefrorenem Kurs kommen erst mit PROJ-3.

---

## Dependencies

**Keine neuen Pakete und kein neuer shadcn/ui-Baustein.** Alles, was PROJ-2 braucht, liegt bereits im
Projekt:

- `zod` — die serverseitigen Feldregeln, wie schon bei PROJ-1
- `@supabase/ssr` + `@supabase/supabase-js` — Datenzugriff über den vorhandenen Server-Client
- `sonner` — die Rückmeldungen; der Toaster hängt schon im Wurzel-Layout
- shadcn/ui `select`, `dialog`, `alert-dialog`, `table`, `skeleton`, `card`, `button`, `input`,
  `label` — alle bereits installiert
- `Intl.NumberFormat` und `Intl.DateTimeFormat` — in der Laufzeit enthalten, keine Bibliothek für
  Zahlen- oder Datumsformatierung

Bewusst **nicht** hinzugefügt:

- **keine Kalender-Komponente** (`react-day-picker`): das native Datumsfeld liefert den Kalender des
  Systems, kennt die deutschsprachige Schreibweise von sich aus und ist auf dem Telefon schneller zu
  bedienen als jedes Nachbaubare (TD-14)
- **keine Diagrammbibliothek**: der Anteilsbalken einer Kategoriezeile ist ein Rechteck mit einer
  Breite in Prozent
- **kein Paket für Fristen oder Wiederholversuche** (etwa `fetch-retry`): `AbortSignal.timeout` ist
  Teil der Laufzeit, und die Wiederholversuche werden gerade **abgeschaltet**, nicht ergänzt
  (TD-27, TD-28)
- **keine Datumsbibliothek**: gebraucht werden Monatsgrenzen und „heute in Wien" — das leistet die
  Laufzeit
- **kein `react-hook-form`**: die Formulare laufen wie bei PROJ-1 über Server Actions mit
  Formularzustand; eine zweite Formularmechanik daneben wäre eine zweite Fehlerquelle

---

## Settings the user makes

**Keine.**

PROJ-2 prüft keine Zugangsdaten — es gibt hier keine Anmeldung, keine Registrierung, kein
Zurücksetzen und keinen Einladungscode. Die Drosselungs- und CAPTCHA-Fragen, die
`.claude/rules/security.md` an solche Stellen knüpft, haben in diesem Feature schlicht keinen
Gegenstand; das ist benannt, nicht übersehen (TD-22). Jede Operation liegt hinter der geprüften
Anmeldung von PROJ-1 und zusätzlich hinter Row Level Security.

Die offene Frage zu § 132 BAO ist eine **Rechtsfrage**, keine Einstellung — sie steht unter *Offene
Punkte* und in `docs/privacy.md`.

---

## Das Zeitbudget einer Anfrage (EC-4, zwei Zahlen)

_Nachgetragen von `/architecture PROJ-2` am 01.09.2026, nach dem zweiten `/refine`._

**Das überraschende Ergebnis dieses Entwurfs: es wird nichts Neues gebaut.** Der `/refine` hat EC-4
präzisiert, nicht verschärft — und die Anwendung erfüllt die präzisierte Fassung bereits. Das
festzustellen und zu belegen ist die Arbeit; Code zu schreiben, den niemand braucht, wäre es nicht.

### Woraus sich die Wartezeit zusammensetzt

Jede Anfrage läuft durch bis zu drei Stationen, die auf eine Gegenstelle warten können. Jede hat
ihre eigene Frist von 2 Sekunden (TD-27):

| Station | Wartet worauf | Gemessen im Ausfall |
|---|---|---|
| **Vorprüfung** (`proxy.ts`) | prüft das Sitzungsmerkmal, meist **ohne** Netzaufruf | 1–67 ms |
| **Sitzungsprüfung** der Seite oder der Action | fragt den Auth-Server | 2013 ms |
| **Datenabfragen** der Monatsansicht | laufen über `Promise.all` **parallel**, zählen also **einmal** | 2019 ms |

Daraus die realistischen Fälle:

| Weg | Rechnung | Gemessen |
|---|---|---|
| Seite lesen, Auth und Datenbank aus | Vorprüfung schnell + Sitzung 2 s → Meldung, **keine** Abfragen | **2,12 s** |
| Seite lesen, nur Datenzugriff aus | Vorprüfung + Sitzung schnell + Abfragen 2 s | **2,27 s** |
| POST, Auth und Datenbank aus | Vorprüfung schnell + Sitzung 2 s (Action) + Sitzung 2 s (Neuaufbau) | **4,07 s** |

**Alle drei liegen unter 5 Sekunden.** Die Grenze ist damit keine Hoffnung, sondern eine Ableitung
mit Messung dahinter.

> **Nachtrag aus dem Bau (T28):** Die 4,07 s sind die **vollständige HTTP-Antwort** — gemessen mit
> `curl`, inklusive des Seitenneuaufbaus, der nach der Action noch streamt. Im Browser steht die
> **Meldung** rund **2,4 s** nach dem Klick auf dem Bildschirm. Beide Zahlen stimmen und messen
> Verschiedenes. EC-4 spricht von der Meldung, deshalb misst die Zusicherung sie — und die Luft zur
> Grenze ist größer, als die Tabelle allein nahelegt.

### Wo die Grenze reißen könnte — benannt, nicht verschwiegen

- **Eine dritte Station in Folge.** Käme ein Weg dazu, der nacheinander Sitzung *und* zwei
  voneinander abhängige Abfragen macht, wären es 6 Sekunden. Genau deshalb sichert `/tasks` die
  Grenze mit einem Test ab, statt sie nur aufzuschreiben.
- **Eine kalte Vorprüfung.** Sie prüft das Sitzungsmerkmal normalerweise ohne Netzaufruf — muss sie
  den Signaturschlüssel erst holen (erster Aufruf nach einem Neustart), kostet auch sie bis zu
  2 Sekunden, und der POST-Weg käme auf 6. Das trifft die erste Anfrage nach einem Kaltstart, also
  einen Moment, in dem ohnehin nichts eingeschwungen ist.

### Was gebaut wird

**Genau eine Sache: eine Zusicherung, die die Grenze festhält.** Sie misst die Antwortzeit bei
angehaltener Gegenstelle und schlägt an, sobald ein Weg über 5 Sekunden braucht. Ohne sie wäre die
zweite Zahl eine Behauptung im Vertrag, die niemand nachhält — und der erste Weg, der eine dritte
wartende Station einführt, würde sie unbemerkt reißen.

---

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| **TD-1** Beträge als ganzzahlige **Cent-Werte** speichern und summieren | Ganze Zahlen können nicht runden. Der Weg von der Datenbank in die Anzeige führt über JSON, und dort wird aus einer Dezimalzahl eine Gleitkommazahl — genau die Stelle, an der aus 0,10 + 0,20 die berühmte 0,30000000000000004 wird. In Cent gibt es diese Stelle nicht | Exakte Dezimalspalte (`numeric`) | Jede Anzeige und jede Eingabe braucht eine Umrechnung um den Faktor 100; dafür stimmt jede Summe ohne Zusatzregel (EC-7) | 2026-08-29 |
| **TD-2** Kategorien als **stabile englische Schlüssel** in der Datenbank, deutsche Anzeigenamen im Code, erzwungen über eine **Prüfregel** | Ein Anzeigename lässt sich damit ändern, ohne eine einzige gespeicherte Zeile anzufassen — das entschärft die offene Frage der Spec zum Umbenennen. Die Prüfregel erfüllt AC-10 auf Datenbankebene und lässt sich später mit einer gewöhnlichen Migration erweitern | Postgres-Aufzählungstyp (Enum); eigene Nachschlagetabelle mit Fremdschlüssel | Enum: einen Wert wieder loszuwerden ist in Postgres praktisch unmöglich. Nachschlagetabelle: ein Zusammenführen bei jedem Listenaufbau für neun feste Werte, die sich nie ändern | 2026-08-29 |
| **TD-3** „Nicht in der Zukunft" wird **nur im Anwendungscode** geprüft, nicht als Datenbankregel | Eine Prüfregel, die die aktuelle Uhrzeit liest, ist nicht reproduzierbar: sie prüft beim Einspielen einer Sicherung gegen eine andere Gegenwart als beim Schreiben. AC-7 verlangt — anders als AC-10 — keine Durchsetzung unter Umgehung des Anwendungscodes | Prüfregel mit `now()` in der Datenbank | Wer den Anwendungscode umgeht, kann ein Datum in der Zukunft schreiben. Folge: eine Zeile in einem Monat, den die Ansicht nicht anbietet — kein Datenverlust, kein Sicherheitsproblem | 2026-08-29 |
| **TD-4** Doppelklick-Schutz über eine **Vorgangskennung** mit Eindeutigkeitsregel je Person | EC-1 verlangt „genau eine Ausgabe, auch wenn beide Anfragen durchgehen" — das kann nur die Datenbank garantieren. Ein gesperrter Button hilft nur, solange der Browser mitspielt | Eindeutigkeit über die Feldkombination Betrag + Datum + Kategorie | Die Feldkombination würde zwei echte Ausgaben verbieten (zweimal derselbe Kaffee am selben Tag). Die Kennung kostet eine Spalte und einen Index | 2026-08-29 |
| **TD-5** Ändern schreibt **alle vier Felder in einer Anweisung** | Es gibt damit keinen Moment zwischen Lesen und Schreiben, in dem sich zwei Stände mischen könnten (EC-3) | Feldweises Ändern; Versionszähler mit Konfliktmeldung | Der zuletzt gespeicherte Stand überschreibt den anderen vollständig — genau das, was die Spec als „letzter gewinnt" entschieden hat | 2026-08-29 |
| **TD-6** Ändern und Löschen melden die **Zahl der betroffenen Zeilen**; 0 heißt „gibt es nicht mehr" — und niemals ein Upsert | Ein Upsert würde eine in einem anderen Tab gelöschte Ausgabe stillschweigend wieder anlegen. Genau das verbietet EC-2 | Blind schreiben und Erfolg melden | Eine fremde und eine gelöschte Ausgabe sind von außen nicht unterscheidbar — beide bekommen dieselbe Meldung. Das ist Absicht: alles andere verriete, dass es die fremde Zeile gibt | 2026-08-29 |
| **TD-7** **Eine** Abfrage je Monat, Summen im Anwendungscode aus denselben Zeilen | Liste und Summen können nicht auseinanderlaufen, weil sie aus derselben Quelle stammen (AC-16). Bei bis zu 300 Zeilen im Monat ist die Rechnung nicht messbar, und die reine Funktion lässt sich einzeln testen | Aggregat-Abfrage in der Datenbank; eine materialisierte Sicht | Zwei Abfragen wären zwei Zeitpunkte und damit die Möglichkeit, dass die Summe nicht zur Liste passt. Bei sehr großen Monaten kehrt sich das Argument um — dann wird es eine Aufgabe für später, siehe Offene Punkte | 2026-08-29 |
| **TD-8** Aktualisierung ohne Neuladen über **`refresh()` aus `next/cache`** in der Server Action | Next.js 16 hat dafür genau diesen Aufruf: die Action schreibt, ruft `refresh()`, und der Client bekommt Liste und Summen frisch gerechnet in derselben Antwort. Eine zweite Wahrheit im Browser entsteht gar nicht erst | `revalidatePath` (frischt derzeit auch alle vorher besuchten Seiten mit auf); optimistische Anzeige mit `useOptimistic` | Eine Serverrunde pro Aktion statt sofortiger Anzeige. Bei den geforderten unter 500 ms nicht spürbar, dafür stimmen die Summen immer — bei optimistischer Anzeige müsste die Summenrechnung ein zweites Mal im Browser existieren | 2026-08-29 |
| **TD-9** Ungültige Monatsangaben werden **still auf den laufenden Monat aufgelöst**, ohne Weiterleitung | AC-19 verlangt „laufender Monat statt Fehlerseite". Eine Weiterleitung wäre ein zweiter Zustand, in dem sich eine Schleife bilden kann | Weiterleitung auf die bereinigte Adresse; Fehlerseite | Die unsinnige Angabe bleibt in der Adresszeile stehen, bis der nächste Pfeil geklickt wird. Sichtbar, aber harmlos | 2026-08-29 |
| **TD-10** Der Header wird **von jeder Seite selbst gerendert**, der Monatswechsler ist eine Client-Komponente | Ein `layout.tsx` bekommt in Next.js 16 **keine** `searchParams` — der Monat steht aber genau dort. Ein Header im Layout könnte den angezeigten Monat also gar nicht kennen | Gemeinsames Layout in einer Routengruppe | Zwei Seiten rufen dieselbe Komponente auf, statt sie zu erben. Bei zwei Seiten ist das die kleinere Umständlichkeit — und `/konto` und `/` müssten sonst beide in eine neue Ordnerstruktur umziehen | 2026-08-29 |
| **TD-11** Der Kategoriefilter lebt im **Browserzustand**, nicht in der Adresse | Ein Klick filtert damit sofort, ohne Serverrunde. Die Spec verlangt für den Filter — anders als für den Monat — ausdrücklich keine Beständigkeit über Neuladen hinweg | Filter als zweiter Adressparameter | Der Filter überlebt kein Neuladen und lässt sich nicht verlinken. Dafür kostet er nichts und blockiert nie | 2026-08-29 |
| **TD-12** Ladezustand über eine **Suspense-Grenze in der Seite** statt `app/loading.tsx` | Eine Ladedatei unter `src/app/` gilt auch für `/login` und `/signup`. Die gehören PROJ-1, sehen anders aus, und würden das Gerüst der Monatsansicht zeigen | `app/loading.tsx`; Routengruppe mit eigener Ladedatei | Der Ladezustand steht in der Seite statt in einer eigenen Datei — etwas weniger auffällig, dafür ohne Nebenwirkung auf fremde Seiten | 2026-08-29 |
| **TD-13** Beträge werden als **Zahl** formatiert und das `€` angehängt, nicht über `style: 'currency'` | `de-AT` stellt das Währungszeichen voran (`€ 1.284,50`). Das Design System verlangt es dahinter, und die Spec schreibt `1.284,50 €` wörtlich | `Intl.NumberFormat` mit `style: 'currency'`; `de-DE` statt `de-AT` | Eine Zeile eigener Code statt eines Schalters. `de-DE` hätte die richtige Stellung, aber die falsche Herkunft für ein Produkt mit österreichischen Konventionen | 2026-08-29 |
| **TD-14** **Natives Datumsfeld** statt einer Kalender-Komponente | Es bringt den Kalender des Systems mit, kennt die deutschsprachige Schreibweise, ist auf dem Telefon mit einem Tippen bedient und kostet kein Paket. Das Produkt verspricht eine Ausgabe in unter 30 Sekunden | shadcn `calendar` mit `react-day-picker` in einem Popover | Das Aussehen des Feldes bestimmt das Betriebssystem, nicht unser Design System. Bei einem Feld, das dreimal pro Erfassung berührt wird, wiegt Tempo schwerer als Einheitlichkeit | 2026-08-29 |
| **TD-15** Export als **GET-Route mit Anhang-Kopf**, bei jedem Abruf erzeugt | Ein gewöhnlicher Link lädt herunter, ohne dass eine Datei irgendwo entstehen und wieder aufgeräumt werden müsste. Die Spec verlangt ausdrücklich, dass nichts abgelegt wird | Server Action, die einen Text zurückgibt, den der Browser als Datei speichert | Eine GET-Anfrage trägt keine Formulardaten — hier braucht sie auch keine, sie liefert immer alles Eigene. Der Zugriffsschutz kommt aus `proxy.ts` **und** der Prüfung im Handler | 2026-08-29 |
| **TD-16** CSV mit **Semikolon, BOM, CRLF und RFC-4180-Anführungszeichen** | AC-27 verlangt „ohne Nacharbeit" in einer Tabellenkalkulation, EC-10 verlangt korrekte Spalten trotz Semikolon, Anführungszeichen und Zeilenumbruch in der Notiz. Diese vier Festlegungen zusammen leisten genau das | Komma als Trennzeichen (internationaler Standard) | Ein Komma als Trennzeichen kollidiert mit dem Dezimalkomma und zerlegt jede Betragsspalte. Die Datei ist damit auf deutschsprachige Einstellungen zugeschnitten — was für dieses Produkt richtig ist | 2026-08-29 |
| **TD-17** **Kein Schutz gegen Formel-Einschleusung** im CSV — benanntes, angenommenes Risiko | Die Datei enthält ausschließlich die eigenen Daten der Person, die sie abruft; es gibt keine zweite Partei, die etwas hineinschreiben könnte. Ein vorangestelltes Hochkomma vor jedem `=`, `+`, `-` oder `@` würde harmlose Notizen wie „-20 % Rabatt" sichtbar verfälschen | Gefährdende Felder mit einem Hochkomma entschärfen | Wer eine Formel in die eigene Notiz schreibt und die Datei öffnet, führt sie aus — gegen sich selbst. Sollte der Export je Daten Dritter enthalten, kehrt sich diese Abwägung um | 2026-08-29 |
| **TD-18** Zwei **Feldgrenzen über die Spec hinaus**: höchstens 9.999.999,99 € je Ausgabe, kein Datum vor dem 01.01.2000 | Ein Feld ohne Obergrenze ist eine offene Tür für Unsinn, und ein vertippter Jahrgang (`0202`) schickt die Monatsnavigation in eine Vergangenheit, aus der sie kaum zurückfindet. Beide Grenzen haben eine eigene, verständliche Meldung — sie scheitern nie stumm | Keine Grenzen; nur eine technische Grenze ohne eigene Meldung | Beide Werte standen zunächst in keinem Kriterium. `/refine PROJ-2` hat sie am 2026-08-31 als **AC-29** und **AC-30** in die Spec nachgezogen — der Entwurf bleibt unverändert, nur der Vertrag holt auf | 2026-08-29 |
| **TD-19** **Kein `updated_at`** an der Ausgabe | Kein Kriterium, keine Ansicht und kein Export braucht den Zeitpunkt der letzten Änderung. Ein Feld, das niemand liest, ist trotzdem eine Aufzeichnung über das Verhalten der Person | Zeitstempel mitführen, „falls man ihn mal braucht" | Wer die Änderungshistorie später doch will, ergänzt sie bewusst über `/refine` — statt sie stillschweigend von Anfang an mitzuschreiben (Art. 5 Abs. 1 lit. c DSGVO) | 2026-08-29 |
| **TD-20** Der Header steht auf `/` **und** `/konto`; auf `/konto` ohne Monatswechsler | Vom Nutzer so entschieden. `docs/app-shell.md` beschreibt den Rahmen als durchgehend, und PROJ-2 fasst `/konto` für den Export-Abschnitt ohnehin an — die Gelegenheit zweimal zu verpassen wäre teurer als sie zu nutzen | Header nur auf `/`, `/konto` unverändert lassen | PROJ-2 ersetzt das Karten-Layout in einer Datei, die PROJ-1 gebaut hat. Der Zugriffsschutz und die beiden Konto-Karten bleiben dabei unangetastet | 2026-08-29 |
| **TD-21** **Kein `PageHeader`** — das Seitenmuster wird stattdessen in `docs/app-shell.md` präzisiert | Bei zwei angemeldeten Seiten, von denen eine gar keine hervorgehobene Hauptaktion hat, gäbe es nichts zu teilen. Eine Komponente mit einem einzigen Aufrufer ist keine Abstraktion | `PageHeader` bauen, wie `/init` ihn vorgeschlagen hat | Kommt später eine dritte Seite dazu, wird die Komponente dann gebaut — aus zwei echten Aufrufern statt aus einer Vermutung | 2026-08-29 |
| **TD-22** **Keine Drosselung in PROJ-2** — benannt, nicht übersehen | Die Sicherheitsregeln knüpfen Drosselung und CAPTCHA an Stellen, die Zugangsdaten prüfen. PROJ-2 prüft keine: alles hier liegt hinter der bereits geprüften Anmeldung von PROJ-1 und zusätzlich hinter Row Level Security | Zusätzliche Drosselung auf dem Export | Wer angemeldet ist, kann seinen eigenen Export beliebig oft abrufen. Bei bis zu einigen hundert eigenen Zeilen ist das keine Last, die einen eigenen Mechanismus rechtfertigt | 2026-08-29 |
| **TD-23** Der Betrag wird **serverseitig aus Text gelesen**, mit einer festen Regel für Komma und Punkt | AC-6 verlangt, dass beide Trennzeichen gleich verstanden werden. Die Regel („kommen beide vor, ist das rechteste das Dezimaltrennzeichen") ist die einzige, die `1.284,50` und `1284.50` beide richtig auflöst | Nur Komma zulassen; ein Zahlenfeld des Browsers | Ein Zahlenfeld verhält sich je nach Spracheinstellung des Systems anders und kann bei deutschsprachiger Eingabe still einen falschen Wert liefern. Text plus eigene Regel ist überall gleich | 2026-08-29 |
| **TD-24** `spent_on` ist ein **reines Datum**, „heute" kommt vom Server in Europe/Vienna | Ein Datum ohne Uhrzeit kann beim Anzeigen nicht in eine andere Zeitzone rutschen. Am 1. um 00:30 Uhr Wiener Zeit gehört die Ausgabe damit in den neuen Monat, auch wenn der Server in UTC noch im alten steht (EC-6) | Zeitstempel mit Zeitzone speichern und beim Anzeigen umrechnen | Die Uhrzeit einer Ausgabe geht verloren — sie wird nirgends gebraucht, und ihr Fehlen ist zugleich eine Angabe weniger über den Tagesablauf der Person | 2026-08-29 |
| **TD-25** Row Level Security mit **vier Policies** plus Zugehörigkeitsprüfung im Anwendungscode | Genau das Muster, das PROJ-1 an `profiles` etabliert hat — kein zweites daneben. AC-24 verlangt die Datenbankschicht, AC-25 die Anwendungsschicht; beide, weil früher oder später eine davon umgangen wird | Nur die Prüfung im Anwendungscode | Zwei Stellen, an denen dieselbe Regel steht. Das ist hier gewollt: der öffentliche Schlüssel steckt in jedem Browser, und ohne RLS liest ihn jeder direkt aus | 2026-08-29 |
| **TD-26** AC-26 entsteht durch die **Löschweitergabe**, nicht durch eigenen Code | `expenses` hängt an `profiles`, `profiles` an `auth.users`, und die Kontolöschung von PROJ-1 entfernt die Zeile in `auth.users`. Damit sind die Ausgaben mit weg, ohne dass die Löschfunktion geändert werden müsste | Die Löschfunktion von PROJ-1 um ein Löschen der Ausgaben erweitern | Die Löschfunktion von PROJ-1 bleibt unangetastet — und kann bei einem künftigen Feature nicht vergessen werden, weil die Datenbank die Kette hält und nicht eine Liste im Code | 2026-08-29 |
| **TD-27** Die Frist sitzt im **gemeinsamen `fetch` des Clients**, nicht je Abfrage | Ein eigener `fetch` gilt laut Supabase-Dokumentation für **alle** Aufrufe des Clients — Auth eingeschlossen. Eine Frist je Abfrage (`abortSignal`) träfe nur die Datenbank und ließe ausgerechnet den Auth-Aufruf aus, der als erster hängt und in `proxy.ts` vor jeder Anfrage steht | `.abortSignal()` an jede Abfrage hängen; jede Server Action einzeln in ein Zeitlimit wickeln | Eine Zahl für alle Aufrufe: Ein Sonderfall, der legitim länger braucht, lässt sich nicht einzeln großzügiger stellen, ohne die Stelle wieder aufzubrechen. Bei einer App ohne lange Abfragen ist das kein Verlust | 2026-09-01 |
| **TD-28** Die **eingebauten Wiederholversuche** von `supabase-js` werden abgeschaltet | Seit 2.102.0 wiederholt der Client Netzwerkfehler bei Datenbankabfragen selbsttätig mit wachsenden Wartezeiten; installiert ist 2.112.4. Die Frist wäre damit **je Versuch** wirksam und EC-4s „höchstens 2 Sekunden" schlicht unwahr — der Fehler wäre still geblieben, weil niemand die Summe der Versuche misst | Wiederholversuche belassen und die Frist als Gesamtbudget über die ganze Operation legen | Ein kurzer Aussetzer, den ein Neuversuch überbrückt hätte, wird jetzt sichtbar. Dafür liegt der Neuversuch dort, wo die Person ihn sieht und selbst auslöst (EC-12), statt unsichtbar ihre Wartezeit zu verlängern | 2026-09-01 |
| **TD-29** Die **Vorprüfung lässt durch**, wenn sie die Anmeldung nicht feststellen kann — statt umzuleiten | EC-12: `/login` braucht denselben Auth-Server, die dort angebotene Handlung könnte also gar nicht gelingen. Die Vorprüfung war nie die Zugriffskontrolle, sondern eine Vorfilterung (TD-2); die echte Prüfung sitzt auf der Seite und zeigt ohne Datenbank ohnehin nichts an | Weiterleitung mit eigenem Grund (`reason=unavailable`); Fehlerseite direkt aus der Vorprüfung | Fail-open an einer Stelle, die bisher fail-closed war. Getragen davon, dass die Seite dahinter dieselbe Prüfung wiederholt und ohne erreichbare Datenbank keine Zeile liefert — RLS inbegriffen | 2026-09-01 |
| **TD-30** Die Sitzungsprüfung hat **drei Ausgänge**, unterschieden an der **Art des Fehlers** | „Nicht angemeldet" und „nicht feststellbar" sehen im Code heute gleich aus — beide enden bei `null`, und daraus wurde „Sitzung abgelaufen". Ein abgebrochener Netzaufruf ist aber etwas anderes als eine beantwortete Ablehnung. Derselbe Schnitt wie bei PROJ-3s Kursdienst: dauerhaft gegen vorübergehend | Am Fehlen der Person unterscheiden (geht nicht, beide liefern nichts); einen Zeitstempel mitführen und daraus schließen | Jede aufrufende Stelle muss den dritten Fall behandeln — zwei Seiten, eine Route, drei Actions und die Vorprüfung. Der Preis dafür, dass die App nie etwas über die Sitzung behauptet, was sie nicht geprüft hat | 2026-09-01 |
| **TD-31** Die Gesamtgrenze aus EC-4 wird **nicht durch einen neuen Mechanismus** erreicht, sondern durch die Struktur — und mit einem Test festgehalten | Die Rechnung oben zeigt: Die längste realistische Kette ist Vorprüfung (meist ohne Netzaufruf) + eine Sitzungsprüfung + eine Abfragestufe, gemessen 2,12 s / 2,27 s / 4,07 s. Alles unter 5 Sekunden. Ein zusätzliches Bauwerk dafür wäre Code ohne Zweck; was fehlt, ist nicht Mechanik, sondern eine Zusicherung, die es so hält | Ein gemeinsames Abbruchsignal über die ganze Anfrage (Gesamtbudget) | Ohne eigenen Mechanismus hängt die Einhaltung an der Struktur: Wer einen Weg mit einer dritten wartenden Station baut, reißt die Grenze. Genau das fängt der Test ab — später, aber sicher, statt nie | 2026-09-01 |
| **TD-32** Die Forderung „höchstens **eine** Sitzungsprüfung je Anfrage" wird **verworfen** | Sie stand einen Schritt lang in der Spec und ist nicht sicher baubar. Gemessen: Server Action und anschließender Neuaufbau teilen **keinen** anfragebezogenen Bereich — die in `React.cache` umschlossene Prüfung lief in **einer** Anfrage trotzdem zweimal. Die Next.js-Doku sagt zu `React.cache` „scoped to the current request only"; diese beiden Durchgänge zählen offenbar nicht als derselbe | Modulweiter Zwischenspeicher; die Prüfung der Seite lokal statt beim Auth-Server | Der modulweite Speicher würde die Sitzung einer Person an die nächste ausliefern — ausgeschlossen. Die lokale Prüfung nähme PROJ-1 seine Zusage aus EC-5 (eine entzogene Sitzung fiele erst nach bis zu einer Stunde auf) und wäre ein `/refine PROJ-1`. Der Preis des Verzichts ist klein: Im Normalbetrieb kostet die zweite Prüfung rund 50 ms; teuer ist sie nur im Ausfall, also wenn ohnehin nichts geht | 2026-09-01 |

---

## Abdeckung: jedes Kriterium hat eine Stelle

| Kriterium | Wo es im Entwurf steht |
|---|---|
| AC-1 Erfassen, erscheint ohne Neuladen | Erfassungszeile + Anlege-Action mit `refresh()` (TD-8) |
| AC-2 Datumsvorbelegung je Monat | Erfassungszeile, Vorbelegung vom Server (TD-24) |
| AC-3 Nach dem Speichern: leeren, behalten, Fokus | Erfassungszeile, „die eine Regel, die AC-2 und AC-3 zusammen erfüllt" |
| AC-4 Ansicht folgt dem Monat der Ausgabe | Anlege-Action gibt den Monat zurück; Toast |
| AC-5 Betrag 0/negativ/zu viele Stellen | Eingaberegeln Betrag + Prüfregel in der Datenbank |
| AC-6 Komma und Punkt gleich, Anzeige deutschsprachig | Eingaberegeln Betrag (TD-23) + Darstellung (TD-13) |
| AC-7 Kein Datum in der Zukunft | Eingaberegeln Datum (TD-3) |
| AC-8 Kategorie ist Pflicht | Eingaberegeln Kategorie |
| AC-9 Notiz höchstens 200 Zeichen, leer erlaubt | Eingaberegeln Notiz + Prüfregel in der Datenbank |
| AC-10 Kategorie aus der festen Liste, auch bei Umgehung | Prüfregel in der Datenbank (TD-2) |
| AC-11 Liste des Monats, Sortierung | Monat lesen; Index (user_id, spent_on ↓, created_at ↓) |
| AC-12 Leerzustand | Zustände je Seite |
| AC-13 Gesamtsumme hervorgehoben | Summen; Darstellung (einzige Zahl in `2xl`) |
| AC-14 Kategoriezeilen mit Summe und Prozent | Summen (TD-7) |
| AC-15 Kategoriefilter, erneuter Klick hebt auf | Der Kategoriefilter (TD-11) |
| AC-16 Summen stimmen ohne Neuladen | `refresh()` nach jeder Aktion (TD-8) |
| AC-17 Monat in der Adresse | Monatsnavigation |
| AC-18 Pfeilgrenzen, sichtbar aber inaktiv | Monatsnavigation; „ältesten Monat lesen" |
| AC-19 Unsinnige Monatsangabe | Monatsnavigation (TD-9) |
| AC-20 Änderungsdialog mit gespeichertem Stand | Änderungs-Action; `EditExpenseDialog` |
| AC-21 Gleiche Regeln beim Ändern | Ein Schema für beide Wege (Eingaberegeln) |
| AC-22 Löschbestätigung nennt die Ausgabe | `DeleteExpenseDialog` |
| AC-23 Gelöscht, Rückmeldung, Summen stimmen | Lösch-Action + `refresh()`; Toast |
| AC-24 Fremde Ausgaben unerreichbar | Zugriff auf Datenbankebene (TD-25) |
| AC-25 Serverseitige Prüfung aller Regeln | Behaviors & Access; jede Action prüft zuerst |
| AC-26 Kontolöschung entfernt die Ausgaben | Löschweitergabe (TD-26) |
| AC-27 CSV-Export auf `/konto` | Der Export (TD-15, TD-16) |
| AC-28 Hinweis am Notizfeld | Eingaberegeln Notiz |
| AC-29 Höchstbetrag 9.999.999,99 € | Eingaberegeln Betrag + Prüfregel in der Datenbank (TD-18) |
| AC-30 Kein Datum vor dem 01.01.2000 | Eingaberegeln Datum + Prüfregel in der Datenbank (TD-18) |
| EC-1 Doppelklick | Vorgangskennung + Eindeutigkeit (TD-4) |
| EC-2 In einem Tab gelöscht | Betroffene Zeilen zählen, nie Upsert (TD-6) |
| EC-3 Gleichzeitig geändert | Alle Felder in einer Anweisung (TD-5) |
| EC-4 Datenbank oder Auth-Server antwortet nicht | Frist im gemeinsamen `fetch` (TD-27), Wiederholversuche aus (TD-28); formularweite Meldung, Zustand bleibt stehen |
| EC-12 Anmeldung nicht feststellbar | Drei Ausgänge (TD-30), Vorprüfung lässt durch (TD-29), `UnavailableNotice` statt `/login` |
| EC-5 Sitzung abgelaufen | `requireUser()` aus PROJ-1 (Routen und Zugriffsschutz) |
| EC-6 Monatsgrenze um Mitternacht | Zeitzone (TD-24) |
| EC-7 Rundung der Prozentwerte | Summen |
| EC-8 Ältester Monat wird leer | Monatsnavigation, Grenze wird je Aufbau neu bestimmt |
| EC-9 Mehrere hundert Ausgaben | Eine Abfrage, ein Index, keine Seitenblätterung (TD-7) |
| EC-10 Sonderzeichen im Export | CSV-Regeln (TD-16) |
| EC-11 Änderung verschiebt den Monat | Gleichzeitigkeit, letzte Zeile |

---

## Offene Punkte

- [ ] **§ 132 BAO** — greift die 7-jährige Aufbewahrungspflicht auf die erfassten Belegdaten durch?
      Dann kehrt sie AC-26 um. Übernommen aus `spec.md`; Antwort von Jurist:innen, nicht aus diesem
      Entwurf. Der Entwurf setzt bis dahin um, was die Spec sagt: Kontolöschung entfernt alles.
- [x] **Die zwei Feldgrenzen aus TD-18** (Höchstbetrag, frühestes Datum) → mit den Werten aus dem
      Entwurf als **AC-29** und **AC-30** in der Spec, dazu AC-21 um beide erweitert. `/qa` prüft sie
      damit als Kriterien statt sie als Abweichung zu melden (2026-08-31).
- [ ] **Ab wann eine Aggregat-Abfrage nötig wird** (TD-7). Bei bis zu 300 Zeilen im Monat ist die
      Rechnung im Anwendungscode nicht messbar. Der Punkt gehört zur Frage nach der Seitenblätterung
      aus `spec.md` und wird mit echten Daten beantwortet, nicht vorher.
- [ ] **Umbenennen einer Kategorie** ist durch TD-2 deutlich billiger geworden — der Anzeigename
      liegt im Code, nicht in den Daten. Das **Entfernen** einer Kategorie bleibt offen: bereits
      erfasste Ausgaben trügen dann einen Schlüssel, den es nicht mehr gibt. Vor einer Änderung der
      Liste zu klären.


---

## Notizen aus dem Bau (`/build`, 2026-08-31)

Fünf Stellen, an denen die Umsetzung vom Entwurf abweicht oder ihn präzisiert. Alle sind
Umsetzungsdetails, keine Änderungen am Verhalten — die Acceptance Criteria bleiben, wie sie sind.

1. **Zahlen werden mit `de-DE` formatiert, nicht mit `de-AT`.** ICU trennt Tausender in `de-AT`
   inzwischen mit einem schmalen geschützten Leerzeichen (`1 284,50`). AC-6 und
   `docs/design-system.md` §5 verlangen aber den Punkt. `de-DE` liefert ihn und ist sonst
   identisch; **Datum und Monatsname bleiben `de-AT`**, weil nur die den *Jänner* kennen.

2. **`ExpenseFormState` und `IDLE` liegen in `src/lib/expenses/form-state.ts`**, nicht in der
   Action-Datei. Eine `'use server'`-Datei darf ausschließlich async-Funktionen exportieren; ein
   exportiertes Objekt bricht **zur Laufzeit** ab („A 'use server' file can only export async
   functions, found object"). `next build` meldet das nicht — der Fehler fiel erst im laufenden
   Browser auf.

3. **Änderungs- und Lösch-Dialog behandeln das Ergebnis im Absendeweg, nicht in einem
   `useEffect`.** Beide hängen in der Tabellenzeile ihrer Ausgabe. Nach `refresh()` ist die Zeile
   weg — beim Löschen immer, beim Ändern dann, wenn die Ausgabe in einen anderen Monat rutscht —
   und mit ihr die Komponente. Ein Effect käme nie zum Zug: die Rückmeldung aus AC-23 bliebe aus,
   der Monatswechsel aus EC-11 ebenso. Die Fortsetzung nach dem `await` läuft dagegen weiter, ob
   die Komponente noch im Baum steht oder nicht. Die **Erfassungszeile** behält `useActionState`
   samt Effect: sie wird nie ausgehängt.

4. **Kein `key={month}` an der Suspense-Grenze.** Ein Schlüssel am Monat baut den Teilbaum bei
   jedem Wechsel neu auf; die Erfassungszeile verlöre dabei ihren Zustand, und das eingegebene
   Datum fiele auch dann auf die Vorbelegung zurück, wenn es im nun angezeigten Monat liegt —
   genau das verbietet die Regel, die AC-2 und AC-3 zusammen erfüllt (nachgewiesen im Durchstich
   für AC-4). Das Gerüst zeigt sich damit beim ersten Aufbau der Seite, nicht bei jedem
   Monatswechsel.

5. **`MonthSwitcher` ist eine Server-Komponente**, nicht wie im Komponentenbaum notiert eine
   Client-Komponente. Die Pfeile sind reine Links und der Monatsname reiner Text — es gibt keinen
   Zustand zu halten. Verhalten unverändert, nur kein JavaScript dafür im Browser.

**Außerhalb des Features aufgefallen:** `playwright.config.ts` zeigt fest auf
`http://localhost:3000` mit `reuseExistingServer`. Hält ein anderes Projekt diesen Port besetzt
(beim Bau: der Dev-Server von alexmacht.at), weicht `next dev` auf 3001 aus, und die E2E-Suite
prüft **stillschweigend die falsche Anwendung** — auch die von PROJ-1. Der Durchstich lief
deshalb gegen 3001. Gehört zu `/e2e-tests` bzw. in die Konfiguration, nicht in dieses Feature.

---

## Notizen aus dem Bau der Ebenen 6–9 (`/build`, 01.09.2026)

**Der Entwurf hat gehalten** — TD-27 bis TD-30 sind unverändert umgesetzt. Drei Dinge, die erst
beim Bauen sichtbar wurden und die der nächste Leser wissen sollte:

**1. Die Fehlerklassifizierung beruht auf einer eigenen Markierung, nicht auf den Fehlerobjekten
der Bibliotheken.** Gemessen wurde, was der Datenbankpfad bei Fristablauf liefert: ein blankes
Objekt **ohne `name`**, mit leerem `code` und der Meldung `TimeoutError: The operation was aborted
due to timeout`. Auf ein leeres `code`-Feld eine Zusicherung zu bauen, wäre eine schlechte Wette —
es entsteht auch, wenn der Server mit unlesbarem Rumpf antwortet. Wer den Fehler **auslöst**, weiß
dagegen sicher, was passiert ist: `deadlineFetch` markiert ihn selbst. Auf der Auth-Seite kommt
`AuthRetryableFetchError` dazu — die Bibliothek vergibt ihn für geworfene `fetch`-Fehler **und**
für 5xx und kommentiert ihn selbst mit „infrastructure errors … should not cause session
invalidation". Genau diese Lesart wird gebraucht.

**2. Der Rückgabetyp erzwingt die Behandlung — und das war der Sinn.** Nach der Änderung an
`requireUser()` meldete TypeScript **zehn** Fehler an sieben Aufrufstellen. Das ist kein Kollateral­
schaden, sondern der Mechanismus aus TD-30: Ein dritter Zustand, den man vergessen kann, ist keiner.

**3. Ohne Sitzungs-Cookie ist der Ausfall gar nicht spürbar.** `getClaims()` fragt niemanden, wenn
nichts zu prüfen ist — eine abgemeldete Person wird also auch bei stehender Datenbank in 17 ms
korrekt auf `/login` geleitet. Der Fall aus EC-12 trifft **nur angemeldete** Personen. Das war beim
Prüfen zunächst irreführend und ist beim nächsten Nachmessen mitzudenken.

**Gemessen am echten Ausfall** (`docker pause` auf den Datenbank-Container, angemeldete Sitzung):

| | vorher (QA-Lauf PROJ-3) | jetzt |
|---|---|---|
| `/` mit Sitzung | **50,4 s**, HTTP 500, kein Text | **2,3 s**, HTTP 200, Meldung + „Erneut versuchen" |
| Weiterleitung auf `/login` | ja („Sitzung abgelaufen") | **nein** — die Adresse bleibt `/?monat=2026-08` |
| Kopfzeile / Rahmen | weg | steht |
| `/konto/export` | HTTP 500 | **HTTP 503** mit deutschsprachigem Klartext |
| nach `docker unpause` | — | normale Ansicht sofort zurück |

**Prüfstand:** 242 Unit- und Integrationstests grün (vorher 214), 28 von 28 E2E grün in Chromium
und Mobile Safari, Lint und Build ohne Befund. Für die neuen Tests wurde der Rot-Nachweis geführt —
sechs gezielte Rückbauten (Frist entfernt · Wiederholversuche wieder an · `isUnreachable` immer
`false` · Durchlassen in der Vorprüfung entfernt · Nichterreichen wieder als „abgemeldet" ·
Unerreichbar-Zweig der Actions entfernt), jeder von genau den Tests gefangen, die ihn verhindern
sollen, danach alle wieder grün.

---

## Notiz aus dem Bau zu BUG-4 (`/build`, 01.09.2026)

**Der Entwurf hatte eine Lücke, und sie lag in der Annahme, nicht im Code.** Die Ebenen 6–9 haben
das Nichterreichen ausschließlich an der **Sitzungsprüfung** abgefangen. Das trug, solange
Datenbank und Auth-Server zusammen ausfallen — und genau so wurde beim Bau gemessen (`docker pause`
auf den Datenbank-Container). Bleibt der Auth-Server aber erreichbar und steht **nur** der
Datenzugriff, ist die Sitzung feststellbar, `requireUser()` liefert die Person, und erst die
Monatsabfrage scheitert. Dort fing sie niemand: Die Abfrage warf, es gab keinen Fehlerzustand, und
die Person sah dauerhaft das Ladegerüst — sichtbarer Text der ganzen Seite: „auslage."

`MonthView` fängt das jetzt ab, prüft mit `isUnreachable` und zeigt `UnavailableNotice`. **Jeder
andere Fehler fliegt weiter** — ihn als „gerade nicht erreichbar" auszugeben wäre dieselbe falsche
Behauptung, gegen die EC-12 geschrieben wurde, nur in die andere Richtung.

**Die Lehre, und sie gilt über dieses Feature hinaus:** Wer eine Zusicherung über *Erreichbarkeit*
prüft, muss die Bestandteile **einzeln** ausfallen lassen. Ein gemeinsamer Ausfall ist der
freundlichste aller Fälle — er fällt zuerst dort auf, wo man ohnehin hinsieht, und verdeckt damit
jeden Pfad, der erst danach liegt.

**Nachgemessen und dabei eine falsche Angabe im QA-Bericht berichtigt.** Dort stand, der Lesepfad
brauche 4,5 s, weil sich die zwei Abfragen der Monatsansicht addierten. `MonthView` führt sie über
`Promise.all` **parallel** aus — es gibt dort nur *eine* Frist. Die Instrumentierung zeigt
`getUser 58 ms` und `Abfragen gescheitert nach 2019 ms`, gesamt **2,21 s**. Die vorher gemessenen
4,46 s und 3,28 s waren die Erstübersetzung der Route durch den Entwicklungsserver. BUG-6 bleibt
bestehen, aber nur für den POST-Fall — dort sind zwei Sitzungsprüfungen zu je 2013 ms belegt.

---

## Notiz aus dem Bau der Ebene 11 (`/build`, 01.09.2026)

**Zwei Dinge, die erst beim Schreiben der Zusicherung sichtbar wurden.**

**1. Der Schreibweg ist während eines Ausfalls über die Oberfläche gar nicht erreichbar** — wenn
man ihn erst dann öffnet. Steht der Datenzugriff schon beim Laden, zeigt die Seite den
Nicht-erreichbar-Zustand, und es gibt keine Erfassungszeile mehr zum Ausfüllen. Der Test füllt sie
deshalb **vorher** aus und lässt die Gegenstelle danach ausfallen. Das ist zugleich die wirkliche
Reihenfolge: Die Person hat die Seite offen, tippt, und *dann* antwortet niemand mehr.

**2. Die erste Fassung der Zusicherung maß nichts und sah dabei grün aus.** Sie wartete auf
`getByRole('alert')` und traf damit ein leeres `alert`-Element der Next.js-Entwicklungswerkzeuge,
das immer im Dokument steht. Gemeldet wurden **86 ms** für einen Weg, der eine Zwei-Sekunden-Frist
enthält — eine Zahl, die nur auffällt, wenn man sie liest, statt auf das grüne Häkchen zu schauen.
Geprüft wird jetzt auf den **Text** der Meldung, nicht auf die Rolle.

**Gemessen mit der fertigen Zusicherung** (`npm run test:outage`):

| Fall | Gemessen | Grenze |
|---|---|---|
| Nur Datenzugriff aus — erfassen | 2402 ms | 5000 ms |
| Nur Datenzugriff aus — laden | 2340 ms | 5000 ms |
| Datenbank **und** Auth aus — erfassen (der teuerste Weg) | 2391 ms | 5000 ms |

**Prüfstand:** 247 Unit- und Integrationstests grün (vorher 246), 28 von 28 E2E im Standardlauf
(die Zusicherung ist ausgeschlossen — nachgewiesen über `--list`: 28 gesammelt, 30 ohne den
Ausschluss), Lint und Build ohne Befund. Rot-Nachweis für beide Aufgaben geführt: die Abfragen
nacheinander statt parallel → T29 rot; die Grenze auf 1000 ms → T28 rot mit der richtigen Meldung.
