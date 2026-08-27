'use server'

import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** Abmelden und Konto löschen. */

/**
 * Beendet die Sitzung und leitet auf `/login` (AC-14).
 * Die geschützten Seiten tragen `Cache-Control: no-store`, deshalb holt der Zurück-Button
 * danach nichts mehr aus dem Verlauf.
 */
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login?reason=signed-out')
}

/**
 * Löscht das eigene Konto samt Profil, Sitzungen und Drosselungs-Zeilen (AC-15, Art. 17 DSGVO).
 *
 * Die Löschung selbst macht eine Datenbankfunktion, die ausschließlich das Konto der
 * aufrufenden Person entfernt. Kein `service_role`-Schlüssel in dieser Anwendung — der
 * Schlüssel, der Row Level Security aushebelt, existiert hier nicht (design.md, TD-6).
 */
export async function deleteAccount(): Promise<{ formError: string } | void> {
  await requireUser()

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_own_account')

  if (error) {
    return {
      formError:
        'Das Löschen hat gerade nicht geklappt. Bitte versuche es in einem Moment noch einmal.',
    }
  }

  // Nur lokal abmelden: der Auth-Server kennt das Konto nicht mehr, ein Aufruf dorthin
  // liefe ins Leere. Zu entfernen sind noch die Cookies in diesem Browser.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?reason=deleted')
}
