'use client'

import { useFormStatus } from 'react-dom'

import { logout } from '@/lib/actions/account'
import { Button } from '@/components/ui/button'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="h-9 font-grotesk"
    >
      {pending ? 'Moment …' : 'Abmelden'}
    </Button>
  )
}

/**
 * Beendet die Sitzung (AC-14).
 *
 * Die Action gehört PROJ-1; der Header von PROJ-2 hängt seinen „Abmelden"-Eintrag an
 * dieselbe Action, statt eine zweite zu bauen (docs/app-shell.md).
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <SubmitButton />
    </form>
  )
}
