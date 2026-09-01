import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

const getClaims = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: () => getClaims() } }),
}))

/** Eine Anfrage auf `pfad`, wahlweise mit Sitzungs-Cookie. */
function anfrage(pfad: string, mitCookie = false): NextRequest {
  const headers = new Headers()
  if (mitCookie) headers.set('cookie', 'sb-localhost-auth-token=irgendwas')
  return new NextRequest(new URL(`http://localhost:3000${pfad}`), { headers })
}

/** Wohin die Antwort umleitet — oder `null`, wenn sie durchlässt. */
function ziel(response: Response): string | null {
  if (response.status !== 307 && response.status !== 308) return null
  const location = response.headers.get('location')
  return location ? new URL(location).pathname + new URL(location).search : null
}

const ANGEMELDET = { data: { claims: { sub: 'uid-1' } }, error: null }
const ABGEMELDET = { data: null, error: { name: 'AuthApiError', message: 'invalid claim' } }
const NICHT_ERREICHBAR = {
  data: null,
  error: Object.assign(new Error('auslage/unreachable: TimeoutError'), {
    name: 'AuthRetryableFetchError',
  }),
}

beforeEach(() => getClaims.mockReset())

describe('Die Vorprüfung, wenn sie eine Antwort bekommt (AC-11, AC-12)', () => {
  it('lässt eine angemeldete Person auf die geschützte Seite', async () => {
    getClaims.mockResolvedValue(ANGEMELDET)
    expect(ziel(await proxy(anfrage('/')))).toBeNull()
  })

  it('schickt eine abgemeldete Person von der geschützten Seite auf /login', async () => {
    getClaims.mockResolvedValue(ABGEMELDET)
    expect(ziel(await proxy(anfrage('/')))).toBe('/login')
  })

  it('nennt die abgelaufene Sitzung, wenn vorher eine da war (EC-5)', async () => {
    getClaims.mockResolvedValue(ABGEMELDET)
    expect(ziel(await proxy(anfrage('/', true)))).toBe('/login?reason=session-expired')
  })

  it('schickt eine angemeldete Person von /login zurück auf /', async () => {
    getClaims.mockResolvedValue(ANGEMELDET)
    expect(ziel(await proxy(anfrage('/login')))).toBe('/')
  })
})

describe('Die Vorprüfung, wenn sie KEINE Antwort bekommt (EC-12)', () => {
  it('lässt durch, statt auf /login umzuleiten', async () => {
    // **Der Kern.** Früher fiel `signedIn` bei einem Fehler auf `false` und die Vorprüfung
    // leitete mit „Sitzung abgelaufen" um — eine Behauptung, die nie geprüft wurde, und ein
    // Ziel, das denselben Auth-Server braucht. Die Seite dahinter zeigt jetzt den
    // Nicht-erreichbar-Zustand; dass sie überhaupt dazu kommt, hängt an dieser Zeile.
    getClaims.mockResolvedValue(NICHT_ERREICHBAR)
    expect(ziel(await proxy(anfrage('/')))).toBeNull()
  })

  it('lässt auch mit vorhandenem Sitzungs-Cookie durch — kein „Sitzung abgelaufen"', async () => {
    getClaims.mockResolvedValue(NICHT_ERREICHBAR)
    expect(ziel(await proxy(anfrage('/', true)))).toBeNull()
  })

  it('leitet auch von /login nicht weg, wenn nichts feststellbar ist', async () => {
    getClaims.mockResolvedValue(NICHT_ERREICHBAR)
    expect(ziel(await proxy(anfrage('/login')))).toBeNull()
  })

  it('lässt geschützte Antworten trotzdem nicht im Verlauf liegen (AC-14)', async () => {
    getClaims.mockResolvedValue(NICHT_ERREICHBAR)
    const response = await proxy(anfrage('/'))
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
})
