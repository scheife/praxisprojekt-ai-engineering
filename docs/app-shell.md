# App-Rahmen & Navigation — auslage.

> Die app-weite Karte **des Rahmens, in dem jedes Feature angezeigt wird** — Navigation,
> Layout-Regionen und die Muster, die jede Seite wiederholt.
>
> - Angelegt von `/init` (der erste ganzheitliche Durchgang: Bereiche + Layout).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Struktur, nicht Gestaltung. Welche Bereiche es gibt, wo sie liegen, wer sie sieht, was
>   jede Seite teilt. Farben, Schriften und Komponenten-Styling stehen in `docs/design-system.md`; die
>   Innenseiten einer einzelnen Seite im `design.md` ihres Features.

## Besitzendes Feature

**Owner: PROJ-2 — Ausgaben & Monatsübersicht.**

Es gibt kein eigenes „App Shell"-Feature: `auslage.` hat genau einen angemeldeten Bereich, der Rahmen
ist ein Header. Er gehört deshalb dem Feature, das den Bildschirm baut, auf dem er sitzt. Änderungen am
Rahmen laufen über `/refine PROJ-2`, nicht über das `design.md` eines anderen Features.

## Top-Level-Bereiche

| Bereich | Was man dort tut | Sichtbar für | Besitzendes Feature |
|---|---|---|---|
| Anmelden (`/login`) | Mit E-Mail und Passwort anmelden | abgemeldet | PROJ-1 |
| Registrieren (`/signup`) | Konto anlegen | abgemeldet | PROJ-1 |
| Ausgaben & Monatsübersicht (`/`) | Ausgaben erfassen, bearbeiten, löschen; Monatssummen sehen | angemeldet | PROJ-2 |
| Konto (`/konto`) | Abmelden, Konto löschen | angemeldet | PROJ-1 |

Mehr Bereiche gibt es nicht. **Keine Navigationsliste** — bei zwei angemeldeten Bereichen, von denen
einer selten aufgerufen wird, hätte sie nichts zu zeigen. `/konto` wird aus dem Header verlinkt.

**Zu `/konto`** (ergänzt von `/architecture PROJ-1`): Der Bereich entstand, weil AC-14 (Abmelden) und
AC-15 (Konto löschen) einen Ort brauchen, den Header aber PROJ-2 baut — und PROJ-1 ausgeliefert wird,
bevor es PROJ-2 gibt. Die Abmelde-Aktion selbst gehört PROJ-1; der Header von PROJ-2 ruft **dieselbe**
Aktion auf, statt eine zweite zu bauen.

**Bis PROJ-2 gebaut ist**, ist `/` eine geschützte Platzhalterseite mit einem Satz und einem Link auf
`/konto`. PROJ-2 ersetzt ihren Inhalt — der Zugriffsschutz der Route bleibt, wie PROJ-1 ihn gelegt hat.

## Layout-Regionen

- **Header (56px):** durchgehend auf der angemeldeten Seite. Wortmarke `auslage.` links · Monatswechsler
  (`‹ August 2026 ›`) mittig · Abmelden rechts.
- **Inhalt:** max. 1180px, zentriert.
- **Keine Sidebar.**
- **Login und Signup tragen keinen Rahmen:** zentrierte Karte auf leerem Grund, nur die Wortmarke
  darüber. **`/konto` folgt demselben Muster**, solange es den Header noch nicht gibt.
- **Mobil (unter `md`):** Header bleibt, der Monatswechsler rückt in eine zweite Zeile. Kein Burger —
  es gibt nichts zu verbergen.

## Seitenmuster

- **Seitenkopf:** Titel links, **genau eine** hervorgehobene Hauptaktion rechts (Olive).
- **Ladezustand:** Skeletons in `--muted` an der Stelle des künftigen Inhalts. Kein Spinner-Overlay.
- **Leerzustand:** ausformuliert — ein Satz, was hier stehen wird, plus die Hauptaktion. Nie eine leere
  Tabelle.
- **Fehlerzustand:** Feldfehler direkt am verursachenden Feld in `--destructive`; bei mehreren Feldern
  zusätzlich eine zusammenfassende Zeile über dem Formular.
- **Rückmeldungen:** Toast unten rechts, `--popover` als Fläche, 180ms.

## Anmeldezustände

- **Abgemeldet:** erreichbar sind nur `/login` und `/signup`. Der Aufruf von `/` oder `/konto` leitet
  auf `/login`.
- **Angemeldet:** erreichbar sind `/` und `/konto`. Der Aufruf von `/login` oder `/signup` leitet auf `/`.
- **Wer das durchsetzt:** die Vorprüfung in `proxy.ts` (in Next.js 16 die frühere `middleware.ts`) **und**
  zusätzlich jede geschützte Seite selbst. Beides gehört PROJ-1 und gilt für jedes spätere Feature mit.
- **Rollen:** keine. Alle angemeldeten Personen sehen dieselbe Oberfläche, jeweils nur mit den eigenen
  Daten.

## Rahmen-Komponenten

| Komponente | Datei | Zweck | Gebaut von |
|---|---|---|---|
| `Wordmark` | `src/components/wordmark.tsx` | `auslage.` mit olivem Punkt — auch auf Login/Signup | **PROJ-1** |
| `AppHeader` | `src/components/app-header.tsx` | Wortmarke, Monatswechsler, Abmelden, Link auf `/konto` | PROJ-2 |
| `PageHeader` | `src/components/page-header.tsx` | Titel + eine Hauptaktion, das gemeinsame Seitenmuster | PROJ-2 |

_Die Pfade sind der Vorschlag von `/init`; festgelegt werden `AppHeader` und `PageHeader` im `design.md`
von PROJ-2._

**Das Fundament unter dem Rahmen legt PROJ-1**, weil es das erste Feature mit Oberfläche ist: das
Wurzel-Layout (`lang="de"`, Dark fest gesetzt, Schriften über `next/font/google`), die Farb-Tokens in
`globals.css`, der Toaster für die Rückmeldungen und die Sicherheits-Header. PROJ-2 baut seinen Header
**in** dieses Layout hinein, statt es zu ersetzen.

---

_Lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Region oder ein Seitenmuster
ergänzt, aktualisiert es zuerst diese Karte. Verhaltensänderungen am Rahmen laufen über `/refine` auf
dem besitzenden Feature — nie direkt in das `design.md` eines Features._
