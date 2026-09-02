'use server'

import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TIMEOUT_MESSAGE } from '@/lib/supabase/deadline'

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
export type DeleteAccountState = { formError?: string }

export async function deleteAccount(
  _prevState: DeleteAccountState,
  _formData: FormData,
): Promise<DeleteAccountState> {
  const session = await requireUser()
  // EC-12: Ohne feststellbare Anmeldung wird kein Konto gelöscht — und die Person bekommt
  // gesagt, warum. Der Aufruf ist ohnehin unwiderruflich; ihn „auf Verdacht" zu wagen, wäre
  // die schlechteste aller Möglichkeiten.
  if (session.state === 'unavailable') {
    return { formError: TIMEOUT_MESSAGE }
  }

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
