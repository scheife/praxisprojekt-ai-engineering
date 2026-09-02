'use client'

import { formatAmount, formatPercent } from '@/lib/expenses/format'
import type { CategorySum } from '@/lib/expenses/summary'
import { cn } from '@/lib/utils'

/**
 * Die Kategorienübersicht (AC-14, AC-15).
 *
 * Nur Kategorien **mit** Betrag, absteigend nach Summe. Neun Zeilen, von denen fünf auf 0,00 €
 * stehen, verbergen die Information, statt sie zu zeigen.
 *
 * Der Balken ist die Olive-Rampe **nach Rang** — kein Regenbogen: Kategorien sind nicht
 * qualitativ verschieden, sie sind nach Betrag geordnet (docs/design-system.md §6.2). Amber
 * bleibt für PROJ-3 reserviert und wird hier nie verwendet.
 *
 * Jede Zeile ist eine Schaltfläche mit gedrückt/nicht-gedrückt-Zustand; ein zweiter Klick auf
 * dieselbe hebt den Filter wieder auf. Den Zustand hält `MonthPanel`.
 */
const RANK_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

export function CategoryBreakdown({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly CategorySum[]
  selected: string | null
  onSelect: (category: string) => void
}) {
  return (
    <ul className="flex flex-col">
      {categories.map((entry, rank) => {
        const isSelected = selected === entry.category
        return (
          <li key={entry.category}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(entry.category)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected && 'bg-primary/15 hover:bg-primary/20',
              )}
            >
              <span className="w-[9.5rem] shrink-0 truncate text-[13px]">{entry.label}</span>

              <span
                aria-hidden="true"
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              >
                {/*
                  `min-w-[3px]`, sobald überhaupt ein Betrag da ist (BUG-2): Unter 0,5 % ergibt
                  die Breite rechnerisch 0 % — der Balken verschwindet, und die Zeile sieht aus
                  wie eine leere Kategorie. Die Mindestbreite macht ihn sichtbar, **ohne** den
                  Prozentwert zu verfälschen: Gestreckt wird die Darstellung, nicht die Zahl.
                */}
                <span
                  className={cn(
                    'block h-full rounded-full',
                    entry.amountCents > 0 && 'min-w-[3px]',
                    RANK_COLORS[rank] ?? 'bg-muted-foreground',
                  )}
                  style={{ width: `${entry.percent}%` }}
                />
              </span>

              <span className="w-14 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">
                {formatPercent(entry.percent, entry.amountCents)}
              </span>
              <span className="w-28 shrink-0 text-right tabular-nums">
                {formatAmount(entry.amountCents)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
