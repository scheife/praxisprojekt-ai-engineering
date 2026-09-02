# Datenschutz-Register — auslage.

> Der ehrliche Überblick darüber, welche personenbezogenen Daten dieses Produkt verarbeitet, warum und
> wie lange.
>
> - Angelegt und aktuell gehalten von `/dsgvo`, ein Eintrag pro Verarbeitungszweck.
> - Wächst mit dem Produkt: Ändert ein Feature, was gespeichert wird, ändert sich sein Eintrag mit.
> - **Flughöhe:** Zwecke, Rechtsgrundlagen, Aufbewahrung und wer die Daten sonst noch sieht.
>   Feldgenaue Details stehen in `docs/data-model.md` und den Feature-Designs.
>
> Das entspricht weitgehend einem Verarbeitungsverzeichnis (Art. 30 DSGVO) — ist aber ein
> Engineering-Dokument, keine juristische Eingabe. Ob es für deine Situation vollständig ist, entscheiden
> Jurist:innen oder ein:e Datenschutzbeauftragte:r.

**Anwendbares Recht:** DSGVO (EU). **Achtung:** `docs/law/gdpr.md` ist auf Deutschland zugeschnitten
(BDSG, DDG, § 147 AO). Der Verantwortliche sitzt in Österreich — die DSGVO gilt identisch, die nationalen
Ergänzungen nicht (DSG 2018 statt BDSG, ECG § 5 statt DDG, § 132 BAO mit 7 statt 10 Jahren,
Datenschutzbehörde statt Landesbehörden). Österreichische Spezifika sind unten als **zu prüfen** markiert.

**Datenschutz-Haltung:** `lean` (aus `docs/PRD.md` → Rahmenbedingungen)

**Verantwortlicher:** _offen_ — voraussichtlich Alexander Kai Scheiflinger / alexmacht, Kärnten.
Vollständige Anschrift wird erst gebraucht, wenn das Produkt öffentlich erreichbar ist. Siehe Offene Punkte.

**Zuletzt geprüft:** 2026-09-02 (`/dsgvo` über das ganze Projekt, nach PROJ-1, PROJ-2 und PROJ-3)

**Betriebszustand zum Zeitpunkt dieser Prüfung:** Das Produkt läuft **ausschließlich lokal** in Docker auf
dem Rechner des Entwicklers. Es gibt keine öffentliche Adresse, keine echten Nutzer:innen und keine
echten Daten — nur Demo-Einträge. Es existiert **heute kein Auftragsverarbeiter**, weil keine
personenbezogenen Daten den Rechner verlassen.

