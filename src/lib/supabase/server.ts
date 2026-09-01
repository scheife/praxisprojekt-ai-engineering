import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { DEADLINE_CLIENT_OPTIONS } from '@/lib/supabase/deadline'

/**
 * Supabase-Client für Server Components, Server Actions und Route Handler.
 *
 * Muss pro Anfrage neu erzeugt werden — der Cookie-Speicher gehört der Anfrage, nicht
 * dem Prozess. Ein modulweit geteilter Client würde die Sitzung der einen Person an die
 * nächste ausliefern.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Frist von zwei Sekunden auf **jeden** Aufruf, Auth eingeschlossen, und die eingebauten
      // Wiederholversuche aus — sonst wäre die Frist je Versuch wirksam (EC-4, design.md TD-27/28).
      ...DEADLINE_CLIENT_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Aus einer Server Component heraus lassen sich keine Cookies schreiben.
            // Das ist kein Fehler: das Auffrischen der Sitzung erledigt src/proxy.ts,
            // und das läuft vor jeder Seitenanfrage.
          }
        },
      },
    },
  )
}
