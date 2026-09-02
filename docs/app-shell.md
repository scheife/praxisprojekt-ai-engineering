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
| Konto (`/konto`) | Angemeldete Adresse sehen, Konto löschen · Ausgaben als CSV mitnehmen | angemeldet | PROJ-1 (Bereich) · PROJ-2 (Export-Abschnitt) |

Mehr Bereiche gibt es nicht. **Keine Navigationsliste** — bei zwei angemeldeten Bereichen, von denen
einer selten aufgerufen wird, hätte sie nichts zu zeigen. `/konto` wird aus dem Header verlinkt.

**Zu `/konto`** (ergänzt von `/architecture PROJ-1`): Der Bereich entstand, weil AC-14 (Abmelden) und
AC-15 (Konto löschen) einen Ort brauchen, den Header aber PROJ-2 baut — und PROJ-1 ausgeliefert wird,
bevor es PROJ-2 gibt. Die Abmelde-Aktion selbst gehört PROJ-1; der Header von PROJ-2 ruft **dieselbe**
Aktion auf, statt eine zweite zu bauen.

**Abmelden steht seit `/refine PROJ-1` (2026-08-31) nur noch im Header** — genau eine Schaltfläche je
angemeldeter Seite, festgeschrieben als **PROJ-1 AC-19**. Solange es den Header nicht gab, war die
Konto-Karte der einzige Ort; danach standen zwei identisch benannte Schaltflächen auf derselben Seite,
für Screenreader nicht unterscheidbar (QA-Bericht von PROJ-2, BUG-3). Die Karte auf `/konto` trägt
jetzt nur noch die E-Mail-Adresse. **Die Aktion bleibt PROJ-1**, nur ihr Ort liegt im Rahmen.

**Der Export-Abschnitt auf `/konto`** (ergänzt von `/architecture PROJ-2`): Die Karte „Deine Daten
mitnehmen" und die Route `/konto/export`, die die CSV-Datei bei jedem Abruf erzeugt, gehören **PROJ-2** —
sie betreffen Ausgabendaten. Der **Bereich `/konto` selbst und sein Zugriffsschutz bleiben bei PROJ-1**.
Damit ist die offene Frage aus `spec.md` von PROJ-2 beantwortet.

**Bis PROJ-2 gebaut ist**, ist `/` eine geschützte Platzhalterseite mit einem Satz und einem Link auf
`/konto`. PROJ-2 ersetzt ihren Inhalt — der Zugriffsschutz der Route bleibt, wie PROJ-1 ihn gelegt hat.

## Layout-Regionen

- **Header (56px):** durchgehend auf **beiden** angemeldeten Seiten. Wortmarke `auslage.` links ·
  Monatswechsler (`‹ August 2026 ›`) mittig · Link „Konto" und Abmelden rechts.
  **Auf `/konto` ohne Monatswechsler** — dort gibt es keinen Monat zu wechseln (festgelegt von
  `/architecture PROJ-2`, TD-20).
  Der Header wird **von jeder Seite selbst gerendert**, nicht von einem gemeinsamen Layout: ein Layout
  bekommt in Next.js 16 keine Adressparameter, könnte den angezeigten Monat also gar nicht kennen
  (PROJ-2, TD-10).
- **Inhalt:** max. 1180px, zentriert.
- **Keine Sidebar.**
- **Login und Signup tragen keinen Rahmen:** zentrierte Karte, nur die Wortmarke darüber. Hinter der
  Karte liegt ein weicher Schein in Olive — er trennt sie vom Grund, der sonst fast dieselbe
  Helligkeit hat (Details im `design.md` von PROJ-1, dem beide Seiten gehören).
  **`/konto` folgte demselben Muster, solange es den Header noch nicht gab** — **ohne** den Schein.
  Mit PROJ-2 bekommt `/konto` den Header und damit den Hintergrund des angemeldeten Bereichs; die
  beiden Konto-Karten von PROJ-1 bleiben inhaltlich unverändert darunter stehen.
- **Mobil (unter `md`):** Header bleibt, der Monatswechsler rückt in eine zweite Zeile. Kein Burger —
  es gibt nichts zu verbergen.

## Seitenmuster

- **Seitenkopf:** Titel links, **höchstens eine** hervorgehobene Hauptaktion rechts (Olive).
  _Präzisiert von `/architecture PROJ-2`:_ Die Regel galt ursprünglich als „genau eine". Sie gilt für
  Seiten, die eine Hauptaktion **haben**. Auf `/` ist das Erfassen die Hauptaktion und steht als
  dauerhaft sichtbare Zeile im Inhalt statt als Knopf im Seitenkopf — so in `spec.md` von PROJ-2
  entschieden, weil ein Dialog pro Ausgabe einen Klick und einen Kontextwechsel kostet.
