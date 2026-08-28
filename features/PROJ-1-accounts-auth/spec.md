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
- **CAPTCHA auf der Registrierung** — weiterhin zurückgestellt. AC-17 begrenzt die Registrierung stattdessen auf 10 Versuche je Herkunft in 60 Minuten; das ersetzt kein CAPTCHA, weil es gegen einen über viele IPs verteilten Angriff nichts ausrichtet. Siehe Open Questions.
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

> **Warum AC-9 und AC-17 sich unterschiedlich verhalten, wenn keine IP-Adresse erkennbar ist:**
> Beim **Anmelden** gibt es mit AC-8 eine Regel je Konto, die auch ohne IP trägt — ein gemeinsamer
> Zähler würde dort nur dazu führen, dass fünf Fehlversuche von irgendwem alle aussperren, ohne
> Angreifer und Nutzer:innen unterscheiden zu können. Beim **Registrieren** gibt es keine solche
> Rückfallregel, weil jede Adresse neu ist; dort ist der gemeinsame Zähler das Einzige, was
> massenhaftes Anlegen von Konten und das Durchprobieren von Adressen (AC-5) begrenzt. Der Preis
> ist bekannt und angenommen: ohne erkennbare IP sind es 10 Registrierungen je Stunde für alle
> zusammen.

- [ ] **AC-7** — Angenommen eine Anmeldung schlägt fehl, wenn die Fehlermeldung angezeigt wird, dann ist sie für eine unbekannte Adresse und ein falsches Passwort wortgleich und verrät nicht, ob die Adresse existiert
- [ ] **AC-8** — Angenommen es gab 5 fehlgeschlagene Anmeldeversuche für dieselbe E-Mail-Adresse innerhalb von 15 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er abgelehnt und die Person sieht, in wie vielen Minuten sie es erneut versuchen kann
- [ ] **AC-9** — Angenommen die App läuft hinter einem vorgelagerten Server, der ausdrücklich als vertrauenswürdig erklärt wurde und die IP-Adresse der anfragenden Person mitliefert, und es gab 5 fehlgeschlagene Anmeldeversuche von derselben IP-Adresse innerhalb von 15 Minuten, wenn ein weiterer Versuch erfolgt, dann wird er abgelehnt — unabhängig davon, welche E-Mail-Adressen dabei verwendet wurden. **Ohne einen solchen Server greift beim Anmelden ausschließlich AC-8**, und kein Anmeldeversuch wird einem gemeinsamen Zähler zugerechnet *(geändert am 28.08.2026, siehe Decision Log)*
- [ ] **AC-10** — Angenommen ein Anmelde- oder Registrierungsformular wird abgeschickt, wenn die Anfrage übertragen wird, dann erscheinen E-Mail-Adresse und Passwort zu keinem Zeitpunkt in der URL
- [ ] **AC-17** — Angenommen von derselben Herkunft wurden innerhalb von 60 Minuten bereits **10 Registrierungsversuche** unternommen — gezählt werden Versuche, **nicht** angelegte Konten —, wenn ein weiterer Registrierungsversuch erfolgt, dann wird er abgelehnt und die Person sieht, in wie vielen Minuten sie es erneut versuchen kann. Die Meldung spricht von Versuchen, nicht von angelegten Konten. „Dieselbe Herkunft" ist die IP-Adresse, sofern eine vertrauenswürdig erkennbar ist; sonst zählen alle Registrierungsversuche gemeinsam *(geändert am 28.08.2026, siehe Decision Log)*
- [ ] **AC-18** — Angenommen eine Anmeldung schlägt fehl, wenn die Antwortzeiten für eine registrierte und eine unbekannte Adresse gemessen werden, dann sind sie nicht unterscheidbar: die Mediane liegen weniger als 10 % auseinander und die gemessenen Wertebereiche überlappen — bei weiterhin unter 500 ms je Antwort

### Zugriffsschutz

- [ ] **AC-11** — Angenommen niemand ist angemeldet, wenn `/` aufgerufen wird, dann erfolgt eine Weiterleitung auf `/login`
- [ ] **AC-12** — Angenommen jemand ist angemeldet, wenn `/login` oder `/signup` aufgerufen wird, dann erfolgt eine Weiterleitung auf `/`
- [ ] **AC-13** — Angenommen es existieren zwei Konten A und B, wenn Konto A die Daten von Konto B direkt über die Datenbank-Schnittstelle abzurufen versucht, dann liefert die Datenbank kein Ergebnis — auch wenn der Anwendungscode umgangen wird

