import Link from 'next/link'

import { requireUser } from '@/lib/auth'
import { Wordmark } from '@/components/wordmark'

/**
 * Platzhalter, bis PROJ-2 hier die Ausgabenübersicht baut.
 *
 * Der Zugriffsschutz gehört PROJ-1 und bleibt: die Vorprüfung in `src/proxy.ts` schickt
 * Abgemeldete auf `/login`, und `requireUser()` fragt zusätzlich den Auth-Server —
 * zwei unabhängige Prüfungen (AC-11).
 */
export default async function Home() {
  await requireUser()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col items-start justify-center gap-6 px-5 py-12">
      <Wordmark className="text-4xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-grotesk text-2xl font-bold tracking-[-0.02em]">
          Hier entstehen deine Ausgaben.
        </h1>
        <p className="text-muted-foreground">
          Noch ist der Bereich leer. Sobald du Ausgaben erfassen kannst, stehen sie an
          dieser Stelle — mit der Monatsübersicht darunter.
        </p>
      </div>
      <Link href="/konto" className="text-foreground underline underline-offset-4">
        Konto
      </Link>
    </main>
  )
}
