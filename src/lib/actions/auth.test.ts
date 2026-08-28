import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Die Drosselungs- und Fehlermeldungen der Auth-Actions.
 *
 * Warum diese Tests existieren: AC-7 und AC-17 machen **den Wortlaut** zur Zusage, nicht nur
 * das Verhalten. AC-7 verlangt für unbekannte Adresse und falsches Passwort denselben Satz;
 * AC-17 verlangt, dass die Registrierungssperre von *Versuchen* spricht und nicht von
 * angelegten Konten — der Unterschied ist der Kern des `/refine` vom 28.08.2026 (TD-24).
 * Ein Wortlaut ohne Test ist eine Zusage, die beim nächsten Umformulieren still bricht.
 *
 * Ersetzt sind nur die Außengrenzen (Supabase, Tore, Kopfzeilen, Weiterleitung); die
 * Verzweigungen dazwischen sind echt.
 */

const signInWithPassword = vi.fn()
const signUp = vi.fn()
const passLoginGate = vi.fn()
const passSignupGate = vi.fn()
const clearOwnLoginAttempts = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword, signUp } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  passLoginGate: (...a: unknown[]) => passLoginGate(...a),
  passSignupGate: (...a: unknown[]) => passSignupGate(...a),
  clearOwnLoginAttempts: () => clearOwnLoginAttempts(),
  clientIpFrom: () => null,
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to)
  },
}))

const { login, signup } = await import('./auth')

function formular(email: string, password: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', password)
  return fd
}

type Zustand = { formError?: string; fieldErrors?: { email?: string; password?: string } }

async function laufe(fn: () => Promise<unknown>) {
  try {
    return { state: (await fn()) as Zustand, redirectedTo: null as string | null }
  } catch (error) {
    if (error instanceof RedirectSignal) return { state: {}, redirectedTo: error.to }
    throw error
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  passLoginGate.mockResolvedValue({ state: 'allowed' })
  passSignupGate.mockResolvedValue({ state: 'allowed' })
  signInWithPassword.mockResolvedValue({ error: null })
  signUp.mockResolvedValue({ error: null })
})

