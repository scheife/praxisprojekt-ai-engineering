'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { clearOwnLoginAttempts, clientIpFrom, passLoginGate } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema } from '@/lib/validation/auth'

/**
 * Anmelden und Registrieren.
 *
 * Server Actions verschicken grundsätzlich per POST. Damit können E-Mail und Passwort gar
 * nicht erst in der Adresszeile landen — AC-10 ist strukturell erfüllt statt durch
 * Sorgfalt (design.md, TD-1).
 */

export type AuthFormState = {
  /** Fehler, der das ganze Formular betrifft — als Zeile über den Feldern. */
  formError?: string
  /** Fehler direkt am verursachenden Feld. */
  fieldErrors?: { email?: string; password?: string }
  /** Die eingegebene Adresse, damit sie nach einem Fehler stehen bleibt. Nie das Passwort. */
  email?: string
}

/**
 * Ein einziger Satz für „unbekannte Adresse" und „falsches Passwort" (AC-7). Wer hier
 * unterscheidet, verrät, welche Adressen ein Konto haben.
 */
const CREDENTIALS_WRONG = 'E-Mail-Adresse oder Passwort stimmt nicht.'
const UNAVAILABLE =
  'Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal.'

function throttled(minutes: number): string {
  return `Zu viele Fehlversuche. Bitte versuche es in ${minutes} ${
    minutes === 1 ? 'Minute' : 'Minuten'
  } erneut.`
}

/** Feldfehler aus dem Schema in die Form bringen, die das Formular anzeigt. */
function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: AuthFormState['fieldErrors'] = {}
  for (const issue of issues) {
    const field = issue.path[0]
    if (field === 'email' && !fieldErrors.email) fieldErrors.email = issue.message
    if (field === 'password' && !fieldErrors.password) fieldErrors.password = issue.message
  }
  return fieldErrors
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = String(formData.get('email') ?? '')
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: String(formData.get('password') ?? ''),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), email: rawEmail }
  }

  const { email, password } = parsed.data

  // Die Drosselung sitzt VOR der Prüfung der Zugangsdaten und hält den Versuch fest —
  // auch für Adressen, zu denen es gar kein Konto gibt (AC-7, AC-8, AC-9).
  const gate = await passLoginGate(email, clientIpFrom(await headers()))
  if (gate.state === 'blocked') {
    return { formError: throttled(gate.retryAfterMinutes), email }
  }
  if (gate.state === 'unavailable') {
    return { formError: UNAVAILABLE, email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Greift ausnahmsweise Supabase' eigene Drosselung, soll die Person nicht zwei
    // verschiedene Erklärungen für dasselbe sehen.
    if (error.status === 429) return { formError: throttled(15), email }
    return { formError: CREDENTIALS_WRONG, email }
  }

  await clearOwnLoginAttempts()
  redirect('/')
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = String(formData.get('email') ?? '')
  const parsed = signupSchema.safeParse({
    email: rawEmail,
    password: String(formData.get('password') ?? ''),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), email: rawEmail }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    // Die Datenbank-Mindestlänge ist die dritte Prüfung hinter Browser und Server. Kommt
    // sie zum Zug, gehört der Fehler ans Passwortfeld (AC-3).
    if (error.code === 'weak_password') {
      return {
        fieldErrors: { password: 'Dein Passwort braucht mindestens 10 Zeichen.' },
        email,
      }
    }

    // Treffen zwei Registrierungen mit derselben Adresse gleichzeitig ein, gewinnt genau
    // eine — die Eindeutigkeit in auth.users entscheidet das, nicht der Anwendungscode.
    // Die andere landet hier (AC-5, EC-2).
    if (error.code === 'user_already_exists' || error.status === 422) {
      return {
        formError: 'Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.',
        email,
      }
    }

    return { formError: UNAVAILABLE, email }
  }

  // Die Profilzeile ist zu diesem Zeitpunkt bereits da — der Datenbank-Trigger hat sie
  // angelegt, ohne dass ein weiterer Schritt nötig war (AC-2).
  redirect('/')
}