**Angekündigte Änderung (bestätigt am 02.09.2026):** Für die Abgabe soll ein **gehostetes
Supabase-Projekt** entstehen. Ab diesem Moment ist Supabase Auftragsverarbeiter, und drei Punkte werden
fällig, von denen einer nachträglich nicht mehr korrigierbar ist — die Region. Sie stehen unten unter
„Wenn es online geht" und sind dort als **jetzt fällig** markiert.

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Von wem | Warum zulässig | Aufbewahrung | Beteiligte Dienste |
|---|---|---|---|---|---|
| Nutzerkonten betreiben (Registrierung, Anmeldung, Sitzung) | E-Mail-Adresse, Passwort-Hash, Nutzer-ID (UUID), Zeitpunkt der Registrierung | Registrierte Nutzer:innen | Art. 6 Abs. 1 lit. b DSGVO — Vertrag. Ohne Konto gibt es die Leistung nicht; E-Mail und Passwort sind dafür erforderlich | Bis zur Kontolöschung | keine (lokal) |
| Anmeldung vor automatisiertem Erraten schützen (Drosselung) | IP-Adresse, E-Mail-Adresse, Zähler fehlgeschlagener Versuche, Zeitstempel | Jede Person, die das Anmeldeformular aufruft — auch nicht registrierte | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an der Sicherheit der Konten. Interessenabwägung fällt eindeutig aus: minimale Daten, kurze Speicherung, unmittelbarer Schutzzweck für die Betroffenen selbst | Zähler werden **spätestens 24 Stunden** nach dem letzten Versuch gelöscht; das Sperrfenster selbst beträgt 15 Minuten | keine (lokal) |
| Registrierung vor automatisierten Massenanlagen schützen (Drosselung) | IP-Adresse, Zeitstempel, Zähler der Versuche | Jede Person, die das Registrierungsformular abschickt — also **jede Person, die ein Konto anlegt**, nicht nur wer scheitert | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse daran, dass niemand die Datenbank mit Konten flutet. Gezählt werden Versuche, nicht angelegte Konten; ohne vertrauenswürdige IP zählen alle Versuche gemeinsam (PROJ-1, AC-17) | **24 Stunden** nach dem Versuch, dieselbe Regel wie beim Anmelden (PROJ-1, AC-16) | keine (lokal) |
| Sicherheitsprotokolle der Authentifizierung | IP-Adresse, User-Agent, Zeitstempel, Ereignistyp (`auth.audit_log_entries` in Supabase) | Alle, die sich an- oder abmelden | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an Nachvollziehbarkeit von Sicherheitsereignissen | Von Supabase Auth verwaltet — **Aufbewahrungsdauer noch nicht festgelegt**, siehe Offene Punkte | keine (lokal) |
| Geschäftsausgaben erfassen und je Monat auswerten | Betrag in Euro, Währung, Originalbetrag, Kategorie aus fester Liste, Ausgabedatum, **Notiz (Freitext, optional, max. 200 Zeichen)**, Erfassungszeitpunkt, Vorgangskennung; bei Fremdwährung zusätzlich der eingefrorene Kurs und sein Kursdatum | Registrierte Nutzer:innen — über sich selbst | Art. 6 Abs. 1 lit. b DSGVO — Vertrag. Das ist die Leistung, für die das Konto besteht | Bis zur Kontolöschung, kein automatischer Ablauf. Ein Änderungszeitpunkt wird **bewusst nicht** geführt (`docs/data-model.md`) | keine (lokal) |
| Auskunft und Datenübertragbarkeit erfüllen (CSV-Export) | Erzeugt aus den bereits gespeicherten Daten: E-Mail-Adresse, Registrierungsdatum und alle eigenen Ausgaben | Registrierte Nutzer:innen, auf eigenen Abruf | Art. 6 Abs. 1 lit. c DSGVO — rechtliche Verpflichtung aus Art. 15 und Art. 20 DSGVO | **Keine** — die Datei wird bei jedem Abruf neu erzeugt und nicht auf dem Server abgelegt (PROJ-2, Technical Requirements) | keine (lokal) |

### Was PROJ-1 bewusst **nicht** erhebt

Kein Name, kein Anzeigename, keine Anschrift, keine Telefonnummer, keine Firmendaten. Für Registrierung
und Anmeldung sind sie nicht erforderlich, und das billigste Datenschutzmittel ist ein Feld, das gar nicht
erst existiert (Art. 5 Abs. 1 lit. c DSGVO). Wer später einen Anzeigenamen will, ergänzt ihn in `profiles`
über `/refine`.

### Was PROJ-2 und PROJ-3 bewusst **nicht** erheben

Kein Beleg-Foto, kein Lieferant, kein Zahlungsmittel, keine Kontonummer — alles ausdrücklich Non-Goal im
PRD. Und **kein Änderungszeitpunkt** an der Ausgabe: Ihn braucht kein einziges Kriterium, und ein Feld,
das niemand liest, ist trotzdem eine Aufzeichnung über das Verhalten der Person (`docs/data-model.md`).

Der Kursabruf bei PROJ-3 läuft **ausschließlich serverseitig**. Ein Abruf aus dem Browser hätte die
IP-Adresse der erfassenden Person an einen fremden Dienst geschickt; hinaus gehen stattdessen nur ein
Datum und zwei Währungscodes (`src/lib/expenses/rate.ts`, PROJ-3 design.md TD-6).

### Das Freitextfeld „Notiz" — erledigt bei `/write-spec PROJ-2`

