import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Abmelden und Konto löschen — die Verzweigungen, nicht die Datenbank.
 *
 * Geprüft wird, was der Code aus der Antwort macht: Wird bei einem Fehler wirklich **nicht**
 * abgemeldet und **nicht** weitergeleitet? Wird die Löschung überhaupt versucht, wenn niemand
 * angemeldet ist? Supabase und die Weiterleitung sind ersetzt, die Logik dazwischen ist echt.
 *
 * Der Fehlerzweig hat besondere Geschichte: Er war bis zur Behebung von BUG-4 **toter Code** —
 * der Bestätigungsdialog schloss sich beim Klick, also war er längst weg, wenn die Meldung
 * eintraf. Jetzt ist er erreichbar, und deshalb gehört er getestet.
 */

const rpc = vi.fn()
const signOut = vi.fn()
const requireUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc, auth: { signOut } }),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: () => requireUser(),
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

const { deleteAccount, logout } = await import('./account')

/** Führt die Action aus und gibt zurück, wohin sie umgeleitet hat — oder ihren Zustand. */
async function laufe(fn: () => Promise<unknown>) {
  try {
    return { state: await fn(), redirectedTo: null as string | null }
  } catch (error) {
    if (error instanceof RedirectSignal) return { state: null, redirectedTo: error.to }
    throw error
  }
}

beforeEach(() => {
  rpc.mockReset()
  signOut.mockReset()
  requireUser.mockReset()
  requireUser.mockResolvedValue({ state: 'signed-in', user: { id: 'uid-1', email: 'wer@example.com' } })
})

describe('Abmelden (AC-14)', () => {
  it('beendet die Sitzung und leitet auf die Anmeldeseite', async () => {
    const { redirectedTo } = await laufe(() => logout())
    expect(signOut).toHaveBeenCalled()
    expect(redirectedTo).toBe('/login?reason=signed-out')
  })

  it('meldet ab, BEVOR es weiterleitet — sonst bliebe die Sitzung bestehen', async () => {
    await laufe(() => logout())
    expect(signOut).toHaveBeenCalledOnce()
  })
})

describe('Konto löschen (AC-15)', () => {
  it('ruft die Datenbankfunktion auf, meldet lokal ab und leitet weiter', async () => {
    rpc.mockResolvedValue({ error: null })
    const { redirectedTo } = await laufe(() => deleteAccount({}, new FormData()))
    expect(rpc).toHaveBeenCalledWith('delete_own_account')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(redirectedTo).toBe('/login?reason=deleted')
  })

  it('nimmt kein Argument entgegen, das ein fremdes Konto treffen könnte', async () => {
    rpc.mockResolvedValue({ error: null })
    await laufe(() => deleteAccount({}, new FormData()))
    // Genau ein Argument: der Funktionsname. Die Adresse kommt aus der Sitzung.
    expect(rpc.mock.calls[0]).toHaveLength(1)
  })

  it('prüft die Anmeldung, bevor es irgendetwas löscht', async () => {
    requireUser.mockRejectedValue(new RedirectSignal('/login?reason=session-expired'))
    const { redirectedTo } = await laufe(() => deleteAccount({}, new FormData()))
    expect(redirectedTo).toBe('/login?reason=session-expired')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('zeigt bei einem Datenbankfehler eine Meldung — und meldet NICHT ab', async () => {
    rpc.mockResolvedValue({ error: { message: 'connection refused' } })
    const { state, redirectedTo } = await laufe(() => deleteAccount({}, new FormData()))
    expect(state).toEqual({
      formError:
        'Das Löschen hat gerade nicht geklappt. Bitte versuche es in einem Moment noch einmal.',
    })
    expect(redirectedTo).toBeNull()
    // Das ist der Kern: Wer nicht gelöscht wurde, darf auch nicht abgemeldet werden —
    // sonst steht die Person vor der Anmeldeseite und glaubt, ihr Konto sei weg.
    expect(signOut).not.toHaveBeenCalled()
  })

  it('verrät im Fehlerfall nichts über die Ursache', async () => {
    rpc.mockResolvedValue({ error: { message: 'permission denied for table auth.users' } })
    const { state } = await laufe(() => deleteAccount({}, new FormData()))
    expect(JSON.stringify(state)).not.toContain('permission denied')
  })
})
