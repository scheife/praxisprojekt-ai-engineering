import { AppHeader } from '@/components/shell/app-header'
import { MonthPanel } from '@/components/expenses/month-panel'
import { listMonth, oldestMonth } from '@/lib/expenses/queries'
import { defaultSpentOn } from '@/lib/expenses/month'
import { summarize } from '@/lib/expenses/summary'

/**
 * Der Monat, serverseitig geholt und gerechnet.
 *
 * **Zwei** Abfragen, mehr nicht: die Zeilen des Monats und der älteste eigene Monat für die
 * Rückwärtsgrenze des Wechslers (AC-18). Gesamtsumme und Kategoriesummen entstehen aus
 * denselben Zeilen — es gibt keine dritte Abfrage für die Übersicht (design.md, TD-7).
 */
export async function MonthView({ userId, month }: { userId: string; month: string }) {
  const [expenses, oldest] = await Promise.all([listMonth(userId, month), oldestMonth(userId)])

  return (
    <>
      <AppHeader month={month} oldest={oldest} />
      <main className="mx-auto w-full max-w-[1180px] px-5 py-8">
        <MonthPanel
          month={month}
          defaultDate={defaultSpentOn(month)}
          expenses={expenses}
          summary={summarize(
            expenses.map((e) => ({ category: e.category, amountCents: e.amount_cents })),
          )}
        />
      </main>
    </>
  )
}
