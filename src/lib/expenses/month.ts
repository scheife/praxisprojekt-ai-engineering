/**
 * Monat und Zeitzone.
 *
 * `spent_on` ist ein reines Datum ohne Uhrzeit — es kann beim Anzeigen gar nicht erst in eine
 * andere Zeitzone rutschen. „Heute" und „der laufende Monat" werden dagegen auf dem Server in
 * **Europe/Vienna** bestimmt, nicht in der Zeitzone des Servers: am 1. um 00:30 Uhr Wiener Zeit
 * gehört eine Ausgabe in den neuen Monat, auch wenn der Server in UTC noch im alten steht (EC-6).
 */

export const TIME_ZONE = 'Europe/Vienna'

/** Der früheste zulässige Tag — dieselbe Grenze wie `expenses_spent_on_not_ancient` (AC-30). */
export const EARLIEST_DAY = '2000-01-01'
const EARLIEST_MONTH = '2000-01'

// en-CA formatiert als YYYY-MM-DD. Das ist der kürzeste verlässliche Weg, ein Datum in einer
// bestimmten Zeitzone zu lesen, ohne eine Datumsbibliothek dafür zu holen.
const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Heute in Wien, als `YYYY-MM-DD`. */
export function todayInVienna(now: Date = new Date()): string {
  return ISO_DAY.format(now)
}

/** Der laufende Monat in Wien, als `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
  return todayInVienna(now).slice(0, 7)
}

/** Der Monat, in dem ein Tag liegt. */
export function monthOf(day: string): string {
  return day.slice(0, 7)
}

/** Erster und letzter Tag eines Monats, beide eingeschlossen. */
export function monthBounds(month: string): { first: string; last: string } {
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, '0')}` }
}

/** Den Monat um `delta` Monate verschieben. */
export function addMonths(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const total = year * 12 + (mon - 1) + delta
  const y = Math.floor(total / 12)
  const m = total - y * 12 + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
}

/**
 * Den Monat aus der Adresse auflösen (AC-17, AC-19).
 *
 * Fehlt die Angabe, hat sie ein unbekanntes Format oder nennt sie einen Monat, den es nicht
 * gibt (`2026-13`), wird der laufende Monat geliefert — **ohne Weiterleitung**, einfach als
 * aufgelöster Wert. Eine Weiterleitung wäre eine zweite Stelle, an der sich ein Kreis schließen
 * könnte (design.md, TD-9).
 *
 * Monate **nach** dem laufenden und **vor** Januar 2000 fallen ebenfalls auf den laufenden
 * zurück: In beiden kann es garantiert keine Ausgabe geben (Zukunftsdaten sind durch AC-7
 * ausgeschlossen, ältere durch AC-30), und stünde die Ansicht dort, wäre der Vorwärtspfeil aus
 * AC-18 aktiv, obwohl es nach dem laufenden Monat nicht weitergeht.
 */
export function resolveMonth(raw: string | undefined | null, now: Date = new Date()): string {
  const current = currentMonth(now)
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return current

  const mon = Number(raw.slice(5))
  if (mon < 1 || mon > 12) return current
  if (raw > current || raw < EARLIEST_MONTH) return current

  return raw
}

/**
 * Die Datumsvorbelegung der Erfassungszeile (AC-2): im laufenden Monat heute, in einem
 * früheren der erste Tag dieses Monats.
 */
export function defaultSpentOn(month: string, now: Date = new Date()): string {
  return month === currentMonth(now) ? todayInVienna(now) : `${month}-01`
}
