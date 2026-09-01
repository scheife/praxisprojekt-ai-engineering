import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { isUnreachable } from '@/lib/supabase/deadline'

/**
 * Die echte Sitzungsprüfung.
 *
 * `getUser()` fragt den Auth-Server, nicht das Cookie. Genau darin liegt der Unterschied:
 * Ein gelöschtes Konto oder eine entzogene Sitzung fällt sofort auf, obwohl das Cookie noch
 * eine knappe Stunde gültig aussieht (EC-5). Die Vorprüfung in `src/proxy.ts` liest nur das
 * Cookie — sie ist schnell und deshalb bewusst nur eine Vorfilterung (design.md, TD-2).
 */

/**
 * **Drei Ausgänge, nicht zwei** (EC-12, design.md TD-30).
 *
 * „Nicht angemeldet" und „nicht feststellbar" sahen hier früher gleich aus — beide endeten bei
 * `null`, und daraus wurde eine Weiterleitung mit „deine Sitzung ist abgelaufen". Das behauptete
 * etwas über die Sitzung der Person, was die App gar nicht geprüft hatte, und schickte sie auf
 * `/login` — eine Seite, die denselben Auth-Server braucht. Die einzige dort angebotene Handlung
 * konnte also nicht gelingen.
 *
 * Unterschieden wird an der **Art des Fehlers**: eine beantwortete Ablehnung ist etwas anderes
 * als ein abgebrochener Netzaufruf.
 */
export type Session =
  | { state: 'signed-in'; user: User }
  | { state: 'signed-out' }
  | { state: 'unavailable' }

/** Die angemeldete Person, oder warum nicht. Leitet nicht um. */
export async function getUser(): Promise<Session> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return isUnreachable(error) ? { state: 'unavailable' } : { state: 'signed-out' }
  }
  return data.user ? { state: 'signed-in', user: data.user } : { state: 'signed-out' }
}

/**
 * Die angemeldete Person — oder Weiterleitung auf `/login` mit dem Hinweis, dass die
 * Sitzung abgelaufen ist (EC-3). Jede geschützte Seite und jede Server Action, die etwas
 * am Konto ändert, geht hier durch (AC-11).
 *
 * **Nur `signed-out` leitet um.** Bei `unavailable` gibt diese Funktion den Fall an die
 * aufrufende Stelle zurück, statt ihn zu verschlucken — der Rückgabetyp zwingt jede von ihnen,
 * ihn zu behandeln. Genau das ist beabsichtigt: Ein dritter Zustand, den man vergessen kann,
 * ist keiner.
 */
export async function requireUser(): Promise<
  { state: 'signed-in'; user: User } | { state: 'unavailable' }
> {
  const session = await getUser()
  if (session.state === 'signed-out') redirect('/login?reason=session-expired')
  return session
}
