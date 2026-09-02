import type { Metadata } from 'next'
import Link from 'next/link'

import { SignupForm } from '@/components/auth/signup-form'
import { Wordmark } from '@/components/wordmark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Konto anlegen · auslage.' }

/** Wie `/login`: kein Rahmen, zentrierte Karte, Wortmarke darüber (docs/app-shell.md). */
export default function SignupPage() {
  return (
    <main className="auth-backdrop flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Wordmark className="auth-enter mb-8 text-4xl" />

      <div className="auth-enter-delayed w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle as="h1" className="font-grotesk text-xl">Konto anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Schon ein Konto?{' '}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  )
}