Die Vorausschau aus PROJ-1 lautete: Freitextfelder füllen Menschen erfahrungsgemäß mit allem, auch mit
Angaben über Dritte („Mittagessen mit Frau X"). **Bewertet und entschieden am 29.08.2026:**

- Das Feld bleibt, aber es lädt solche Angaben nicht ein: **PROJ-2, AC-28** verlangt einen sichtbaren
  Hinweis am leeren Notizfeld, dass dort keine Namen Dritter und keine Gesundheits- oder ähnlich
  sensiblen Angaben stehen sollen. Das Feld bleibt optional *(Art. 5 Abs. 1 lit. c, Art. 9 DSGVO)*.
- **Gegen einen Einwilligungsdialog** wurde bewusst entschieden: In einem österreichischen
  Ausgabenkontext sind Kirchenbeitrag, Gewerkschaftsbeitrag und Apotheke gängige Positionen — also
  Art.-9-Daten. Die Person tippt sie **über sich selbst**; ein Einwilligungsdialog wäre unverhältnismäßig,
  ein Feld, das solche Angaben gar nicht erst einlädt, ist das billigere Mittel (PROJ-2, Decision Log).
- **PROJ-2, AC-9** begrenzt die Notiz auf 200 Zeichen — nebenbei eine Datenminimierung.

---

## Besondere Kategorien personenbezogener Daten

**Keines dieser Daten wird erhoben** — kein Feld des Produkts fragt nach Gesundheit, Biometrie, Genetik,
Herkunft, politischer Meinung, Religion, Gewerkschaftszugehörigkeit oder Sexualleben (Art. 9 DSGVO), und
keines nach strafrechtlichen Daten (Art. 10 DSGVO).

**Eine ehrliche Einschränkung, seit es PROJ-2 gibt:** Die **Notiz** ist ein Freitextfeld. Wer
„Kirchenbeitrag", „Gewerkschaftsbeitrag" oder „Apotheke" hineinschreibt, legt damit ein Art.-9-Datum ab —
nicht weil das Produkt danach fragt, sondern weil es der Person freisteht, es hinzuschreiben. Drei Dinge
halten das im Rahmen:

1. Es sind **Angaben über die Person selbst**, die sie selbst eintippt und jederzeit ändern oder löschen
   kann (PROJ-2, AC-20 und AC-23).
2. **AC-28** rät am leeren Feld ausdrücklich davon ab.
3. Es geschieht **nicht in großem Umfang** — die Schwelle, ab der Art. 9 die schweren Pflichten auslöst.

Ein Einwilligungsdialog wäre hier das falsche Mittel; die Begründung steht oben unter „Das Freitextfeld
‚Notiz'". **Für Jurist:innen** ist die Frage unten als Punkt 4 notiert, falls aus dem Prüfungsprojekt ein
Produkt für fremde Nutzer:innen wird.

**Keine Kinderdaten.** Zielgruppe sind Gewerbetreibende und Freelancer; das Produkt spricht Minderjährige
nicht an.

---

## Auftragsverarbeiter

| Dienst | Was er verarbeitet | Region | AVV geschlossen | Außerhalb der EU/EWR? |
|---|---|---|---|---|
| _heute keiner_ | — | lokal, Docker | entfällt | nein |
| **Supabase** (angekündigt, noch nicht angelegt) | Konten, Profile, Ausgaben, Auth-Protokolle — also **alles** | muss beim Anlegen auf `eu-central-1` (Frankfurt) gesetzt werden, **nachträglich nicht änderbar** | **offen — vor der Nutzung fällig** | Supabase Inc. ist ein US-Unternehmen; Transfergrundlage zu klären |

Solange Supabase in Docker auf dem eigenen Rechner läuft, gibt es keinen Auftragsverarbeiter im Sinne von
Art. 28 DSGVO — es werden keine Daten an Dritte übermittelt. Auch **keine Analyse-, Tracking-, Zahlungs-,
Mail- oder KI-Dienste**: die Dependencies wurden am 02.09.2026 erneut geprüft (`package.json`), es ist
keines dieser SDKs installiert.

**Ein Außenkontakt besteht trotzdem — und er ist kein Auftragsverarbeiter.** PROJ-3 ruft für
Fremdwährungsausgaben `api.frankfurter.dev` auf (Wechselkurse der EZB):

| Dienst | Was er empfängt | Personenbezug | Einstufung |
|---|---|---|---|
| `api.frankfurter.dev` | ein Datum und zwei Währungscodes, z. B. `2026-08-14?base=EUR&symbols=USD` | **keiner** — kein Konto, keine Kennung, kein Betrag, und die IP-Adresse ist die des Servers, nicht die der Person | **Kein Auftragsverarbeiter** (Art. 28 DSGVO), weil er keine personenbezogenen Daten verarbeitet. Kein AVV nötig |

Der Aufruf läuft ausschließlich serverseitig und folgt **keinen Weiterleitungen** — zieht der Dienst um,
fällt das als Fehler auf, statt still woandershin zu zeigen (`src/lib/expenses/rate.ts:20`). Das ist
festgehalten, damit später niemand rätselt, ob hier ein Vertrag fehlt.

**Cookies:** Die einzigen gesetzten Cookies sind die Sitzungs-Cookies von Supabase Auth. Sie sind für den
angeforderten Dienst unbedingt erforderlich und damit **einwilligungsfrei** (§ 165 Abs. 3 TKG 2021 in
Österreich, Umsetzung der ePrivacy-Richtlinie — **zu prüfen**). Es gibt kein Banner, weil es nichts gibt,
wofür eines nötig wäre.

---

## Betroffenenrechte

| Recht | Fundstelle | Wie dieses Produkt es erfüllt |
|---|---|---|
| Auskunft / Kopie | Art. 15 DSGVO | **Erfüllt, selbstbedient** — `/konto` → Datenexport liefert eine CSV mit E-Mail-Adresse, Registrierungsdatum und allen eigenen Ausgaben: Datum, Kategorie, Betrag (EUR), Notiz, Erfasst am, Währung, Betrag (Original), Kurs, Kursdatum (PROJ-2 AC-27, PROJ-3 AC-19). Bei einer Euro-Ausgabe bleiben die Kursfelder **leer** statt „1,0000" — in einer Auskunft soll nur stehen, was wirklich gespeichert ist |
| Berichtigung | Art. 16 DSGVO | **Teilweise erfüllt.** Jede Ausgabe ist über „Ändern" vollständig korrigierbar (PROJ-2, AC-20/AC-21). **Weiterhin offen: die E-Mail-Adresse** — in PROJ-1 als bewusste Zurückstellung außerhalb des Umfangs. Siehe Offene Punkte |
| Löschung | Art. 17 DSGVO | **Erfüllt und im QA nachgewiesen** — die Kontolöschung entfernt Konto, Profil und **alle** Ausgaben, ohne verwaiste Zeile (PROJ-1 AC-15, PROJ-2 AC-26). Getragen wird das von der Löschweitergabe `auth.users → profiles → expenses`, nicht von einer Aufräumroutine, die jemand pflegen müsste |
| Datenübertragbarkeit | Art. 20 DSGVO | **Erfüllt** — dieselbe CSV wie bei der Auskunft, semikolongetrennt nach RFC 4180 und ohne Nacharbeit in einer Tabellenkalkulation zu öffnen (PROJ-2, AC-27 und EC-10) |
| Widerspruch | Art. 21 DSGVO | Betrifft nur die auf berechtigtem Interesse gestützte Drosselung — **jetzt beide**, Anmeldung wie Registrierung. Ein Widerspruch ist praktisch nicht sinnvoll, da sie dem Schutz der betroffenen Person selbst dient; bei einem Widerspruch wäre eine Einzelfallabwägung nötig |
| Information | Art. 13 DSGVO | **Offen** — Datenschutzerklärung erst nötig, wenn das Produkt öffentlich erreichbar ist. Als **PROJ-5** auf der Roadmap, siehe „Wenn es online geht" |
| Reaktionsfrist | Art. 12 Abs. 3 DSGVO | Ein Kalendermonat. Auskunft, Export und Löschung laufen selbstbedient und **sofort** — eine Frist muss dafür niemand organisieren. Relevant bliebe sie nur für eine Anfrage per E-Mail, und die setzt öffentlichen Zugang voraus |

---

## Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

**Nicht erforderlich.** Keiner der vier Auslöser trifft zu:

- keine systematische umfangreiche automatisierte Bewertung oder Profilbildung mit rechtlicher Wirkung
- keine umfangreiche Verarbeitung besonderer Kategorien
- keine systematische Überwachung öffentlich zugänglicher Bereiche
- kein Eintrag auf einer Blacklist der Aufsichtsbehörde (**für Österreich zu prüfen** — die DSB führt
  eigene Listen, nicht die deutsche DSK-Liste)

Ein Ausgaben-Tracker mit E-Mail-Login liegt weit unter der Schwelle. Das ist ein vollständiges Ergebnis,
kein übersprungener Schritt.

**Erneut geprüft am 02.09.2026 mit den Daten von PROJ-2 und PROJ-3** — das Ergebnis bleibt. Ausgaben sind
keine besondere Kategorie, die Auswertung ist eine Summenbildung je Kategorie und keine Profilbildung mit
rechtlicher Wirkung, und Art.-9-Angaben können höchstens **vereinzelt** in einer Notiz landen, nicht
„in großem Umfang".

---

## Wenn es online geht

### Jetzt fällig — das gehostete Supabase-Projekt ist angekündigt

Diese drei gehören **vor** die erste Zeile, die in der Cloud landet. Der erste ist der einzige Punkt
dieses Dokuments, der sich später nicht mehr reparieren lässt:

- [ ] **Region `eu-central-1` (Frankfurt)** beim Anlegen wählen. **Nachträglich nicht änderbar** — ein
      Wechsel bedeutet ein neues Projekt und eine vollständige Migration. Sichtbar unter
      *Project Settings → General*
- [ ] **AVV mit Supabase** schließen (Art. 28 DSGVO) — im Supabase-Dashboard **je Organisation** unter
      *Organization Settings → Legal Documents* zu akzeptieren, bevor echte Daten hineingehen
- [ ] **Drittstaatentransfer** klären: Supabase Inc. ist ein US-Unternehmen. Prüfen, ob es unter dem
      EU-US Data Privacy Framework zertifiziert ist, sonst Standardvertragsklauseln. Die EU-Region
      allein beantwortet das **nicht**, weil der Anbieter US-amerikanisch bleibt
- [ ] **Aufbewahrung der Auth-Protokolle** (`auth.audit_log_entries`) im gehosteten Projekt nachsehen —
      lokal war die Frage folgenlos, in der Cloud liegen dort IP-Adressen bei einem Dritten

### Vor der Umstellung des Repositories auf **public**

Das PRD sieht das für die Abgabe vor. Datenschutzseitig sind es zwei Handgriffe:

- [ ] Bestätigen, dass **keine echte E-Mail-Adresse und keine echten Beträge** in Migrationen, Tests oder
      Fixtures stehen. Am 02.09.2026 geprüft: `supabase/` und `tests/` enthalten **keine** — bitte vor dem
      Umschalten erneut kurz ansehen
- [ ] Bestätigen, dass `.env.local` weiterhin **nicht** im Repository liegt (nur `.env.local.example`)

### Erst mit einer öffentlichen Adresse

- [ ] **Datenschutzerklärung** (Art. 13 DSGVO) — von jeder Seite erreichbar. Steht als **PROJ-5** auf der
      Roadmap; fällig vor dem ersten fremden Zugriff, nicht vorher
- [ ] **Impressum** — in Österreich nach ECG § 5 und MedienG, **nicht** nach deutschem DDG (**zu prüfen**)
- [ ] **Error-Tracking**: derzeit keines installiert. Falls eines dazukommt, Scrubbing bewusst einschalten
      — Fehlerberichte enthalten regelmäßig E-Mail-Adressen und Formularinhalte
- [ ] **Reaktionsfrist** von einem Monat organisatorisch sicherstellen (Art. 12 Abs. 3 DSGVO) — für
      Anfragen per E-Mail; die Selbstbedienung in der App deckt Auskunft, Export und Löschung bereits ab
- [ ] **Server- und Zugriffsprotokolle** des Hosters bewerten — sie enthalten IP-Adressen und brauchen
      einen eigenen Eintrag in diesem Register

---

## Offene Punkte

- [ ] **Verantwortlicher** vollständig festhalten (Name, Anschrift, Kontakt) — nötig ab dem ersten
      öffentlichen Zugang, nicht vorher
- [ ] **Aufbewahrungsdauer der Supabase-Auth-Protokolle** (`auth.audit_log_entries`) festlegen. Supabase
      verwaltet sie selbst; die Voreinstellung wurde noch nicht geprüft. **Wird mit dem gehosteten
      Projekt konkret** — siehe „Jetzt fällig"
- [ ] **E-Mail-Adresse ändern** (Art. 16 DSGVO) — in PROJ-1 als Out of Scope zurückgestellt. Das Recht auf
      Berichtigung ist damit für die Ausgaben erfüllt, für die Adresse selbst **nicht**. Bei einem Produkt
      ohne fremde Nutzer:innen folgenlos; vor öffentlichem Zugang über `/refine PROJ-1` nachzuholen
- [ ] **`login_attempts` in der Auskunft nach Art. 15.** Die Tabelle hält E-Mail-Adresse und IP-Adresse,
      der CSV-Export enthält sie nicht. Praktisch entschärft durch die 24-Stunden-Löschung — eine Auskunft
      käme fast immer auf eine leere Menge. Vor öffentlichem Zugang bewusst zu entscheiden, statt es
      unbemerkt zu lassen
- [x] **Auskunft und Export** (Art. 15, 20 DSGVO) → **erledigt** mit PROJ-2, AC-27 (CSV auf `/konto`)
- [x] **Freitextfeld „Notiz"** bewerten → **erledigt** bei `/write-spec PROJ-2` (AC-28 und AC-9,
      Begründung oben)

