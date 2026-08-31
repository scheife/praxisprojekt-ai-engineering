import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
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
export async function GET() {
  const user = await requireUser()
  const supabase = await createClient()

  // Das Registrierungsdatum kommt aus `profiles` — der eigenen Aufzeichnung der Anwendung,
  // nicht aus dem Auth-Schema.
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', user.id)
    .maybeSingle()

  const expenses = await listAll(user.id)

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
