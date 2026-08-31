import { Suspense } from 'react'
import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { resolveMonth } from '@/lib/expenses/month'
import { MonthView } from '@/components/expenses/month-view'
import { MonthViewSkeleton } from '@/components/expenses/month-view-skeleton'

export const metadata: Metadata = { title: 'auslage.' }

/**
 * Der angemeldete Bereich: Ausgaben erfassen und die Monatsübersicht sehen (PROJ-2).
 *
 * Der Zugriffsschutz gehört PROJ-1 und bleibt unangetastet: Die Vorprüfung in `src/proxy.ts`
 * schickt Abgemeldete auf `/login`, und `requireUser()` fragt zusätzlich den Auth-Server —
 * zwei unabhängige Prüfungen. Damit ist auch EC-5 ohne eigenen Code erfüllt.
 *
 * Der Monat steht in der Adresse (AC-17). Fehlt er oder ergibt er keinen Sinn, wird der
 * laufende angezeigt — **ohne Weiterleitung**, einfach als aufgelöster Wert (AC-19).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await requireUser()
  const { monat } = await searchParams
  const month = resolveMonth(typeof monat === 'string' ? monat : undefined)

  return (
    // Bewusst **ohne** `key={month}`: Ein Schlüssel am Monat hängt beim Wechsel den ganzen
    // Teilbaum aus und baut ihn neu auf — die Erfassungszeile verlöre dabei ihren Zustand,
    // und das eingegebene Datum fiele auch dann auf die Vorbelegung zurück, wenn es im nun
    // angezeigten Monat liegt. Genau das verbietet die Regel, die AC-2 und AC-3 zusammen
    // erfüllt. Ohne Schlüssel bleibt die vorige Ansicht während des Wechsels stehen, und das
    // Gerüst zeigt sich dort, wo es hingehört: beim ersten Aufbau der Seite.
    <Suspense fallback={<MonthViewSkeleton />}>
      <MonthView userId={user.id} month={month} />
    </Suspense>
  )
}
