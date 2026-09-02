/**
 * Darstellung von Beträgen, Daten und Monatsnamen.
 *
 * Alles über `Intl`, nie von Hand — und alles an einer Stelle, damit `1.284,50 €` in Liste,
 * Übersicht, Dialog und Toast wirklich gleich aussieht (docs/design-system.md §5).
 */
import { TIME_ZONE } from '@/lib/expenses/month'

const NBSP = ' '

// Bewusst NICHT `style: 'currency'`: das stellt in de-AT das Zeichen voran (€ 1.284,50) und
// widerspricht docs/design-system.md §5 — Währung steht hinter dem Betrag.
//
// Und bewusst `de-DE` statt `de-AT`: ICU trennt Tausender in de-AT inzwischen mit einem
// schmalen geschützten Leerzeichen (`1 284,50`). AC-6 und docs/design-system.md §5 verlangen
// aber den Punkt (`1.284,50`) — den liefert de-DE, sonst identisch. Datum und Monatsname
// bleiben unten bei de-AT, weil nur die den Jänner kennen.
const DECIMAL = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const WEEKDAY = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  timeZone: 'UTC',
})

const MONTH_LABEL = new Intl.DateTimeFormat('de-AT', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

const CREATED_AT = new Intl.DateTimeFormat('de-AT', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `128450` → `1.284,50 €`, mit geschütztem Leerzeichen vor dem Zeichen. */
export function formatAmount(cents: number): string {
  return `${DECIMAL.format(cents / 100)}${NBSP}€`
}

/**
 * `128450` → `1284,50` — ohne Tausenderpunkt und ohne Währungszeichen.
 * So liest jede Tabellenkalkulation mit deutschsprachigen Einstellungen den Wert als Zahl (AC-27).
 */
export function formatAmountPlain(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** `2026-08-14` → `14.08.2026`. Reine Zeichenarbeit, damit keine Zeitzone hineinregieren kann. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-')
  return `${date}.${month}.${year}`
}

/**
 * `2026-08-15` → `Sa` (AC-32).
 *
 * **Warum überhaupt:** Bei einer Fremdwährungsausgabe entscheidet der Wochentag über den Kurs — an
 * einem Samstag gilt der Kurs des letzten Werktags (PROJ-3, AC-4). Wer beim Erfassen sieht, dass
 * der 15. ein Samstag ist, versteht das Kursdatum in der Liste, ohne zu fragen.
 *
 * **Berechnet, nie gespeichert** (design.md, TD-39): Der Wochentag ist aus dem Datum eindeutig
 * ableitbar. Ihn mitzuführen hieße, eine zweite Wahrheit über dasselbe Datum zu halten, die beim
 * ersten Ändern auseinanderfällt.
 *
 * Gerechnet wird in UTC, wie bei `formatMonthLabel` — der Tag steht im Text schon fest, es soll
 * keine Zeitzone mehr hineinregieren und ihn um einen verschieben.
 */
export function formatWeekday(day: string): string {
  return WEEKDAY.format(new Date(`${day}T00:00:00Z`))
}

/** `2026-08` → `August 2026`. */
export function formatMonthLabel(month: string): string {
  return MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`))
}

/** Zeitstempel → `14.08.2026 09:12` in Europe/Vienna (AC-27). */
export function formatTimestamp(iso: string): string {
  return CREATED_AT.format(new Date(iso)).replace(',', '')
}

/**
 * Ein Kurs braucht eine andere Spanne als ein Betrag: `0,8572` für das Pfund, `20.628,08` für
 * die Rupiah. Zwei Nachkommastellen wären für die eine zu wenig, sechs für die andere unnötig —
 * deshalb ein Bereich statt einer festen Zahl.
 */
const RATE = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
})

/**
 * `125000, 'USD'` → `1.250,00 USD` (PROJ-3, AC-7).
 *
 * Der Code steht hinter dem Betrag, wie das Eurozeichen in `formatAmount` — dieselbe Leserichtung
 * für dieselbe Sache. Bewusst der **Code** und nicht das Symbol: `$` steht für ein gutes Dutzend
 * verschiedener Währungen, `USD` für genau eine.
 *
 * Alle Beträge stehen in Hundertsteln ihrer Währung (design.md, TD-9). Für den Yen heißt das
 * `1.500,00 JPY` statt `1.500 JPY` — fachlich unschön, aber die Alternative wäre eine Tabelle
 * der Nachkommastellen für alle 30 Währungen, die gepflegt werden müsste.
 */
export function formatForeignAmount(minorUnits: number, code: string): string {
  return `${DECIMAL.format(minorUnits / 100)}${NBSP}${code}`
}

/**
 * `1.1643, 'USD'` → `1 € = 1,1643 USD` (PROJ-3, AC-8).
 *
 * Die Richtung ist die der EZB und zugleich die in Europa übliche Leseweise. Sie ist auch die
 * genauere: In der Gegenrichtung blieben bei Währungen mit großen Zahlen nur zwei signifikante
 * Stellen übrig (design.md, TD-2). Nachrechnen heißt deshalb **teilen** — Originalbetrag
 * geteilt durch diesen Kurs ergibt den Euro-Betrag.
 */
export function formatRate(ratePerEur: number, code: string): string {
  return `1${NBSP}€ = ${RATE.format(ratePerEur)}${NBSP}${code}`
}

/**
 * `1.1643` → `1,1643` — ohne Tausenderpunkt und ohne Währung, für den CSV-Export (AC-19).
 * Dieselbe Überlegung wie bei `formatAmountPlain`: So liest eine Tabellenkalkulation mit
 * deutschsprachigen Einstellungen den Wert als Zahl und nicht als Text.
 */
export function formatRatePlain(ratePerEur: number): string {
  return String(ratePerEur).replace('.', ',')
}
