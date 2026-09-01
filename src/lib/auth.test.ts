import { describe, expect, it, vi, beforeEach } from 'vitest'

import { getUser, requireUser } from '@/lib/auth'

const getUserRaw = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: () => getUserRaw() } }),
}))

/** `redirect()` bricht in Next.js die Ausführung ab. Hier tut es das auch — sichtbar. */
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

const PERSON = { id: 'uid-1', email: 'wer@example.at' }

beforeEach(() => getUserRaw.mockReset())

describe('Die drei Ausgänge der Sitzungsprüfung (EC-12)', () => {
  it('angemeldet: gibt die Person zurück', async () => {
    getUserRaw.mockResolvedValue({ data: { user: PERSON }, error: null })
    expect(await getUser()).toEqual({ state: 'signed-in', user: PERSON })
  })

  it('nicht angemeldet: der Server hat geantwortet, die Sitzung gilt nicht', async () => {
    getUserRaw.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'Invalid claim', status: 401 },
    })
    expect(await getUser()).toEqual({ state: 'signed-out' })
  })

  it('nicht angemeldet: auch ohne Fehler, wenn schlicht niemand da ist', async () => {
    getUserRaw.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getUser()).toEqual({ state: 'signed-out' })
  })

  it('nicht feststellbar: der Aufruf kam gar nicht durch', async () => {
    getUserRaw.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('auslage/unreachable: TimeoutError'), {
        name: 'AuthRetryableFetchError',
      }),
    })
    expect(await getUser()).toEqual({ state: 'unavailable' })
  })
})

describe('requireUser leitet nur im richtigen Fall um (EC-5 gegen EC-12)', () => {
  it('schickt eine abgemeldete Person auf /login', async () => {
    getUserRaw.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'Invalid claim', status: 401 },
    })
    await expect(requireUser()).rejects.toThrow('redirect:/login?reason=session-expired')
  })

  it('schickt bei einem Nichterreichen NIEMANDEN auf /login', async () => {
    // **Der Kern von EC-12.** Früher endeten beide Fälle bei `null` und damit bei derselben
    // Weiterleitung: Die App behauptete „deine Sitzung ist abgelaufen", ohne das geprüft zu
    // haben — und schickte die Person auf eine Seite, die denselben Auth-Server braucht. Die
    // einzige dort angebotene Handlung konnte gar nicht gelingen.
    getUserRaw.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('nicht erreichbar'), { name: 'AuthRetryableFetchError' }),
    })
    await expect(requireUser()).resolves.toEqual({ state: 'unavailable' })
  })

  it('reicht die angemeldete Person unverändert durch', async () => {
    getUserRaw.mockResolvedValue({ data: { user: PERSON }, error: null })
    await expect(requireUser()).resolves.toEqual({ state: 'signed-in', user: PERSON })
  })
})
