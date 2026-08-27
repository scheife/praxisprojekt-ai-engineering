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

**Zuletzt geprüft:** 2026-08-27 (bei `/write-spec PROJ-1`)

**Betriebszustand zum Zeitpunkt dieser Prüfung:** Das Produkt läuft **ausschließlich lokal** in Docker auf
dem Rechner des Entwicklers. Es gibt keine öffentliche Adresse, keine echten Nutzer:innen und keine
echten Daten — nur Demo-Einträge. Es existiert **kein Auftragsverarbeiter**, weil keine Daten den Rechner
verlassen. Das ändert sich in dem Moment, in dem ein gehostetes Supabase-Projekt entsteht; die dann
fälligen Punkte stehen unten unter „Wenn es online geht".

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Von wem | Warum zulässig | Aufbewahrung | Beteiligte Dienste |
|---|---|---|---|---|---|
| Nutzerkonten betreiben (Registrierung, Anmeldung, Sitzung) | E-Mail-Adresse, Passwort-Hash, Nutzer-ID (UUID), Zeitpunkt der Registrierung | Registrierte Nutzer:innen | Art. 6 Abs. 1 lit. b DSGVO — Vertrag. Ohne Konto gibt es die Leistung nicht; E-Mail und Passwort sind dafür erforderlich | Bis zur Kontolöschung | keine (lokal) |
| Anmeldung vor automatisiertem Erraten schützen (Drosselung) | IP-Adresse, E-Mail-Adresse, Zähler fehlgeschlagener Versuche, Zeitstempel | Jede Person, die das Anmeldeformular aufruft — auch nicht registrierte | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an der Sicherheit der Konten. Interessenabwägung fällt eindeutig aus: minimale Daten, kurze Speicherung, unmittelbarer Schutzzweck für die Betroffenen selbst | Zähler werden **spätestens 24 Stunden** nach dem letzten Versuch gelöscht; das Sperrfenster selbst beträgt 15 Minuten | keine (lokal) |
| Sicherheitsprotokolle der Authentifizierung | IP-Adresse, User-Agent, Zeitstempel, Ereignistyp (`auth.audit_log_entries` in Supabase) | Alle, die sich an- oder abmelden | Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an Nachvollziehbarkeit von Sicherheitsereignissen | Von Supabase Auth verwaltet — **Aufbewahrungsdauer noch nicht festgelegt**, siehe Offene Punkte | keine (lokal) |

### Was PROJ-1 bewusst **nicht** erhebt

Kein Name, kein Anzeigename, keine Anschrift, keine Telefonnummer, keine Firmendaten. Für Registrierung
und Anmeldung sind sie nicht erforderlich, und das billigste Datenschutzmittel ist ein Feld, das gar nicht
erst existiert (Art. 5 Abs. 1 lit. c DSGVO). Wer später einen Anzeigenamen will, ergänzt ihn in `profiles`
über `/refine`.

### Vorausschau auf PROJ-2

