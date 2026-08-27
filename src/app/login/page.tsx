import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from '@/components/auth/login-form'
import { LoginNotice } from '@/components/auth/login-notice'
import { Wordmark } from '@/components/wordmark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Anmelden · auslage.' }

/**
 * `/login` trägt keinen App-Rahmen: zentrierte Karte auf leerem Grund, nur die Wortmarke
 * darüber (docs/app-shell.md).
 *
 * Wer hier landet, ist abgemeldet — dafür sorgt die Vorprüfung in `src/proxy.ts`, die
 * Angemeldete auf `/` zurückschickt (AC-12).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Wordmark className="mb-8 text-2xl" />

      <div className="w-full max-w-sm">
        <LoginNotice reason={reason} />

        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-xl">Anmelden</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Noch kein Konto?{' '}
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Konto anlegen
          </Link>
        </p>
      </div>
    </main>
  )
}
