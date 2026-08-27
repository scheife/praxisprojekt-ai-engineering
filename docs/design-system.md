# Design System — auslage.

> Abgeleitet aus dem **alexmacht.at Design System** (`docs/alexmacht.at Design System (3)/`, Shell v2).
> Die Werte hier sind verbindlich für `/architecture` und `/build`. Was ohne Quellenangabe steht, ist
> aus dem alexmacht-System übernommen. Abschnitte mit **➕ Neu für auslage.** sind Ergänzungen, die das
> Quellsystem nicht hat, weil es keine Geld-Oberfläche beschreibt.

---

## 1. Welt und Grundhaltung

`auslage.` ist eine **Dashboard-Welt**: Dark „Signature", dicht, werkzeughaft — derselbe Maßstab wie das
alexmacht Business OS, nicht der großzügige Website-Maßstab.

- **Dark Mode ist der Standard und wird ausgeliefert.** Es gibt **keinen Theme-Umschalter**.
- **Die Light-Tokens werden trotzdem von Anfang an definiert** (Abschnitt 3.4). Nicht, weil die App sie
  benutzt, sondern damit sie nicht nachträglich in jedes Bauteil eingezogen werden müssen.
- **Kein Bildzeichen, kein Logo-Symbol.** Die Marke ist rein typografisch.
- **Keine externen Requests im Browser, kein Cookie, kein Tracking.** Schriften werden selbst
  ausgeliefert (Abschnitt 4.1).

---

## 2. Wortmarke

```
auslage.
```

- **Ein Wort**, Space Grotesk **Bold**, Kleinschreibung.
- Wort in `--foreground`, **Punkt in Olive** `#606C38`.
- **Der Punkt gehört dazu** und fällt nie weg — wie bei `alex macht.`
- Kein künstlicher Split (`aus|lage.`): Das Quellsystem ist zweiteilig, weil „alex macht." zwei Wörter
  sind. „auslage" ist eines, und ein Split würde es zerreißen.
- Nie ein Symbol, Monogramm oder Icon danebenstellen.

---

## 3. Farben

### 3.1 Wie die Werte einzusetzen sind

Das Scaffold nutzt das shadcn-Schema: `src/app/globals.css` definiert HSL-**Tripel** ohne
`hsl()`-Wrapper, und `@theme inline` mappt sie über `hsl(var(--token))` auf Tailwind-Utilities.
Deshalb steht unten zu jedem Wert **Hex** (die Markenquelle) **und das Tripel** (was in `globals.css`
eingetragen wird).

### 3.2 Flächen und Text (Dark — der Auslieferungszustand)

| shadcn-Token | Hex | HSL-Tripel | Rolle |
|---|---|---|---|
| `--background` | `#080807` | `60 6.7% 2.9%` | Seitenhintergrund |
| `--foreground` | `#f5f5f0` | `60 20% 95.1%` | Haupttext — 18,3:1 |
| `--card` / `--card-foreground` | `#0d0d0b` / `#f5f5f0` | `60 8.3% 4.7%` / `60 20% 95.1%` | Karten |
| `--popover` / `--popover-foreground` | `#111110` / `#f5f5f0` | `60 3% 6.5%` / `60 20% 95.1%` | Dialoge, Dropdowns, Toast |
| `--sidebar-background` | `#0a0a09` | `60 5.3% 3.7%` | Sidebar |
| `--input` (Feldfläche) | `#151513` | `60 5% 7.8%` | Formularfelder |
| `--muted` | `#191917` | `60 4.2% 9.4%` | gedämpfte Fläche |
| `--muted-foreground` | `#838380` | `60 1.2% 50.8%` | Meta-Text — **5,3:1** |
| `--border` | `#1d1d1c` | `60 1.8% 11.2%` | Standardrahmen |
| — `border-strong` | `#242423` | `60 1.4% 13.9%` | betonter Rahmen |
| — `row-selected` | `#16190f` | `78 25% 7.8%` | ausgewählte Tabellenzeile |