- **Ladezustand:** Skeletons in `--muted` an der Stelle des künftigen Inhalts. Kein Spinner-Overlay.
  Wo eine Ladedatei (`loading.tsx`) auch fremde Seiten träfe, wird stattdessen eine Suspense-Grenze
  **in der Seite** gesetzt — so auf `/`, weil eine Ladedatei unter `src/app/` auch für `/login` und
  `/signup` gälte (PROJ-2, TD-12).
- **Leerzustand:** ausformuliert — ein Satz, was hier stehen wird, plus die Hauptaktion. Nie eine leere
  Tabelle.
- **Fehlerzustand:** Feldfehler direkt am verursachenden Feld in `--destructive`; bei mehreren Feldern
  zusätzlich eine zusammenfassende Zeile über dem Formular.
- **Zeitüberschreitungs-Zustand:** _Ergänzt von `/refine PROJ-2` (01.09.2026, EC-4 und EC-12),
  umbenannt und geschärft am 02.09.2026 (EC-13)._ Antwortet die Datenbank oder der Auth-Server
  binnen **2 Sekunden** nicht, zeigt die geschützte Seite an der Stelle des Inhalts einen eigenen
  Zustand — ein Satz, dass es zu lange gedauert hat, plus die Möglichkeit, es erneut zu versuchen.
  Er ist **weder** der Leerzustand („hier steht noch nichts") **noch** der Fehlerzustand am Feld:
  Beide behaupten, die App habe die Lage verstanden. Hier hat sie es ausdrücklich nicht — **und
  genau deshalb sagt sie auch nicht, woran es lag.** Er hieß bis zum 02.09.2026
  „Nicht-erreichbar-Zustand"; schon der Name behauptete eine Ursache, die eine abgelaufene Frist
  nicht hergibt (`/qa PROJ-3`, BUG-6).
- **Rückmeldungen:** Toast unten rechts, `--popover` als Fläche, 180ms.

## Anmeldezustände

- **Abgemeldet:** erreichbar sind nur `/login` und `/signup`. Der Aufruf von `/` oder `/konto` leitet
  auf `/login`.
- **Angemeldet:** erreichbar sind `/` und `/konto`. Der Aufruf von `/login` oder `/signup` leitet auf `/`.
- **Wer das durchsetzt:** die Vorprüfung in `proxy.ts` (in Next.js 16 die frühere `middleware.ts`) **und**
  zusätzlich jede geschützte Seite selbst. Beides gehört PROJ-1 und gilt für jedes spätere Feature mit.
- **Nicht prüfbar:** _Ergänzt von `/refine PROJ-2` (01.09.2026, EC-12)._ Ein dritter Zustand neben
  an- und abgemeldet: Die Sitzungsprüfung läuft in die Frist, die App **weiß nicht**, wer da ist. Sie
  behandelt das **nicht** als abgemeldet und leitet **nicht** auf `/login` — dort bräuchte es denselben
  Auth-Server, die angebotene Handlung könnte also gar nicht gelingen. Stattdessen der
  Zeitüberschreitungs-Zustand oben.
- **Rollen:** keine. Alle angemeldeten Personen sehen dieselbe Oberfläche, jeweils nur mit den eigenen
  Daten.

## Rahmen-Komponenten

| Komponente | Datei | Zweck | Gebaut von |
|---|---|---|---|
| `Wordmark` | `src/components/wordmark.tsx` | `auslage.` mit olivem Punkt — auch auf Login/Signup | **PROJ-1** |
| `AppHeader` | `src/components/shell/app-header.tsx` | Wortmarke, Monatswechsler (optional), Link auf `/konto`, Abmelden | PROJ-2 |
| `MonthSwitcher` | `src/components/shell/month-switcher.tsx` | `‹ August 2026 ›` als echte Links mit `?monat=`, Grenzen aus den Daten | PROJ-2 |

**`PageHeader` entfällt** (entschieden von `/architecture PROJ-2`, TD-21): Bei zwei angemeldeten
Seiten, von denen eine gar keine hervorgehobene Hauptaktion hat, gäbe es nichts zu teilen. Kommt eine
dritte Seite dazu, wird die Komponente aus echten Aufrufern gebaut statt aus einer Vermutung.

**Das Fundament unter dem Rahmen legt PROJ-1**, weil es das erste Feature mit Oberfläche ist: das
Wurzel-Layout (`lang="de"`, Dark fest gesetzt, Schriften über `next/font/google`), die Farb-Tokens in
`globals.css`, der Toaster für die Rückmeldungen und die Sicherheits-Header. PROJ-2 baut seinen Header
**in** dieses Layout hinein, statt es zu ersetzen.

---

_Lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Region oder ein Seitenmuster
ergänzt, aktualisiert es zuerst diese Karte. Verhaltensänderungen am Rahmen laufen über `/refine` auf
dem besitzenden Feature — nie direkt in das `design.md` eines Features._
