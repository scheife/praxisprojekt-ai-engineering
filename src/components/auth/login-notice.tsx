'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/** Warum die Person gerade auf `/login` gelandet ist. */
export type LoginReason = 'session-expired' | 'deleted' | 'signed-out'

const HINTS: Record<'session-expired' | 'deleted', string> = {
  // EC-3: keine stumme Fehlermeldung, sondern der Grund.
  'session-expired': 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  // AC-15: die Bestätigung, dass die Löschung durch ist.
  deleted: 'Dein Konto ist gelöscht. Alles Gute!',
}

export function LoginNotice({ reason }: { reason?: string }) {
  // Das Abmelden ist eine flüchtige Bestätigung — die gehört in den Toast, nicht über das
  // Formular, in dem man gerade wieder etwas eintippen will (AC-14).
  useEffect(() => {
    if (reason === 'signed-out') toast.success('Du bist abgemeldet.')
  }, [reason])

  const hint = reason === 'session-expired' || reason === 'deleted' ? HINTS[reason] : null
  if (!hint) return null

  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground"
    >
      {hint}
    </p>
  )
}
