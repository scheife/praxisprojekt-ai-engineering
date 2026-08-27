'use client'

import { useActionState, useState } from 'react'

import { login, type AuthFormState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMPTY: AuthFormState = {}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, EMPTY)

  // Die Adresse bleibt nach einem Fehler stehen, das Passwort nicht: React setzt das
  // Formular nach einer Action zurück, und genau das ist hier gewünscht (EC-4).
  //
  // Übernommen wird sie beim Rendern, nicht in einem Effect — ein Effect würde einen
  // zweiten Renderdurchlauf auslösen, nachdem das Feld schon leer gezeichnet wurde.
  const [email, setEmail] = useState('')
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    if (state.email !== undefined) setEmail(state.email)
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
        >
          {state.formError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          E-Mail-Adresse
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          className="h-9"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-[13px] text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          Passwort
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
          className="h-9"
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-[13px] text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {/* Während des Absendens gesperrt — der zweite Klick wird gar nicht erst
          abgeschickt (EC-1). */}
      <Button type="submit" disabled={isPending} className="h-9 w-full font-grotesk">
        {isPending ? 'Moment …' : 'Anmelden'}
      </Button>
    </form>
  )
}
