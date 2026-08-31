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

/** `2026-08` → `August 2026`. */
export function formatMonthLabel(month: string): string {
  return MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`))
}

/** Zeitstempel → `14.08.2026 09:12` in Europe/Vienna (AC-27). */
export function formatTimestamp(iso: string): string {
  return CREATED_AT.format(new Date(iso)).replace(',', '')
}
