# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Mapped** - already built before the kit arrived; proposed by `/map`, confirmed at `/init`, no spec folder yet — `/reverse-spec` writes it
- **Spec'd** - `/reverse-spec` done: runs in production, criteria confirmed, not yet verified — `/qa` closes that gap
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **Tasked** - `/tasks` done, tasks.md approved, ready to build
- **In Progress** - `/build` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

> The **Spec** column links to the feature **folder** (`features/PROJ-X-name/`), not a single file. Each folder contains `spec.md`, `design.md`, `tasks.md`, and `qa-report.md`.
>
> **Feature** is the name only — two to four words, the way you would say it ("User accounts & login", "Kanban board"). **Description** is one sentence of what it does. Priority and dependencies are not columns: they are the **build order** line under the table, and it is the only place they live — there is no second roadmap table anywhere else.

| ID | Feature | Description | Status | Spec | Created |
|----|---------|-------------|--------|------|---------|
| PROJ-1 | Konto & Anmeldung | Registrierung und Login per E-Mail und Passwort; der Ausgabenbereich ist nur angemeldet erreichbar, und jede Person sieht ausschließlich die eigenen Daten. | Approved | [PROJ-1-accounts-auth](PROJ-1-accounts-auth/) | 2026-08-27 |
| PROJ-2 | Ausgaben & Monatsübersicht | Ausgaben in Euro anlegen, bearbeiten und löschen (Betrag, Kategorie, Datum, Notiz) und je Monat Summe pro Kategorie plus Gesamtsumme sehen. | Tasked | [PROJ-2-expenses-monthly-overview](PROJ-2-expenses-monthly-overview/) | 2026-08-27 |
| PROJ-3 | Fremdwährung & Wechselkurs | Ausgaben in Fremdwährung erfassen, mit dem Kurs ihres Ausgabetags in Euro umrechnen und den verwendeten Kurs samt Datum ausweisen. | Approved | [PROJ-3-foreign-currency-exchange-rate](PROJ-3-foreign-currency-exchange-rate/) | 2026-08-27 |
| PROJ-4 | CSV-Import | Eine CSV-Datei mit Ausgaben einlesen, statt jede Zeile von Hand zu erfassen. | Roadmap | — | 2026-09-02 |
| PROJ-5 | Datenschutzerklärung | Offenlegen, welche Daten wo verarbeitet werden — einschließlich Supabase als Auftragsverarbeiter. | Roadmap | — | 2026-09-02 |

**Build order:** P0 (MVP): PROJ-1 → PROJ-2 (braucht PROJ-1) → PROJ-3 (braucht PROJ-2) · P1 (nach der Prüfung): PROJ-5 → PROJ-4 (braucht PROJ-2)

**Warum PROJ-4 und PROJ-5 vertagt sind** (entschieden am 02.09.2026, aus dem Feedback am laufenden Stand):

- **PROJ-4 CSV-Import** ist kein kleiner Bruder des Exports (PROJ-2, AC-27). Der Export schreibt, was da
  ist; der Import muss doppelte Zeilen, unbekannte Kategorien, Fremdwährung mit oder ohne mitgelieferten
  Kurs und den Teilausfall mitten in der Datei entscheiden. Das ist realistisch der Umfang von PROJ-2 und
  passt nicht mehr in den Zeitrahmen des PRD.
- **PROJ-5 Datenschutzerklärung** war schon vorher als offene Frage in `PROJ-2/spec.md` vermerkt: fällig
  **vor dem ersten öffentlichen Zugang**, und laut `docs/PRD.md` ist kein Deployment vorgesehen. Der
  Wunsch nach einem Footer kam aus demselben Bedürfnis — dass sichtbar ist, wo die Daten liegen. Ein
  Footer, der auf eine nicht existierende Seite verlinkt, wäre allerdings schlechter als keiner.

<!-- Add features above this line -->

## Next Available ID: PROJ-6
