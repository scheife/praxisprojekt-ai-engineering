'use client'

import { useState } from 'react'

import type { Expense } from '@/lib/expenses/queries'
import type { MonthSummary } from '@/lib/expenses/summary'
import { CategoryBreakdown } from '@/components/expenses/category-breakdown'
import { ExpenseComposer } from '@/components/expenses/expense-composer'
import { ExpenseList } from '@/components/expenses/expense-list'
import { MonthTotal } from '@/components/expenses/month-total'

/**
 * Der Inhalt eines Monats — und die einzige Stelle, die den **Kategoriefilter** hält (AC-15).
 *
 * Der Filter lebt im Browserzustand, nicht in der Adresse: Er ist eine Blickrichtung auf den
 * Monat, kein Ort, den man verlinken oder mit dem Zurück-Button verlassen will. In der Adresse
 * steht nur der Monat (AC-17).
 *
 * **Gesamtsumme und Kategoriezeilen bleiben ungefiltert.** Sie sind der Maßstab, gegen den
 * gefiltert wird — filterte man sie mit, stünde jede Zeile auf 100 %.
 */
export function MonthPanel({
  month,
  defaultDate,
  expenses,
  summary,
}: {
  month: string
  defaultDate: string
  expenses: Expense[]
  summary: MonthSummary
}) {
  const [selected, setSelected] = useState<string | null>(null)

  // Ein Monatswechsel setzt den Filter zurück — der neue Monat hat andere Kategorien.
  const [seenMonth, setSeenMonth] = useState(month)
  if (month !== seenMonth) {
    setSeenMonth(month)
    setSelected(null)
  }

  // Ein zweiter Klick auf dieselbe Zeile hebt den Filter wieder auf (AC-15).
  function toggle(category: string) {
    setSelected((current) => (current === category ? null : category))
  }

  const visible = selected ? expenses.filter((e) => e.category === selected) : expenses

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Monatsübersicht"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      >
        <MonthTotal totalCents={summary.totalCents} />
        {summary.categories.length > 0 && (
          <CategoryBreakdown
            categories={summary.categories}
            selected={selected}
            onSelect={toggle}
          />
        )}
      </section>

      <ExpenseComposer month={month} defaultDate={defaultDate} />

      <ExpenseList expenses={visible} month={month} />
    </div>
  )
}
