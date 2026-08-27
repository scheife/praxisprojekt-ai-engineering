import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * Die echte Sitzungsprüfung.
 *
 * `getUser()` fragt den Auth-Server, nicht das Cookie. Genau darin liegt der Unterschied:
 * Ein gelöschtes Konto oder eine entzogene Sitzung fällt sofort auf, obwohl das Cookie noch
 * eine knappe Stunde gültig aussieht (EC-5). Die Vorprüfung in `src/proxy.ts` liest nur das
 * Cookie — sie ist schnell und deshalb bewusst nur eine Vorfilterung (design.md, TD-2).
 */

/** Die angemeldete Person, oder `null`. Leitet nicht um. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

/**
 * Die angemeldete Person — oder Weiterleitung auf `/login` mit dem Hinweis, dass die
 * Sitzung abgelaufen ist (EC-3). Jede geschützte Seite und jede Server Action, die etwas
 * am Konto ändert, geht hier durch (AC-11).
 */
export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) redirect('/login?reason=session-expired')
  return user
}
