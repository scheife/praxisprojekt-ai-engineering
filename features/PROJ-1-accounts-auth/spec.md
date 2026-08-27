# PROJ-1: Konto & Anmeldung

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. A contract that is read-only during /build
     cannot carry a field that changes during /build. -->

## Dependencies

Keine. PROJ-1 ist das Fundament; PROJ-2 und PROJ-3 setzen darauf auf.

## User Stories

- Als Gewerbetreibende:r möchte ich mir mit E-Mail und Passwort ein Konto anlegen, damit ich meine Ausgaben an einem Ort erfassen kann.
- Als wiederkehrende:r Nutzer:in möchte ich mich anmelden, damit ich meine bereits erfassten Ausgaben wiederfinde.
- Als Nutzer:in möchte ich sicher sein, dass ausschließlich ich meine Ausgaben sehe, damit ich auch unangenehme Beträge ehrlich eintrage.
- Als Nutzer:in möchte ich mich abmelden können, damit an einem geteilten Rechner niemand in meinen Zahlen liest.
- Als Nutzer:in möchte ich mein Konto löschen können, damit meine Daten verschwinden, wenn ich das Produkt nicht mehr nutze.
- Als Nutzer:in möchte ich, dass mein Konto nicht durch automatisiertes Passwort-Raten übernommen werden kann.

## Out of Scope

- **E-Mail-Bestätigung bei der Registrierung** — bewusst zurückgestellt (Zeitbudget). Später ein Config-Flag plus eine Bestätigungsroute, kein Umbau.
- **Passwort vergessen / Reset** — dito, hängt am selben Mail-Weg.
- **E-Mail-Adresse ändern** (Art. 16 DSGVO) — bewusste Zurückstellung.
- **Anzeigename, Profilbild, Firmendaten** — Datenminimierung, für Registrierung und Anmeldung nicht erforderlich.
- **Soziale Logins** (Google, Apple) und **Zwei-Faktor-Authentifizierung**.
- **Rollen, Teams, Mehrbenutzer-Konten** — Non-Goal im PRD.
- **CAPTCHA auf der Registrierung** — siehe Open Questions.
- **Auskunft und Datenexport** (Art. 15/20 DSGVO) — verschoben nach PROJ-2, wo es Ausgabendaten zu exportieren gibt.
- **Datenschutzerklärung und Impressum** — fällig vor öffentlicher Erreichbarkeit, siehe `docs/privacy.md`.

## Acceptance Criteria

<!-- Deutsch: Angenommen [Vorbedingung], wenn [Aktion], dann [Ergebnis]
     Jedes AC hat eine stabile ID. Tasks referenzieren sie, qa-report.md berichtet pro AC-ID.
     Kette: AC → Task → Test. IDs werden nie neu vergeben. -->

### Registrierung

- [ ] **AC-1** — Angenommen ein:e Besucher:in ist auf `/signup`, wenn eine gültige E-Mail-Adresse und ein Passwort mit mindestens 10 Zeichen abgeschickt werden, dann wird das Konto angelegt, die Person ist sofort angemeldet und landet auf `/`
- [ ] **AC-2** — Angenommen ein Konto wurde soeben angelegt, wenn die Registrierung abgeschlossen ist, dann existiert automatisch ein zugehöriger `profiles`-Eintrag, ohne dass ein weiterer Schritt nötig war
- [ ] **AC-3** — Angenommen ein:e Besucher:in ist auf `/signup`, wenn ein Passwort mit weniger als 10 Zeichen abgeschickt wird, dann erscheint eine Fehlermeldung am Passwortfeld und es wird kein Konto angelegt
- [ ] **AC-4** — Angenommen ein:e Besucher:in ist auf `/signup`, wenn eine Zeichenkette ohne gültiges E-Mail-Format abgeschickt wird, dann erscheint eine Fehlermeldung am E-Mail-Feld und es wird kein Konto angelegt
- [ ] **AC-5** — Angenommen zu einer E-Mail-Adresse existiert bereits ein Konto, wenn damit erneut registriert wird, dann erscheint eine Meldung, dass die Adresse bereits vergeben ist, und es wird kein zweites Konto angelegt