Das Feld **Notiz** an einer Ausgabe ist ein Freitextfeld. Solche Felder füllen Menschen erfahrungsgemäß mit
allem — auch mit Angaben über Dritte („Mittagessen mit Frau X"). Das ist bei `/write-spec PROJ-2` zu
bewerten, nicht hier. Notiert, damit es nicht untergeht.

---

## Besondere Kategorien personenbezogener Daten

**Keine.** Weder Gesundheits-, biometrische, genetische, ethnische, politische, religiöse noch
Gewerkschafts- oder Sexualdaten (Art. 9 DSGVO), keine strafrechtlichen Daten (Art. 10 DSGVO).

**Keine Kinderdaten.** Zielgruppe sind Gewerbetreibende und Freelancer; das Produkt spricht Minderjährige
nicht an.

---

## Auftragsverarbeiter

| Dienst | Was er verarbeitet | Region | AVV geschlossen | Außerhalb der EU/EWR? |
|---|---|---|---|---|
| _keiner_ | — | lokal, Docker | entfällt | nein |

Solange Supabase in Docker auf dem eigenen Rechner läuft, gibt es keinen Auftragsverarbeiter im Sinne von
Art. 28 DSGVO — es werden keine Daten an Dritte übermittelt. Auch **keine Analyse-, Tracking-, Zahlungs-,
Mail- oder KI-Dienste**: die Dependencies wurden geprüft, es ist keines dieser SDKs installiert.

**Cookies:** Die einzigen gesetzten Cookies sind die Sitzungs-Cookies von Supabase Auth. Sie sind für den
angeforderten Dienst unbedingt erforderlich und damit **einwilligungsfrei** (§ 165 Abs. 3 TKG 2021 in
Österreich, Umsetzung der ePrivacy-Richtlinie — **zu prüfen**). Es gibt kein Banner, weil es nichts gibt,
wofür eines nötig wäre.

---

## Betroffenenrechte

| Recht | Fundstelle | Wie dieses Produkt es erfüllt |
|---|---|---|
| Auskunft / Kopie | Art. 15 DSGVO | **Offen** — sinnvoll erst mit PROJ-2, wenn es Ausgabendaten zu exportieren gibt. In PROJ-1 bestünde die Auskunft aus E-Mail-Adresse und Registrierungsdatum |
| Berichtigung | Art. 16 DSGVO | **Offen** — die einzige berichtigungsfähige Angabe ist die E-Mail-Adresse; eine Änderungsmöglichkeit ist in PROJ-1 nicht vorgesehen |
| Löschung | Art. 17 DSGVO | **Als AC in PROJ-1 vorgeschlagen** — Konto löschen entfernt Konto, Profil und alle zugehörigen Daten |
| Datenübertragbarkeit | Art. 20 DSGVO | **Offen** — gehört zu PROJ-2 (Export der Ausgaben in maschinenlesbarer Form) |
| Widerspruch | Art. 21 DSGVO | Betrifft nur die auf berechtigtem Interesse gestützte Drosselung. Ein Widerspruch dagegen ist praktisch nicht sinnvoll, da sie dem Schutz der betroffenen Person selbst dient — bei einem Widerspruch wäre eine Einzelfallabwägung nötig |
| Information | Art. 13 DSGVO | **Offen** — Datenschutzerklärung erst nötig, wenn das Produkt öffentlich erreichbar ist. Siehe „Wenn es online geht" |
| Reaktionsfrist | Art. 12 Abs. 3 DSGVO | Ein Kalendermonat. Bei einem Produkt ohne echte Nutzer:innen derzeit gegenstandslos |

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

---

## Wenn es online geht

Diese Punkte werden fällig, sobald ein gehostetes Supabase-Projekt oder eine öffentliche Adresse existiert
— nicht vorher. Für die Prüfung ist keiner davon relevant, weil kein Deployment vorgesehen ist.

- [ ] **AVV mit Supabase** schließen (Art. 28 DSGVO) — im Supabase-Dashboard als Dokument verfügbar
- [ ] **Region `eu-central-1` (Frankfurt)** beim Anlegen des Projekts wählen — nachträglich nicht änderbar
- [ ] **Drittstaatentransfer** klären: Supabase Inc. ist ein US-Unternehmen. Prüfen, ob es sich unter dem
      EU-US Data Privacy Framework zertifiziert hat, sonst Standardvertragsklauseln
- [ ] **Datenschutzerklärung** (Art. 13 DSGVO) — von jeder Seite erreichbar
- [ ] **Impressum** — in Österreich nach ECG § 5 und MedienG, **nicht** nach deutschem DDG (**zu prüfen**)
- [ ] **Error-Tracking**: derzeit keines installiert. Falls eines dazukommt, Scrubbing bewusst einschalten
      — Fehlerberichte enthalten regelmäßig E-Mail-Adressen und Formularinhalte
- [ ] **Reaktionsfrist** von einem Monat organisatorisch sicherstellen (Art. 12 Abs. 3 DSGVO)

---

## Offene Punkte

- [ ] **Verantwortlicher** vollständig festhalten (Name, Anschrift, Kontakt) — nötig ab dem ersten
      öffentlichen Zugang, nicht vorher
- [ ] **Aufbewahrungsdauer der Supabase-Auth-Protokolle** (`auth.audit_log_entries`) festlegen. Supabase
      verwaltet sie selbst; die Voreinstellung wurde noch nicht geprüft
- [ ] **Auskunft und Export** (Art. 15, 20 DSGVO) bei `/write-spec PROJ-2` einplanen — dort gibt es
      Ausgabendaten, die einen Export überhaupt sinnvoll machen
- [ ] **E-Mail-Adresse ändern** (Art. 16 DSGVO) — in PROJ-1 nicht vorgesehen, bewusste Zurückstellung
- [ ] **Freitextfeld „Notiz"** bei `/write-spec PROJ-2` bewerten (Angaben über Dritte)

---

## Für Jurist:innen oder Datenschutzbeauftragte

Erst relevant, wenn aus dem Prüfungsprojekt ein echtes Produkt für andere Gewerbetreibende wird. Dann mit
diesem Kontext fragen:

1. **Aufbewahrung:** Ein Ausgaben-Tracker hält Belegdaten von Gewerbetreibenden. Greift § 132 BAO
   (7 Jahre Aufbewahrungspflicht) auf die in `auslage.` erfassten Daten durch — mit der Folge, dass eine
   Kontolöschung diese Daten *nicht* entfernen darf? Oder bleibt die Aufbewahrungspflicht beim Nutzer und
   seiner eigenen Buchhaltung, sodass `auslage.` frei löschen kann? **Das ist die wichtigste offene Frage**,
   weil sie das Löschkonzept umkehren würde.
2. **Rolle:** Ist der Betreiber von `auslage.` Verantwortlicher oder Auftragsverarbeiter für die
   Ausgabendaten der Kund:innen? Bei einem Buchhaltungs-Hilfsmittel ist beides vertretbar, und davon hängt
   ab, welche Verträge nötig sind.
3. **Cookies:** Reichen die Sitzungs-Cookies von Supabase Auth als „unbedingt erforderlich" nach
   § 165 Abs. 3 TKG 2021, sodass kein Banner nötig ist?

---

_Diese Prüfung ist eine Engineering-Bewertung, keine Rechtsberatung — das letzte Wort haben Jurist:innen
oder ein:e Datenschutzbeauftragte:r._
