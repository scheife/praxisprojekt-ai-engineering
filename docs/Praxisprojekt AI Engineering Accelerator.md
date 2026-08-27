
# Praxisprojekt — AI Engineering Accelerator

> [!note] Zweck dieser Notiz
> Referenz-Briefing für die praktische Prüfung des [[Das AI Engineering Kit — Überblick|AI Engineering Accelerator]]-Kurses. Wird **vor** `/init` erstellt, damit die Kit-Session direkt mit klarer Vision, Zielgruppe und Feature-Definition starten kann — nicht als Ersatz für `/init`, `/write-spec` etc., sondern als Vorlage dafür.
>
> Entstanden aus einer `/grilling`-Session mit Tim (Team Manager).

## 🎯 Auftrag (Prüfungsanforderung)

Ein SaaS-Produkt mit **drei Features**, gebaut **ausschließlich** über den spec-getriebenen Workflow des AI Engineering Kits (`/init → /write-spec → /architecture → /tasks → /build → /qa` — pro Feature einzeln durchlaufen).

Geprüft wird:
1. **Workflow-Treue** — pro Feature `spec.md`, `design.md`, `tasks.md`, `qa-report.md`; AC-IDs durchgängig von Spec bis QA; `features/INDEX.md` am Ende für alle drei Features auf „Approved"; Git-Historie zeigt Spec-vor-Build-vor-QA-Reihenfolge (nicht nachträglich zusammengeschrieben); keine Secrets im Repo.
2. **Funktionsfähigkeit** — Login/Signup funktioniert, externe Integration ist nachvollziehbar, Feature 3 erfüllt seine eigenen ACs.

Kein Server-Deployment nötig. Abgabe: öffentlicher GitHub-Link + kurze Projektbeschreibung.

## 💡 Produktidee

**Ausgaben-Tracker für Gewerbetreibende** — kleine, eigenständige App, mit der Freelancer/Kleingewerbetreibende ihre Geschäftsausgaben erfassen und eine Monatsübersicht sehen.

**Zielgruppe:** Gewerbetreibende / Freelancer mit einfacher Buchhaltung (wie Alex selbst mit alexmacht) — Personen, die schnell Ausgaben festhalten wollen, ohne ein volles Buchhaltungssystem zu brauchen.

**Vision:** Eigenständiges Mini-Produkt, komplett getrennt von [[Website & Business OS – Technik|Business OS]] (dessen produktives Buchhaltungsmodul unangetastet bleibt). Nach der Prüfung ggf. Weiterentwicklung Richtung eigenständigem Mini-Produkt (Paul-Terrain: Mini-Produkte für andere Gewerbetreibende) — **kein** Plan, es in die Business-OS-Produktionsdatenbank zu migrieren.

> [!warning] Bewusste Trennung von Business OS
> Business OS hat bereits ein produktives Buchhaltungsmodul (`bookings`, `belege`, EAR-Berechnung, Steuerberater-CSV — Migrationen 0028–0034). Dieses Praxisprojekt ist **keine** Erweiterung davon und rührt weder an dessen Code noch an dessen Supabase-Projekt oder echten Finanzdaten. Zwei komplett getrennte Welten — bewusst, wegen Prüfungs-Einsicht in den Code (siehe Setup-Hinweise unten).

## 🧩 Die drei Features

### Feature 1 — Sign-up & Login (Pflicht)
- E-Mail + Passwort über Supabase Auth
- Geschützter Bereich (Dashboard mit Ausgaben) nur für angemeldete Nutzer sichtbar
- **RLS:** Tabelle `expenses`, Policy `user_id = auth.uid()` — jeder Nutzer sieht nur eigene Ausgaben
- Baut automatisch die Grundlage für Mehrbenutzerfähigkeit (falls später als Mini-Produkt für mehrere Kunden gedacht)

