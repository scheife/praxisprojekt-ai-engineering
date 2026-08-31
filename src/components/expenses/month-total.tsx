import { formatAmount } from '@/lib/expenses/format'

/**
 * Die Gesamtsumme des Monats (AC-13) — **die einzige Zahl in `2xl`**, alles andere ordnet sich
 * ihr unter (docs/design-system.md §5).
 */
export function MonthTotal({ totalCents }: { totalCents: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Summe des Monats
      </span>
      <span className="font-grotesk text-[32px] font-bold leading-tight tabular-nums tracking-[-0.02em]">
        {formatAmount(totalCents)}
      </span>
    </div>
  )
}