**Der Kontrastboden liegt bei `--muted-foreground`.** Das Quellsystem nutzt für Meta-Text Alpha
`.34–.45`; auf `#080807` ergibt `.44` nur 4,07:1 und `.34` nur 3,1:1 — beides unter 4,5:1. Der Boden
ist deshalb `.52` (5,3:1). **Nie dunkler.** Nur echte inaktive Elemente dürfen darunter
(`rgba(245,245,240,.34)`, WCAG-befreit).

### 3.3 Akzente

| shadcn-Token | Hex | HSL-Tripel | Kontrast | Rolle |
|---|---|---|---|---|
| `--primary` | `#606C38` | `73.8 31.7% 32.2%` | — | **Olive.** Hauptaktion, aktive Navigation, Fokusring |
| `--primary-foreground` | `#f5f5f0` | `60 20% 95.1%` | **5,19:1** | Text auf Olive |
| `--accent` | `#D48806` | `37.9 94.5% 42.7%` | — | **Amber.** Sekundär-Akzent |
| `--accent-foreground` | `#0d0d0d` | `0 0% 5.1%` | **6,78:1** | Text auf Amber — **dunkel, nicht hell** |
| `--destructive` | `#e0534a` | `3.6 70.8% 58.4%` | — | Löschen, Fehler |
| `--destructive-foreground` | `#0d0d0d` | `0 0% 5.1%` | **5,10:1** | Text auf Destructive |
| `--ring` | `#606C38` | `73.8 31.7% 32.2%` | — | Fokusring |

**Die Vordergrundregel ist pro Farbe verschieden und gemessen:** Olive braucht **hellen** Text, Amber
und Destructive brauchen **dunklen**. Nicht vereinheitlichen.

**Olive-Rampe** (für Zustände und Abschnitt 6.2):

| Rolle | Hex | HSL-Tripel |
|---|---|---|
| `olive-dark` (aktiv/gedrückt) | `#4a5329` | `72.9 33.9% 24.3%` |
| `olive` (Basis) | `#606C38` | `73.8 31.7% 32.2%` |
| `olive-hover` | `#7d8c49` | `73.4 31.5% 41.8%` |
| `olive-link` (Links auf Dunkel) | `#8a9a52` | `73.3 30.5% 46.3%` |
| `olive-bright` (Badge-Text auf Tint) | `#a8b86e` | `73 34.3% 57.6%` |

**Tints:** `--olive-tint: rgba(96,108,56,.18)` · `--amber-tint: rgba(212,136,6,.16)` ·
`--red-tint: rgba(224,83,74,.10)` · `--hover: rgba(245,245,240,.04)` · aktive Nav-Zeile
`rgba(96,108,56,.16)`.

### 3.4 Light-Tokens (definiert, nicht ausgeliefert)

Warmer Parchment-Boden aus dem Quellsystem, für den Fall, dass `auslage.` später ein Light-Theme
bekommt. **Kein Umschalter bauen**, solange das nicht beschlossen ist.

`background #edecea` · `card #f8f7f4` · `popover #ffffff` · `input #ffffff` · `foreground #17171a` ·
`muted-foreground rgba(23,23,26,.56)` · `border rgba(23,23,26,.12)` · Text auf Olive `#fafafa`.

---

## 4. Typografie

| Rolle | Familie | Einsatz |
|---|---|---|
| Headings, Wortmarke, Buttons, Labels | **Space Grotesk** | 400/500/600/700 |
| Fließtext, **Tabellen, Formulare** | **Open Sans** | 400/500/600/700 |
| Zahlen | Open Sans mit `tabular-nums` | siehe 5. |

`Newsreader` und `Niconne` aus dem Quellsystem werden hier **nicht** verwendet.

### 4.1 Schriften einbinden (DSGVO)

Kein Google-Fonts-`@import` im Browser. In Next.js liefert **`next/font/google`** die Dateien beim
Build mit aus und serviert sie von der eigenen Domain — kein Runtime-Request zu Google, keine
Font-Binaries im Repo nötig. Das ist der Weg für dieses Projekt.

### 4.2 Skala (App-Maßstab, dicht)