### Anmeldung

- [ ] **AC-6** — Angenommen ein Konto existiert, wenn die richtige E-Mail-Adresse und das richtige Passwort auf `/login` abgeschickt werden, dann ist die Person angemeldet und landet auf `/`

### Schutz vor automatisiertem Erraten

- [ ] **AC-7** — Angenommen eine Anmeldung schlägt fehl, wenn die Fehlermeldung angezeigt wird, dann ist sie für eine unbekannte Adresse und ein falsches Passwort wortgleich und verrät nicht, ob die Adresse existiert
- [ ] **AC-8** — Angenommen es gab 5 fehlgeschlagene Anmeldeversuche für dieselbe E-Mail-Adresse innerhalb von 15 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er abgelehnt und die Person sieht, in wie vielen Minuten sie es erneut versuchen kann
- [ ] **AC-9** — Angenommen es gab 5 fehlgeschlagene Anmeldeversuche von derselben IP-Adresse innerhalb von 15 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er abgelehnt — unabhängig davon, welche E-Mail-Adressen dabei verwendet wurden
- [ ] **AC-10** — Angenommen ein Anmelde- oder Registrierungsformular wird abgeschickt, wenn die Anfrage übertragen wird, dann erscheinen E-Mail-Adresse und Passwort zu keinem Zeitpunkt in der URL

### Zugriffsschutz

- [ ] **AC-11** — Angenommen niemand ist angemeldet, wenn `/` aufgerufen wird, dann erfolgt eine Weiterleitung auf `/login`
- [ ] **AC-12** — Angenommen jemand ist angemeldet, wenn `/login` oder `/signup` aufgerufen wird, dann erfolgt eine Weiterleitung auf `/`
- [ ] **AC-13** — Angenommen es existieren zwei Konten A und B, wenn Konto A die Daten von Konto B direkt über die Datenbank-Schnittstelle abzurufen versucht, dann liefert die Datenbank kein Ergebnis — auch wenn der Anwendungscode umgangen wird

### Abmelden

- [ ] **AC-14** — Angenommen jemand ist angemeldet, wenn „Abmelden" gewählt wird, dann ist die Sitzung beendet, es erfolgt eine Weiterleitung auf `/login`, und der Zurück-Button stellt den geschützten Bereich nicht wieder her

### Kontolöschung und Aufbewahrung

- [ ] **AC-15** — Angenommen jemand ist angemeldet, wenn die Kontolöschung gewählt und in einem Bestätigungsdialog bestätigt wird, dann werden Konto, Profil und alle zugehörigen Daten entfernt, die Person wird abgemeldet, und eine erneute Anmeldung mit denselben Zugangsdaten schlägt fehl *(Art. 17 DSGVO)*
- [ ] **AC-16** — Angenommen die Drosselung hat Zähler zu fehlgeschlagenen Versuchen gespeichert, wenn seit dem letzten Versuch 24 Stunden vergangen sind, dann sind diese Daten samt IP-Adresse gelöscht *(Art. 5 Abs. 1 lit. e DSGVO)*

## Edge Cases

