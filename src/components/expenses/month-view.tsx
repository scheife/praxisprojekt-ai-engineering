import { AppHeader } from '@/components/shell/app-header'
import { UnavailableNotice } from '@/components/shell/unavailable-notice'
import { MonthPanel } from '@/components/expenses/month-panel'
import { listMonth, oldestMonth } from '@/lib/expenses/queries'
import { isUnreachable } from '@/lib/supabase/deadline'
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
  let expenses
  let oldest
  try {
    ;[expenses, oldest] = await Promise.all([listMonth(userId, month), oldestMonth(userId)])
  } catch (error) {
    /**
     * **Der Lesepfad braucht denselben Ausgang wie die Sitzungsprüfung** (EC-4, BUG-4 aus `/qa`).
     *
     * Die Prüfung in `requireUser()` fängt den Fall ab, in dem **Auth-Server und Datenbank
     * zusammen** ausfallen — dann kommt die Seite gar nicht bis hierher. Bleibt der Auth-Server
     * aber erreichbar und steht **nur der Datenzugriff**, ist die Sitzung feststellbar, und erst
     * diese beiden Abfragen scheitern. Ohne dieses `catch` warf `queries.ts` weiter, niemand fing
     * es, und die Person sah dauerhaft das Ladegerüst — sichtbarer Text der ganzen Seite:
     * „auslage." Kein Wort Erklärung.
     *
     * Nur ein **Nichterreichen** wird hier abgefangen. Jeder andere Fehler fliegt weiter: Er
     * bedeutet etwas anderes, und ihn als „gerade nicht erreichbar" auszugeben wäre dieselbe
     * falsche Behauptung, gegen die EC-12 geschrieben wurde.
     */
    if (!isUnreachable(error)) throw error

    return (
      <>
        {/* Ohne Monatswechsler: Seine Grenzen kommen aus `oldestMonth` (AC-18) — genau der
            Abfrage, die eben gescheitert ist. */}
        <AppHeader />
        <main className="mx-auto w-full max-w-[1180px] px-5 py-8">
          <UnavailableNotice />
        </main>
      </>
    )
  }

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