`2xl 32px` · `xl 24px` · `lg 20px` · `md 16px` · **`base 14px`** · `sm 13px` · `xs 11px`

Zeilenhöhen `tight 1.15` · `snug 1.3` · `normal 1.5` · `relaxed 1.65`.
Laufweite: Headings `-0.02em`, Uppercase-Labels `+0.12em`.

### 4.3 Textrollen

| Rolle | Familie / Gewicht / Größe |
|---|---|
| Seitentitel | Space Grotesk Bold 24px, `-0.02em` |
| Kartentitel | Space Grotesk Semibold 20px |
| Fließtext | Open Sans Regular 14px / 1.5 |
| Klein / Meta | Open Sans Regular 13px, `--muted-foreground` |
| Label | Space Grotesk Medium 11px, **UPPERCASE**, `+0.12em`, `--muted-foreground` |

---

## 5. ➕ Neu für auslage. — Zahlen und Beträge

Das Quellsystem beschreibt keine Geld-Oberfläche. Diese Regeln gelten hier zusätzlich und sind der
Grund, warum die App überhaupt lesbar wird:

- **Beträge immer mit `font-variant-numeric: tabular-nums`.** Ohne Tabellenziffern springen die
  Spalten, und untereinanderstehende Summen lassen sich nicht vergleichen.
- **Beträge rechtsbündig**, in Tabellen und in der Monatsübersicht. Labels linksbündig.
- **Dezimaltrennzeichen ist das Komma**, Tausendertrennzeichen der Punkt (`de-AT`). Formatierung über
  `Intl.NumberFormat`, nie von Hand.
- **Währung steht hinter dem Betrag** (`1.234,50 €`), Fremdwährung mit ihrem eigenen Zeichen/Code.
- **Der EUR-Wert ist die Hauptzahl**, der Originalbetrag steht als Meta-Text darunter oder daneben:

  ```
  1.148,20 €              ← --foreground, tabular-nums, rechtsbündig
  1.250,00 USD · 0,9186   ← --muted-foreground, 13px
  ```

- **Umgerechnete Beträge werden markiert**, nie stillschweigend als exakt ausgegeben: Amber-Tint-Badge
  oder Amber-Meta-Text mit dem verwendeten Kurs und seinem Datum. Amber ist in diesem Produkt
  **reserviert** für „umgerechnet / Näherungswert" — nicht für beliebige Hervorhebungen.
- **Die Gesamtsumme ist die einzige Zahl in `2xl`.** Alles andere ordnet sich ihr unter.

---

## 6. Form

### 6.1 Radius, Rahmen, Elevation

| | Wert |
|---|---|
| Buttons, Felder, Nav-Zeilen | **9px** (`--radius`) |
| Karten, Blöcke | 12px |
| Toast, kleine Karten | 11px |
| Checkbox, Marker | 3px |
| Badges, Statuspillen | Pille (20px) |
| Avatare, Punkte | rund |

- **Rahmen sind 1px in Alpha**, nicht Vollton — so funktionieren sie auf jeder Flächenhelligkeit gleich.
- **Keine Schatten im Flächenlayout.** Hierarchie entsteht über Alpha-Rahmen und Flächenhelligkeit.
  Elevation nur für echt Schwebendes: Dialog `0 30px 80px rgba(0,0,0,.55)`, Toast
  `0 14px 40px rgba(0,0,0,.55)`.
- **Fokusring:** `0 0 0 2px rgba(96,108,56,.4)` — Olive, sichtbar, überall.
- **Eine Radius-Entscheidung, überall angewandt.** Gemischte Radien sind das häufigste Zeichen einer
  zusammengesteckten statt entworfenen Oberfläche.

### 6.2 ➕ Neu für auslage. — Kategorien einfärben

Die Monatsübersicht zeigt Summen je Kategorie. **Kein Regenbogen.** Kategorien sind nicht qualitativ
verschieden, sie sind nach Betrag geordnet — also eine Rampe, keine Palette. Die Olive-Rampe aus 3.3
wird nach Rang vergeben, größte Kategorie am hellsten:

`chart-1 #a8b86e` → `chart-2 #8a9a52` → `chart-3 #7d8c49` → `chart-4 #606C38` → `chart-5 #4a5329`

Alles darunter fällt in `--muted-foreground` („Sonstige"). Amber bleibt für die
Fremdwährungs-Markierung reserviert und wird **nie** als Kategoriefarbe verwendet.

### 6.3 Abstände und Maße

4px-Raster: `4 · 8 · 12 · 16 · 20 · 28 · 40 · 56 · 80 · 112`.

| | |
|---|---|
| Container | 1180px |
| Lesebreite Text | 680px |
| Sidebar | 248px |
| Header | 56px |
| Control-Höhe klein / **Standard** / groß | 32px / **36px** / 44px (Touch) |

---

## 7. Bewegung

- **Nur CSS. Keine Animationsbibliothek.**
- Dauern: `fast 120ms` · `base 180ms` · `slow 320ms`.
- Easing: `cubic-bezier(.22,1,.36,1)` (out) · `cubic-bezier(.65,0,.35,1)` (in-out).
- **Inhalte sind im Grundzustand sichtbar** — nie erst durch eine Animation.
- `prefers-reduced-motion` respektieren.
- Ruhig, kurz, kein Bounce.

---

## 8. Komponenten-Konventionen

- **shadcn/ui zuerst.** Die Komponenten in `src/components/ui/` werden nie nachgebaut, nur über die
  Tokens eingefärbt.
- **Genau eine hervorgehobene Hauptaktion pro Seite** (Olive, `variant="default"`). Alles Nachrangige
  ist `variant="outline"`, alles Beiläufige `variant="ghost"`.
- **Jedes interaktive Element hat sichtbaren Hover *und* Fokus.** Fokus ist Barrierefreiheit, keine
  Zugabe — für Tastaturnutzer:innen gibt es nichts anderes.
- **Standard-Buttonhöhe 36px**, Formularfelder ebenso.
- **Icons: Lucide**, einfarbig, sparsam. Sonst Unicode (`→ ✕ ⋯ ✓`). Nie ein Icon ohne Textlabel bei
  einer Hauptaktion.
- **Leerzustand** ist immer ausformuliert: ein Satz, was hier stehen wird, plus die Hauptaktion. Nie
  eine leere Tabelle.
- **Ladezustand** über Skeletons in `--muted`, nicht über Spinner-Overlays.
- **Fehler** stehen bei dem Feld, das sie verursacht hat, in `--destructive` — plus eine
  zusammenfassende Zeile über dem Formular, wenn mehrere Felder betroffen sind.

---

## 9. Sprache

- **Immer duzen**, erste Person „ich" wo die App spricht.
- **Kein Marketing-Sprech, keine Emoji, keine erfundenen Zahlen.**
- Deutsch, österreichische Konventionen (`de-AT`) für Datum und Zahlen.
- Fehlermeldungen sagen, was zu tun ist — nicht, was schiefging.

---

## 10. Offene technische Entscheidung für `/architecture`

Das Quellsystem definiert **Rahmen und gedämpfte Flächen als Alpha** (`rgba(245,245,240,.09)`), damit
sie auf jeder Flächenhelligkeit gleich wirken. Das shadcn-Schema im Scaffold erwartet dagegen
**deckende HSL-Tripel**. Die Tabellen oben liefern beides: die Alpha-Werte als Quelle und die auf
`--background` ausgerechneten deckenden Entsprechungen.

Zu entscheiden ist, welcher Weg gegangen wird — deckende Tripel im shadcn-Schema (einfacher, minimal
abweichend auf Karten) oder das `@theme inline`-Mapping auf volle Farbwerte umstellen, damit die
Alpha-Rahmen erhalten bleiben. Das ist eine Technikentscheidung und gehört in das `design.md` des
ersten Features, das die Oberfläche baut.

---

_Quelle: `docs/alexmacht.at Design System (3)/` (Shell v2) — gelesen von `/init` am 2026-08-27.
Kontrastwerte in diesem Dokument sind gerechnet, nicht geschätzt._