### Feature 2 — Externe Integration (Pflicht)
- **Wechselkurs-API** ([frankfurter.app](https://www.frankfurter.app/) — kostenlos, kein API-Key nötig)
- Bei Ausgaben in Fremdwährung (z.B. USD von Amazon.com/AliExpress-Rechnungen) wird der EUR-Gegenwert live berechnet und angezeigt
- Reiner GET-Request, kein Secret zu verwalten — geringstmögliches Integrationsrisiko

### Feature 3 — Ausgaben erfassen & Monatsübersicht (frei gewählt)
**MVP-Umfang** (bewusst klein für 8–12 ACs):
- Ausgabe anlegen / bearbeiten / löschen: Betrag, Währung, Kategorie, Datum, Notiz
- Kategorien-Liste (fix vorgegebene Kategorien reicht, keine eigene Kategorienverwaltung nötig)
- Monatsübersicht: Summe pro Kategorie + Gesamtsumme
- Wechselkurs-Anzeige bei Fremdwährungs-Einträgen (Verbindung zu Feature 2)
- **Explizit nicht enthalten:** Beleg-Foto-Upload, Steuerberater-Export, Mehrjahres-Historie, Budget-Warnungen — alles mögliche spätere Erweiterungen, nicht Teil dieser Prüfung

## 🛠️ Tech-Stack (durch das Kit vorgegeben)

Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth + Postgres) · Vitest · Playwright

## 📁 Aktueller Stand

- Scaffold existiert bereits: `~/Develop/01_produkte/SAAS/praxisprojekt-ai-engineering`
- Ein Commit vorhanden ("scaffold with AI Engineering Kit"), `.gitignore` blockt `.env*` korrekt
- `/init` wurde noch **nicht** ausgeführt — `docs/PRD.md` und `features/INDEX.md` sind noch leere Templates
- Node, npm, git, GitHub CLI (als `scheife` authentifiziert), Supabase CLI — alles startklar

## ✅ Vorbereitungsschritte (vor `/init`)

1. **Neuer Supabase-Account** anlegen (bestehender Account hat keinen freien Free-Slot mehr) → neues, leeres Projekt nur für dieses Praxisprojekt
2. Supabase-URL + Anon-Key in `.env.local` eintragen (lokal, **nicht** committen — `.gitignore` erlaubt nur `.env.local.example`)
3. GitHub-Repo `praxisprojekt-ai-engineering` **public** anlegen und pushen (macht Alex selbst in VS Code) — **möglichst früh**, damit die komplette Kit-Historie (Spec → Build → QA) von Anfang an im öffentlichen Git-Log nachvollziehbar mitläuft
4. `/init` im Projektordner starten, Arbeitssprache **Deutsch** wählen, dieses Briefing als Referenz für Vision/Zielgruppe/Features geben

## ⚠️ Stolperfallen im Hinterkopf

- **Reihenfolge im Git-Log zählt** — Spec-Commits müssen vor Build-Commits, Build vor QA liegen. Nicht alles am Ende in einem Rutsch committen.
- **Keine echten/sensiblen Daten** — nur Demo-/Test-Ausgaben eintragen, nie echte alexmacht-Belege oder echte Beträge aus dem produktiven Business OS
- **Secrets** — `.env.local` bleibt lokal, niemals `git add -f` darauf anwenden
- **`features/INDEX.md`** muss am Ende für alle drei Features auf „Approved" stehen — nicht vergessen, nach `/qa` auch den Status zu aktualisieren falls das nicht automatisch passiert
- Kein Deployment nötig laut Aufgabenstellung — trotzdem lokal einmal durchklicken (Signup → Login → Ausgabe anlegen → Wechselkurs sehen), damit die „Funktionsfähigkeit" beim Review nachvollziehbar ist

## 🕐 Zeitrahmen

Kein fixer Abgabetermin bekannt (nur Anfragedatum der Prüfung vorhanden). Grobe Planung: **ein Wochenende / ca. 6–8 Std. gesamt** (2–3 Std. pro Feature inkl. komplettem Kit-Workflow).

## 🔗 Kontext

- [[Beleg – AI Engineering Accelerator 2026-08-21]] — Kurs-Rechnung (349€)
- [[Das AI Engineering Kit — Überblick]] — Kit-Workflow-Referenz
- [[Businessplan alexmacht]] — Kurs als SaaS-Produktentwicklungs-Baustein vermerkt
- [[Website & Business OS – Technik]] — bestehendes produktives Buchhaltungsmodul (bewusst getrennt gehalten, siehe oben)