---

## Für Jurist:innen oder Datenschutzbeauftragte

Erst relevant, wenn aus dem Prüfungsprojekt ein echtes Produkt für andere Gewerbetreibende wird. Dann mit
diesem Kontext fragen:

1. **Aufbewahrung:** Ein Ausgaben-Tracker hält Belegdaten von Gewerbetreibenden. Greift § 132 BAO
   (7 Jahre Aufbewahrungspflicht) auf die in `auslage.` erfassten Daten durch — mit der Folge, dass eine
   Kontolöschung diese Daten *nicht* entfernen darf? Oder bleibt die Aufbewahrungspflicht beim Nutzer und
   seiner eigenen Buchhaltung, sodass `auslage.` frei löschen kann? **Das ist die wichtigste offene Frage**,
   weil sie das Löschkonzept umkehren würde.
   *Kontext seit 02.09.2026:* Sie ist nicht mehr theoretisch. Die Löschung ist gebaut und im QA
   nachgewiesen (PROJ-1 AC-15, PROJ-2 AC-26), und sie entfernt über die Löschweitergabe **sämtliche**
   Ausgaben. Fällt die Antwort auf „§ 132 BAO greift durch", ist nicht ein Vermerk zu ändern, sondern
   zwei Acceptance Criteria und das Datenmodell.
