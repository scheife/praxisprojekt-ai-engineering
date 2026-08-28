import type { Metadata } from 'next'
import Link from 'next/link'

import { requireUser } from '@/lib/auth'
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog'
import { LogoutButton } from '@/components/account/logout-button'
import { Wordmark } from '@/components/wordmark'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = { title: 'Konto · auslage.' }

/**
 * Der angemeldete Bereich für Abmelden und Kontolöschung (AC-14, AC-15).
 *
 * Ein eigener Bereich, weil der Header PROJ-2 gehört und beim Bau von PROJ-1 noch nicht
 * existiert. Er bleibt auch danach: PROJ-2 verlinkt ihn aus dem Header
 * (docs/app-shell.md).
 */
export default async function KontoPage() {
  const user = await requireUser()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-6 px-5 py-12">
      <Link href="/" aria-label="Zur Übersicht">
        <Wordmark className="text-4xl" />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="font-grotesk text-xl">Konto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              E-Mail-Adresse
            </span>
            <span>{user.email}</span>
          </div>
          <LogoutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-grotesk text-xl">Konto löschen</CardTitle>
          <CardDescription>
            Entfernt dein Konto und alle Daten, die daran hängen. Danach ist die Anmeldung
            mit dieser Adresse nicht mehr möglich.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </main>
  )
}
