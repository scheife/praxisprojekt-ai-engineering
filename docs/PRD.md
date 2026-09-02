# Product Requirements Document — auslage.

## Vision

**auslage.** ist ein Ausgaben-Tracker für Gewerbetreibende: Freelancer und Kleingewerbetreibende erfassen ihre Geschäftsausgaben in Sekunden und sehen eine Monatsübersicht pro Kategorie — ohne ein volles Buchhaltungssystem dafür zu brauchen.

Der Name ist das Versprechen und zugleich die Grenze: Was du ausgelegt hast, steht drin — mehr nicht, keine Buchhaltung, kein Steuerabschluss.

Das Produkt entsteht als Praxisprojekt des AI Engineering Accelerator und ist bewusst ein eigenständiges Mini-Produkt, komplett getrennt vom produktiven alexmacht Business OS. Nach der Prüfung kann es Richtung eigenständiges Mini-Produkt für andere Gewerbetreibende weiterwachsen.

## Zielgruppe

Gewerbetreibende und Freelancer mit einfacher Buchhaltung — Menschen, die eine Ausgabe schnell festhalten wollen, während sie sie tätigen, und am Monatsende wissen wollen, wo das Geld hingegangen ist.

**Ihr Schmerz heute:** entweder Zettel und Tabellenkalkulation (geht verloren, wird nie ausgewertet) oder ein Buchhaltungssystem, das für eine Handvoll Belege pro Monat zu schwer ist. Wer im Ausland einkauft (Amazon.com, AliExpress), rechnet Fremdwährungen bisher von Hand um.

## Kernfunktionen (Roadmap)

_Die Feature-Karte — Name, Beschreibung, Status und Baureihenfolge jedes Features — lebt in **`features/INDEX.md`** und nur dort._

Das MVP muss drei Dinge können, damit es überhaupt brauchbar ist: sich anmelden und dabei sicher sein, dass niemand sonst die eigenen Zahlen sieht; eine Ausgabe mit Betrag, Währung, Kategorie, Datum und Notiz anlegen, ändern und löschen; und eine Monatsübersicht mit Summe je Kategorie und Gesamtsumme sehen. Fremdwährungsausgaben werden über eine Wechselkurs-API live in EUR umgerechnet, damit die Summen stimmen.

Bewusst später: Beleg-Fotos, Steuerberater-Export, Mehrjahres-Historie, Budget-Warnungen, eigene Kategorienverwaltung.

## Erfolgskriterien

Das Projekt ist erfolgreich, wenn die Prüfung besteht — und die misst zwei Dinge:

**Workflow-Treue**
- Pro Feature liegen `spec.md`, `design.md`, `tasks.md` und `qa-report.md` vor
- AC-IDs laufen durchgängig von Spec bis QA
- `features/INDEX.md` steht am Ende für alle drei Features auf **Approved**
- Die Git-Historie zeigt die Reihenfolge Spec → Build → QA (nicht nachträglich zusammengeschrieben)
- Keine Secrets im Repo

**Funktionsfähigkeit**
- Signup → Login → Ausgabe anlegen → Wechselkurs sehen → Monatsübersicht lässt sich lokal in einem Durchgang durchklicken

**Produktseitig** (nach der Prüfung, nicht Teil der Bewertung): eine Ausgabe ist in unter 30 Sekunden erfasst.

## Rahmenbedingungen

| | |
|---|---|
| **Produktname** | `auslage.` — der Punkt gehört zur Wortmarke und fällt nie weg, wie bei `alex macht.` |
| **Zeitrahmen** | Ein Wochenende, ca. 6–8 Std. gesamt (2–3 Std. pro Feature inkl. komplettem Kit-Workflow) |
| **Team** | Eine Person |
| **Tech-Stack** | Durch das Kit vorgegeben: Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth + Postgres) · Vitest · Playwright |
| **Environment strategy** | `local` — Supabase läuft während der Entwicklung in Docker; Schemaänderungen als `supabase/migrations/*.sql` im Repo. **Gilt weiter für die Entwicklung**; ob mit dem geplanten gehosteten Projekt (siehe Hosting) daraus `two-projects` wird, ist noch nicht entschieden — Sache eines `/refine` |
| **Lokale Ports** | Supabase läuft auf **55321** (API) / 55322 (DB) / 55323 (Studio) / 55324 (Mailpit) statt der Standard-54xxx. Grund: das alexmacht Business OS hält lokal die Standard-Ports besetzt. Festgehalten in `supabase/config.toml`, damit der Stack reproduzierbar startet |
| **Hosting** | Die App läuft lokal (`npm run dev`), kein Server-Deployment. **Datenhaltung: gehostetes Supabase-Projekt geplant** (bestätigt am 02.09.2026 bei `/dsgvo`) — bis dahin Supabase in Docker. Damit wird Supabase Auftragsverarbeiter; die fälligen Schritte stehen in `docs/privacy.md` → „Wenn es online geht" |
| **Data region** | `eu-central-1` (Frankfurt) — **beim Anlegen des geplanten Projekts zu setzen**. Die Region lässt sich nachträglich **nicht** ändern, ein Wechsel bedeutet ein neues Projekt und eine vollständige Migration |
| **Data protection law** | GDPR (EU/AT) |
| **Data protection stance** | `lean` |
| **Design system** | siehe `docs/design-system.md` — abgeleitet aus dem alexmacht.at Design System (Dark „Signature", Business-OS-Maßstab) |
| **Deployment** | Nicht Teil der Prüfung. Kein Server-Deployment vorgesehen |
| **Repository** | GitHub `scheife/praxisprojekt-ai-engineering`, derzeit **privat**. Für die Abgabe muss es auf **public** umgestellt werden |
| **Trennung vom Business OS** | Kein Zugriff auf Code, Supabase-Projekt oder Daten des produktiven Business OS. Nur Demo-Daten, nie echte alexmacht-Belege oder -Beträge |

## Non-Goals

Ausdrücklich **nicht** in dieser Version:

- Beleg-Foto-Upload
- Steuerberater-Export (CSV/DATEV)
- Mehrjahres-Historie und Jahresauswertung
- Budget-Warnungen
- Eigene Kategorienverwaltung (feste Kategorienliste reicht)
- Einnahmen und EAR-Berechnung
- Mehrbenutzer-Teams
- Server-Deployment
- Jede Form von Migration in die Business-OS-Produktionsdatenbank