2. **Rolle:** Ist der Betreiber von `auslage.` Verantwortlicher oder Auftragsverarbeiter für die
   Ausgabendaten der Kund:innen? Bei einem Buchhaltungs-Hilfsmittel ist beides vertretbar, und davon hängt
   ab, welche Verträge nötig sind.
3. **Cookies:** Reichen die Sitzungs-Cookies von Supabase Auth als „unbedingt erforderlich" nach
   § 165 Abs. 3 TKG 2021, sodass kein Banner nötig ist?
4. **Freitextfeld und Art. 9:** Das Notizfeld einer Ausgabe kann Angaben enthalten, die formal besondere
   Kategorien sind — „Kirchenbeitrag", „Gewerkschaftsbeitrag", „Apotheke" sind in einem österreichischen
   Ausgabenkontext gängige Positionen. Die Person trägt sie **über sich selbst** ein, das Produkt fragt
   nicht danach, und AC-28 rät am Feld ausdrücklich davon ab. Reicht dieser Hinweis, solange die Person
   nur eigene Ausgaben erfasst — oder braucht es bei fremden Nutzer:innen eine ausdrückliche Einwilligung
   nach Art. 9 Abs. 2 lit. a DSGVO? Erst relevant, wenn andere als der Betreiber das Produkt nutzen.
5. **Registrierungs-Drosselung:** Sie hält die IP-Adresse **jeder** Person fest, die ein Konto anlegt —
   nicht nur derer, die scheitern — für 24 Stunden, gestützt auf Art. 6 Abs. 1 lit. f. Hält diese
   Interessenabwägung, oder wäre eine engere Ausgestaltung nötig (etwa erst ab dem dritten Versuch)?

---

_Diese Prüfung ist eine Engineering-Bewertung, keine Rechtsberatung — das letzte Wort haben Jurist:innen
oder ein:e Datenschutzbeauftragte:r._
