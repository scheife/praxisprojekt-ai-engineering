import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TIMEOUT_MESSAGE, isUnreachable } from '@/lib/supabase/deadline'
import { buildCsv, csvFilename } from '@/lib/expenses/csv'
import { listAll } from '@/lib/expenses/queries'
import { todayInVienna } from '@/lib/expenses/month'

/**
 * `GET /konto/export` — die CSV-Datei mit allen eigenen Daten (AC-27, Art. 15 und Art. 20 DSGVO).
 *
 * Ohne Oberfläche und **ohne Ablage**: die Datei entsteht bei jedem Abruf neu und liegt
 * nirgends herum. Der Zugriffsschutz ist derselbe wie überall — `requireUser()` fragt den
 * Auth-Server, nicht das Cookie; abgemeldet geht es auf `/login`.
 *
 * Keine eigene Drosselung: hier werden keine Zugangsdaten geprüft, und wer angemeldet ist,
 * ruft nur seine eigenen Zeilen ab (design.md, TD-22).
 */
/**
 * Die Antwort, wenn Datenbank oder Auth-Server binnen zwei Sekunden nicht antworten (EC-4).
 *
 * **HTTP 503 mit Klartext statt einer Karte:** Eine Route, die eine Datei liefert, hat keine
 * Oberfläche, in der ein Hinweis stehen könnte. Derselbe Satz wie im
 * Zeitüberschreitungs-Zustand — nur eben als Nutzlast, aus derselben Quelle (EC-13).
 */
function unavailable(): Response {
  return new Response(
    `${TIMEOUT_MESSAGE}\n`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

export async function GET() {
  const session = await requireUser()
  if (session.state === 'unavailable') return unavailable()

  const { user } = session
  const supabase = await createClient()

  let profile: { created_at: string } | null = null
  let expenses
  try {
    // Das Registrierungsdatum kommt aus `profiles` — der eigenen Aufzeichnung der Anwendung,
    // nicht aus dem Auth-Schema.
    const result = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .maybeSingle()
    if (result.error) throw result.error
    profile = result.data

    expenses = await listAll(user.id)
  } catch (error) {
    // Die Sitzung stand, aber der Weg zu den Daten steht nicht mehr — für die Person ist das
    // dieselbe Lage und verdient dieselbe Antwort. Alles andere bleibt ein Fehler.
    if (isUnreachable(error)) return unavailable()
    throw error
  }

  const csv = buildCsv(
    {
      email: user.email ?? '',
      registeredAt: profile?.created_at ?? user.created_at,
    },
    expenses,
  )

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(todayInVienna())}"`,
      'Cache-Control': 'no-store',
    },
  })
}
