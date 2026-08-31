import Link from 'next/link'

import { addMonths, currentMonth } from '@/lib/expenses/month'
import { formatMonthLabel } from '@/lib/expenses/format'
import { cn } from '@/lib/utils'

/**
 * `‹ August 2026 ›` — der Monatswechsler im Header (AC-17, AC-18).
 *
 * Die Pfeile sind **echte Links** auf `?monat=`, keine Knöpfe mit einem Klick-Handler: nur so
 * funktionieren Neuladen, Lesezeichen und der Zurück-Button.
 *
 * Beide Pfeile bleiben **sichtbar**, wenn sie inaktiv sind, und tragen dann eine Erklärung für
 * Screenreader — ein Pfeil, der verschwindet, verschiebt das Layout und lässt offen, warum es
 * nicht weitergeht.
 */
const ARROW =
  'flex h-9 w-9 items-center justify-center rounded-md text-lg leading-none transition-colors'

export function MonthSwitcher({
  month,
  oldest,
  now,
}: {
  month: string
  /** Der Monat der ältesten eigenen Ausgabe, oder `null`. */
  oldest: string | null
  now?: Date
}) {
  const previous = addMonths(month, -1)
  const next = addMonths(month, 1)

  // Zurück geht es genau dann, wenn es eine eigene Ausgabe VOR dem angezeigten Monat gibt.
  // Die Grenze wird bei jedem Aufbau neu bestimmt und nirgends gespeichert — deshalb rückt
  // sie nach dem Löschen der letzten Ausgabe eines Monats von selbst nach (EC-8).
  const canGoBack = oldest !== null && oldest < month
  const canGoForward = month < currentMonth(now)

  return (
    <div className="flex items-center gap-1">
      {canGoBack ? (
        <Link
          href={`/?monat=${previous}`}
          aria-label={`Zurück zu ${formatMonthLabel(previous)}`}
          className={cn(ARROW, 'text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
        >
          ‹
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(ARROW, 'text-muted-foreground/60')}>
          ‹<span className="sr-only">Weiter zurück geht es nicht — davor hast du nichts erfasst.</span>
        </span>
      )}

      <span
        aria-live="polite"
        className="min-w-[9.5rem] text-center font-grotesk text-[15px] font-medium tracking-[-0.01em]"
      >
        {formatMonthLabel(month)}
      </span>

      {canGoForward ? (
        <Link
          href={`/?monat=${next}`}
          aria-label={`Weiter zu ${formatMonthLabel(next)}`}
          className={cn(ARROW, 'text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
        >
          ›
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(ARROW, 'text-muted-foreground/60')}>
          ›<span className="sr-only">Weiter geht es nicht — das ist der laufende Monat.</span>
        </span>
      )}
    </div>
  )
}