### Abmelden

- [ ] **AC-14** — Angenommen jemand ist angemeldet, wenn „Abmelden" gewählt wird, dann ist die Sitzung beendet, es erfolgt eine Weiterleitung auf `/login`, und der Zurück-Button stellt den geschützten Bereich nicht wieder her

### Kontolöschung und Aufbewahrung

- [ ] **AC-15** — Angenommen jemand ist angemeldet, wenn die Kontolöschung gewählt und in einem Bestätigungsdialog bestätigt wird, dann werden Konto, Profil und alle zugehörigen Daten entfernt, die Person wird abgemeldet, und eine erneute Anmeldung mit denselben Zugangsdaten schlägt fehl *(Art. 17 DSGVO)*
- [ ] **AC-16** — Angenommen die Drosselung hat Zähler zu Anmelde- **oder Registrierungsversuchen** gespeichert, wenn seit dem jeweiligen Versuch 24 Stunden vergangen sind, dann sind diese Daten samt IP-Adresse gelöscht *(Art. 5 Abs. 1 lit. e DSGVO)*

## Edge Cases

- **EC-1** — Angenommen jemand klickt zweimal schnell auf „Registrieren", wenn beide Anfragen durchgehen, dann entsteht genau ein Konto und die Person sieht keinen Fehler
- **EC-2** — Angenommen zwei Registrierungen mit derselben E-Mail-Adresse treffen gleichzeitig ein, wenn beide verarbeitet werden, dann gewinnt genau eine und die andere erhält die Meldung aus AC-5
- **EC-3** — Angenommen jemand ist angemeldet und die Sitzung läuft ab, wenn danach eine Aktion ausgelöst wird, dann erfolgt eine Weiterleitung auf `/login` mit einem Hinweis, dass die Sitzung abgelaufen ist — nicht eine stumme Fehlermeldung
- **EC-4** — Angenommen die Datenbank ist nicht erreichbar, wenn eine Anmeldung versucht wird, dann erscheint eine verständliche Meldung, das Passwortfeld wird geleert, und die eingegebenen Daten landen nicht in der URL
- **EC-5** — Angenommen jemand hat die App in zwei Browser-Tabs offen, wenn im ersten Tab das Konto gelöscht wird, dann führt die nächste Aktion im zweiten Tab zur Weiterleitung auf `/login` statt zu einem Absturz
- **EC-6** — Angenommen ein Passwort enthält führende oder nachgestellte Leerzeichen, wenn es bei Registrierung und Anmeldung verwendet wird, dann verhalten sich beide gleich — das Passwort wird in beiden Fällen identisch behandelt
- **EC-7** — Angenommen jemand versucht sich wiederholt mit einem sehr kurzen Passwort anzumelden, wenn diese Versuche fehlschlagen, dann zählen sie wie jeder andere Fehlversuch zur Drosselung, und die Meldung nennt nicht die Passwortregel

## Technical Requirements

- Zugriffsschutz wird **zusätzlich auf Datenbankebene** durchgesetzt (Row Level Security), nicht nur im Anwendungscode — zwei unabhängige Prüfungen
- Das Passwort wird zu keinem Zeitpunkt im Klartext gespeichert, protokolliert oder in einer Fehlermeldung ausgegeben
- Die Anmeldung ist auch bei aktivierter Drosselung in unter 500 ms beantwortet

## Open Questions

