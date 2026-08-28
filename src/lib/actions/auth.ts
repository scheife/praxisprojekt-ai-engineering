'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  clearOwnLoginAttempts,
  clientIpFrom,
  passLoginGate,
  passSignupGate,
} from '@/lib/rate-limit'
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

/**
 * Zwei Sätze statt einem: Wer gerade ein Konto anlegen will, soll nicht von einer
 * „Anmeldung" lesen, die er nicht versucht hat (QA-Bericht, BUG-2).
 */
const LOGIN_UNAVAILABLE =
  'Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal.'
const SIGNUP_UNAVAILABLE =
  'Die Registrierung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal.'

/**
 * Jede fehlgeschlagene Anmeldung braucht mindestens so lange.
 *
 * Ohne diese Schwelle verrät die Antwortzeit, ob eine Adresse registriert ist: Supabase Auth
 * prüft bei einem bestehenden Konto das Passwort gegen den Hash und braucht dafür rund 90 ms,
 * bei einer unbekannten Adresse antwortet es nach rund 10 ms. Gemessen lagen die
 * Wertebereiche vollständig auseinander — eine einzige Anfrage genügte zur Unterscheidung,
 * obwohl der Meldungstext identisch ist (AC-7).
 *
 * 350 ms liegt über dem langsamen Pfad und unter der Vorgabe aus `spec.md`, dass eine
 * Anmeldung in unter 500 ms beantwortet ist. Nur Fehlschläge werden gebremst; eine geglückte
 * Anmeldung verrät nichts, was die Person nicht ohnehin weiß.
 */
const MIN_FAILURE_MS = 350

async function notFasterThanFloor(startedAt: number): Promise<void> {
  const remaining = MIN_FAILURE_MS - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

function throttled(minutes: number): string {
  return `Zu viele Fehlversuche. Bitte versuche es in ${minutes} ${
    minutes === 1 ? 'Minute' : 'Minuten'
  } erneut.`
}

/**
 * Die Sperre der Registrierung — mit zwei bewussten Unterschieden zur Anmeldemeldung (AC-17,
 * TD-24):
 *
 * 1. Sie spricht von **Versuchen**, nicht von angelegten Konten. Gezählt werden Versuche; ein
 *    Wortlaut, der etwas anderes behauptet, wäre schlicht unwahr. Dass Versuche zählen, ist
 *    außerdem Absicht: AC-5 verrät, ob eine Adresse ein Konto hat — zählte die Sperre nur
 *    Erfolge, ließe sich damit unbegrenzt durchprobieren, wer hier Kunde ist.
 * 2. Sie nennt **nicht** „diese Verbindung". Ohne vertrauenswürdig erkennbare IP zählen alle
 *    Versuche gemeinsam (TD-23) — dann stammen sie gerade nicht aus derselben Verbindung.
 */
function signupThrottled(minutes: number): string {
  return `Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in ${minutes} ${
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
  const startedAt = Date.now()

  /** Jeder Fehlschlag verlässt die Action über diesen Weg — und damit nie zu schnell. */
  const fail = async (state: AuthFormState): Promise<AuthFormState> => {
    await notFasterThanFloor(startedAt)
    return state
  }

  const rawEmail = String(formData.get('email') ?? '')
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: String(formData.get('password') ?? ''),
  })

  if (!parsed.success) {
    return fail({ fieldErrors: fieldErrorsFrom(parsed.error.issues), email: rawEmail })
  }

  const { email, password } = parsed.data

  // Die Drosselung sitzt VOR der Prüfung der Zugangsdaten und hält den Versuch fest —
  // auch für Adressen, zu denen es gar kein Konto gibt (AC-7, AC-8, AC-9).
  const gate = await passLoginGate(email, clientIpFrom(await headers()))
  if (gate.state === 'blocked') {
    return fail({ formError: throttled(gate.retryAfterMinutes), email })
  }
  if (gate.state === 'unavailable') {
    return fail({ formError: LOGIN_UNAVAILABLE, email })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Greift ausnahmsweise Supabase' eigene Drosselung, soll die Person nicht zwei
    // verschiedene Erklärungen für dasselbe sehen.
    if (error.status === 429) return fail({ formError: throttled(15), email })
    return fail({ formError: CREDENTIALS_WRONG, email })
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

  // Ohne diese Drosselung ist die Registrierung unbegrenzt automatisierbar: Das Limit, auf
  // das sich das Design verließ, gibt es in diesem Stack nicht (QA-Bericht, BUG-3).
  const gate = await passSignupGate(email, clientIpFrom(await headers()))
  if (gate.state === 'blocked') {
    return { formError: signupThrottled(gate.retryAfterMinutes), email }
  }
  if (gate.state === 'unavailable') {
    return { formError: SIGNUP_UNAVAILABLE, email }
  }

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

    return { formError: SIGNUP_UNAVAILABLE, email }
  }

  // Die Profilzeile ist zu diesem Zeitpunkt bereits da — der Datenbank-Trigger hat sie
  // angelegt, ohne dass ein weiterer Schritt nötig war (AC-2).
  redirect('/')
}