- **EC-1** — Angenommen jemand klickt zweimal schnell auf „Registrieren", wenn beide Anfragen durchgehen, dann entsteht genau ein Konto und die Person sieht keinen Fehler
- **EC-2** — Angenommen zwei Registrierungen mit derselben E-Mail-Adresse treffen gleichzeitig ein, wenn beide verarbeitet werden, dann gewinnt genau eine und die andere erhält die Meldung aus AC-5
- **EC-3** — Angenommen jemand ist angemeldet und die Sitzung läuft ab, wenn danach eine Aktion ausgelöst wird, dann erfolgt eine Weiterleitung auf `/login` mit einem Hinweis, dass die Sitzung abgelaufen ist — nicht eine stumme Fehlermeldung
- **EC-4** — Angenommen die Datenbank ist nicht erreichbar, wenn eine Anmeldung versucht wird, dann erscheint eine verständliche Meldung, das Passwortfeld wird geleert, und die eingegebenen Daten landen nicht in der URL
- **EC-5** — Angenommen jemand hat die App in zwei Browser-Tabs offen, wenn im ersten Tab das Konto gelöscht wird, dann führt die nächste Aktion im zweiten Tab zur Weiterleitung auf `/login` statt zu einem Absturz
- **EC-6** — Angenommen ein Passwort enthält führende oder nachgestellte Leerzeichen, wenn es bei Registrierung und Anmeldung verwendet wird, dann verhalten sich beide gleich — das Passwort wird in beiden Fällen identisch behandelt

## Technical Requirements

- Zugriffsschutz wird **zusätzlich auf Datenbankebene** durchgesetzt (Row Level Security), nicht nur im Anwendungscode — zwei unabhängige Prüfungen
- Das Passwort wird zu keinem Zeitpunkt im Klartext gespeichert, protokolliert oder in einer Fehlermeldung ausgegeben
- Die Anmeldung ist auch bei aktivierter Drosselung in unter 500 ms beantwortet

## Open Questions

- [ ] **CAPTCHA auf der Registrierung** — bewusst zurückgestellt, weil ein Provider-Konto und ein Key nötig wären und das Formular ohne Deployment nur lokal erreichbar ist. Vor dem ersten öffentlichen Zugang nachzuholen.
- [ ] **Signup-Enumeration:** AC-5 verrät, dass eine Adresse bereits registriert ist. Das ist die unvermeidliche Folge der Entscheidung gegen die E-Mail-Bestätigung — ohne Bestätigungsmail gibt es keine Antwort, die für beide Fälle gleich aussieht. Akzeptiert fürs MVP; die Bestätigung würde es schließen.
- [ ] **§ 132 BAO:** Darf eine Kontolöschung die erfassten Belegdaten wirklich entfernen, oder greift die 7-jährige Aufbewahrungspflicht durch? Würde AC-15 umkehren. Frage für Jurist:innen, Kontext in `docs/privacy.md`.
- [ ] **Aufbewahrungsdauer der Supabase-Auth-Protokolle** (`auth.audit_log_entries`) — Voreinstellung noch nicht geprüft.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Keine E-Mail-Bestätigung | Zeitbudget 2–3 Std. für das ganze Feature inkl. QA; hält den Prüfungs-Durchlauf kurz. Später ein Config-Flag plus eine Route | 2026-08-27 |
| Kein Passwort-Reset | Hängt am selben Mail-Weg; ohne echte Nutzer:innen kostet ein neues Demo-Konto nichts | 2026-08-27 |
| Mindestpasswort 10 statt 6 Zeichen | Supabase' Voreinstellung von 6 ist heute keine Hürde | 2026-08-27 |
| Eigene Drosselung 5 Versuche / 15 Min, pro E-Mail **und** pro IP | Supabase drosselt 30 Versuche / 5 Min nur pro IP — das sind rund 8.600 Versuche pro Tag auf ein einzelnes Konto und wirkt gegen verteilte Angriffe gar nicht | 2026-08-27 |
| Keine Namens- oder Firmenfelder | Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO); für Registrierung und Anmeldung nicht erforderlich | 2026-08-27 |
| Kontolöschung schon in PROJ-1 | Kostet jetzt einen Button und eine Kaskade, nachträglich deutlich mehr | 2026-08-27 |
| Auskunft und Export nach PROJ-2 | In PROJ-1 bestünde der Export aus E-Mail-Adresse und Registrierungsdatum — sinnvoll erst mit Ausgabendaten | 2026-08-27 |