- [ ] **CAPTCHA auf der Registrierung** — bewusst zurückgestellt, weil ein Provider-Konto und ein Key nötig wären und das Formular ohne Deployment nur lokal erreichbar ist. Vor dem ersten öffentlichen Zugang nachzuholen. → *Teilweise entschärft (28.08.2026): AC-17 begrenzt die Registrierung je IP. Gegen einen über viele IPs verteilten Angriff hilft das nicht — die Frage bleibt offen.*
- [ ] **`docs/privacy.md` beschreibt nur die Anmelde-Drosselung.** Mit AC-17 werden auch Registrierungsversuche mit IP-Adresse festgehalten — dieselben Daten, dieselben 24 Stunden, dieselbe Rechtsgrundlage, aber ein weiterer Personenkreis: nicht mehr nur, wer sich erfolglos anmeldet, sondern jede Person, die ein Konto anlegt. Das Verarbeitungsverzeichnis gehört nachgezogen: `/dsgvo PROJ-1`.
- [ ] **Die Drosselungs-Tore sind für jeden aufrufbar, der den öffentlichen Schlüssel hat.** Eine Anmeldung beginnt ohne Sitzung, also muss die App die Tore mit dem öffentlichen Schlüssel aufrufen — und der steckt in jedem Browser. Damit kann jede:r die Zähler fremder Adressen und fremder IP-Töpfe füllen und so ein Konto oder ein ganzes Büro aussperren. Gemessen am 28.08.2026: fünf anonyme Aufrufe genügen für ein Konto, zehn für eine IP. Vor dem ersten öffentlichen Zugang zu schließen. Der Weg dorthin ist ein Geheimnis, das App und Datenbank teilen und das nicht im Repo liegt — ein `service_role`-Schlüssel scheidet nach TD-6 aus. Kontext: `qa-report.md`, BUG-2.
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
| Eigene Drosselung der Registrierung: 10 Konten je IP in 60 Minuten | Das Design stützte sich auf Supabase' Limit von 30 pro 5 Minuten je IP. QA hat gemessen, dass es diesen Schutz in diesem Stack nicht gibt — 40 von 40 Direktregistrierungen gingen durch. Ohne eigene Grenze ist das Anlegen von Konten unbegrenzt automatisierbar. 10 je Stunde lässt eine Person, eine Familie oder ein kleines Büro durch und stoppt Massenanlage sofort | 2026-08-28 |
| Fehlgeschlagene Anmeldungen brauchen mindestens 350 ms | Ohne feste Untergrenze verriet die Antwortzeit, ob eine Adresse registriert ist: 153 gegen 72 ms, die Wertebereiche überlappten nicht. Ein wortgleicher Meldungstext nützt dann nichts. 350 ms liegt über dem langsamen Pfad und unter der 500-ms-Vorgabe | 2026-08-28 |
| Die IP-Regel beim Anmelden gilt nur hinter einem erklärten Proxy | Ohne vorgelagerten Server kennt die App keine Client-IP. Alle Anfragen in einen gemeinsamen Zähler zu werfen schützt dort nicht, sondern sperrt: QA hat gemessen, dass fünf Fehlversuche auf eine frei erfundene Adresse jede echte Anmeldung für 15 Minuten blockieren. Ein Zähler, der Angreifer und Nutzer:innen nicht unterscheiden kann, ist als Schutz wertlos und als Ausfall teuer. AC-8 je Konto trägt auch ohne IP | 2026-08-28 |
| Beim Registrieren bleibt der gemeinsame Zähler, auch ohne erkennbare IP | Anders als beim Anmelden gibt es hier keine Rückfallregel je Konto — jede Adresse ist neu. Der gemeinsame Zähler ist das Einzige, was massenhaftes Anlegen begrenzt, und die Plattform liefert dafür nachweislich keinen Boden. Der Preis (10 Registrierungen je Stunde für alle zusammen, wenn keine IP erkennbar ist) trifft niemanden, der bereits ein Konto hat | 2026-08-28 |
| AC-17 zählt Versuche, nicht angelegte Konten | Der Code tat das ohnehin; der Wortlaut gibt nach, nicht der Code. Ausschlaggebend war ein zweiter Nutzen: AC-5 verrät, ob eine Adresse ein Konto hat. Zählte die Sperre nur Erfolge, ließe sich damit unbegrenzt durchprobieren, wer hier Kunde ist. Die Meldung wird im Gegenzug ehrlich und spricht von Versuchen | 2026-08-28 |
| Die öffentlich aufrufbaren Drosselungs-Tore bleiben vorerst | Kein billiger Ausweg: Das Recht lässt sich nicht entziehen (die App braucht es selbst), Prüfen und Festhalten zu trennen verlagert das Problem nur, und die Datenbank kann nicht erkennen, ob der Aufruf von der App kommt. Es braucht ein geteiltes Geheimnis außerhalb des Repos. Die Kontosperre selbst ist ohnehin über das Formular auslösbar — neu ist allein das Sperren fremder IP-Töpfe. Als offene Frage geführt, fällig vor öffentlichem Zugang | 2026-08-28 |
| Beim Anmelden gilt keine Mindestlänge für das Passwort | Sie gehört zur Vergabe eines Passworts, nicht zur Prüfung eines eingegebenen. Vorher scheiterten kurze Rateversuche schon an der Schema-Prüfung, liefen damit an der Drosselung vorbei und wurden nicht gezählt — und das Anmeldeformular plauderte die Passwortregel aus | 2026-08-28 |