describe('Registrierungssperre — der Wortlaut (AC-17, TD-24)', () => {
  it('spricht von Versuchen, nicht von angelegten Konten', async () => {
    passSignupGate.mockResolvedValue({ state: 'blocked', retryAfterMinutes: 60 })

    const { state } = await laufe(() => signup({}, formular('neu@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toBe(
      'Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in 60 Minuten erneut.',
    )
    // Die beiden Formulierungen, die der Vertrag ausschließt:
    expect(state.formError).not.toMatch(/Konten angelegt/)
    expect(state.formError).not.toMatch(/dieser Verbindung/)
  })

  it('sagt „1 Minute" statt „1 Minuten"', async () => {
    passSignupGate.mockResolvedValue({ state: 'blocked', retryAfterMinutes: 1 })

    const { state } = await laufe(() => signup({}, formular('neu@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toContain('in 1 Minute erneut')
  })

  it('legt bei gesperrter Registrierung gar kein Konto an', async () => {
    passSignupGate.mockResolvedValue({ state: 'blocked', retryAfterMinutes: 60 })

    await laufe(() => signup({}, formular('neu@example.com', 'EinLangesPasswort1')))

    expect(signUp).not.toHaveBeenCalled()
  })
})

describe('Gleichzeitige Registrierung auf dieselbe Adresse (EC-2)', () => {
  /**
   * Der Verlierer des Rennens bekommt von Supabase **nicht** „Adresse vergeben", sondern
   * einen `AuthRetryableFetchError`: HTTP 500, `code: undefined`,
   * „Database error saving new user". Der Unique-Constraint-Verstoß steht nur im Auth-Log.
   * Gemessen am 28.08.2026, QA-Bericht BUG-1.
   */
  const rennverlust = { status: 500, code: undefined, message: 'Database error saving new user' }
  const schonVergeben = { status: 422, code: 'user_already_exists', message: 'User already registered' }

  it('zeigt die Meldung aus AC-5, sobald der zweite Versuch den Gewinner sieht', async () => {
    signUp
      .mockResolvedValueOnce({ error: rennverlust })
      .mockResolvedValueOnce({ error: schonVergeben })

    const { state } = await laufe(() => signup({}, formular('race@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toBe('Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.')
    expect(signUp).toHaveBeenCalledTimes(2)
  })

  it('behauptet bei einem echten Ausfall NICHT, die Adresse sei vergeben', async () => {
    // Dieselbe Antwort entsteht, wenn der Signup-Trigger scheitert — dann gibt es kein
    // Konto zu der Adresse, und „hat schon ein Konto" würde vom Registrieren aussperren.
    signUp.mockResolvedValue({ error: rennverlust })

    const { state } = await laufe(() => signup({}, formular('neu@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toMatch(/^Die Registrierung ist gerade nicht möglich/)
    expect(state.formError).not.toMatch(/schon ein Konto/)
  })

  it('versucht es genau einmal erneut, nicht in einer Schleife', async () => {
    signUp.mockResolvedValue({ error: rennverlust })

    await laufe(() => signup({}, formular('neu@example.com', 'EinLangesPasswort1')))

    expect(signUp).toHaveBeenCalledTimes(2)
  })

  it('wiederholt nichts, wenn die Adresse schon beim ersten Versuch als vergeben gilt', async () => {
    signUp.mockResolvedValue({ error: schonVergeben })

    const { state } = await laufe(() => signup({}, formular('alt@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toBe('Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.')
    expect(signUp).toHaveBeenCalledTimes(1)
  })

  it('wiederholt nichts bei einem zu schwachen Passwort', async () => {
    signUp.mockResolvedValue({ error: { status: 422, code: 'weak_password' } })

    const { state } = await laufe(() => signup({}, formular('neu@example.com', 'kurz'.repeat(3))))

    expect(state.fieldErrors?.password).toBe('Dein Passwort braucht mindestens 10 Zeichen.')
    expect(signUp).toHaveBeenCalledTimes(1)
  })
})

describe('Anmeldung — eine einzige Meldung für beide Fälle (AC-7)', () => {
  it('sagt bei unbekannter Adresse und bei falschem Passwort dasselbe', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } })

    const unbekannt = await laufe(() => login({}, formular('gibtsnicht@example.com', 'irgendwas')))
    const falsch = await laufe(() => login({}, formular('bekannt@example.com', 'falsch')))

    expect(unbekannt.state.formError).toBe('E-Mail-Adresse oder Passwort stimmt nicht.')
    expect(falsch.state.formError).toBe(unbekannt.state.formError)
  })

  it('verrät die Passwortregel nicht, wenn das Passwort zu kurz ist (EC-7)', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } })

    const { state } = await laufe(() => login({}, formular('wer@example.com', 'abc')))

    expect(state.formError).toBe('E-Mail-Adresse oder Passwort stimmt nicht.')
    expect(state.formError).not.toMatch(/10 Zeichen/)
    // Entscheidend: Der Versuch läuft durch das Tor, statt vorher am Schema zu scheitern —
    // sonst wird er nicht gezählt und die Drosselung ist umgehbar.
    expect(passLoginGate).toHaveBeenCalled()
  })
})

describe('Getrennte Meldungen je Weg, wenn die Datenbank nicht erreichbar ist (EC-4)', () => {
  it('spricht auf /login von der Anmeldung', async () => {
    passLoginGate.mockResolvedValue({ state: 'unavailable' })

    const { state } = await laufe(() => login({}, formular('wer@example.com', 'irgendwas')))

    expect(state.formError).toMatch(/^Die Anmeldung ist gerade nicht möglich/)
  })

  it('spricht auf /signup von der Registrierung', async () => {
    passSignupGate.mockResolvedValue({ state: 'unavailable' })

    const { state } = await laufe(() => signup({}, formular('wer@example.com', 'EinLangesPasswort1')))

    expect(state.formError).toMatch(/^Die Registrierung ist gerade nicht möglich/)
  })
})
