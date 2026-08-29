import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clientIpFrom, passLoginGate, passSignupGate, retryAfterMinutes } from './rate-limit'

describe('IP-Ermittlung — ohne vertrauenswürdigen Proxy (Vorgabe, BUG-1)', () => {
  // hops = 0: `x-forwarded-for` schreibt der Aufrufer. Wer ihn dann als Schlüssel nimmt,
  // lässt sich die Drosselung vom Angreifer konfigurieren. Also gar nicht erst lesen.
  it('ignoriert den Kopf vollständig, egal was darin steht', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9, 198.51.100.7, 192.0.2.1',
    })
    expect(clientIpFrom(headers, 0)).toBeNull()
  })

  it('lässt sich auch mit einem leeren ersten Eintrag nicht austricksen', () => {
    // Genau der Weg, der AC-9 und AC-17 im QA-Durchlauf ausgeschaltet hat.
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': ',1.2.3.4' }), 0)).toBeNull()
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': ',' }), 0)).toBeNull()
  })

  it('ignoriert auch x-real-ip, solange kein Proxy davorsteht', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.9' }), 0)).toBeNull()
  })

  it('liefert null, wenn gar kein Kopf da ist', () => {
    expect(clientIpFrom(new Headers(), 0)).toBeNull()
  })
})

describe('IP-Ermittlung — hinter einem vertrauenswürdigen Proxy', () => {
  it('nimmt den Eintrag, den der eigene Proxy angehängt hat — den letzten', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9, 198.51.100.7, 192.0.2.1',
    })
    expect(clientIpFrom(headers, 1)).toBe('192.0.2.1')
  })

  it('ignoriert, was der Aufrufer links davon erfindet', () => {
    // Der Angreifer behauptet eine andere IP; angehängt hat der Proxy 192.0.2.1.
    const gefaelscht = new Headers({ 'x-forwarded-for': 'frei-erfunden, 192.0.2.1' })
    const ehrlich = new Headers({ 'x-forwarded-for': '192.0.2.1' })
    expect(clientIpFrom(gefaelscht, 1)).toBe(clientIpFrom(ehrlich, 1))
  })

  it('zählt bei zwei Proxys den zweiten von rechts', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9, 198.51.100.7, 192.0.2.1',
    })
    expect(clientIpFrom(headers, 2)).toBe('198.51.100.7')
  })

  it('überspringt leere Einträge, statt sich von ihnen verschieben zu lassen', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': ', ,192.0.2.1' }), 1)).toBe(
      '192.0.2.1',
    )
  })

  it('weicht auf x-real-ip aus, wenn der Proxy nur den setzt', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.9' }), 1)).toBe('203.0.113.9')
  })

  it('liefert null, wenn die Kette kürzer ist als erwartet — lieber keine IP als eine erfundene', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '192.0.2.1' }), 2)).toBeNull()
  })
})

describe('Restzeit in Minuten (AC-8)', () => {
  it('rundet auf, damit die Auskunft nicht zu früh verspricht', () => {
    expect(retryAfterMinutes(900)).toBe(15)
    expect(retryAfterMinutes(61)).toBe(2)
  })

  it('sagt nie „in 0 Minuten"', () => {
    expect(retryAfterMinutes(1)).toBe(1)
    expect(retryAfterMinutes(0)).toBe(1)
  })
})

// --- Die Tore selbst (ergänzt von /qa) -------------------------------------
// Geprüft wird die Auswertung der Datenbank-Antwort, nicht die Datenbank: der
// Supabase-Client ist die externe Abhängigkeit und wird ersetzt, die Logik
// darüber ist echt. Wichtigster Fall ist `unavailable` — eine Drosselung, die
// bei einer Störung durchwinkt, ist genau dann weg, wenn sie gebraucht wird.

const rpc = vi.fn()
/** Fängt den `AbortSignal` ab, den das Tor mitgibt — die Frist aus BUG-1 (Lauf 6). */
const abortSignal = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    // Der echte Client gibt einen Builder zurück, auf dem `.abortSignal()` gekettet wird
    // und der erst danach erwartet wird. Genau diese Form bildet der Ersatz nach.
    rpc: (...args: unknown[]) => {
      const antwort = rpc(...args)
      return {
        abortSignal: (signal: AbortSignal) => {
          abortSignal(signal)
          return antwort
        },
      }
    },
  }),
}))

describe('Anmelde-Tor (AC-8, AC-9)', () => {
  beforeEach(() => rpc.mockReset())

  it('lässt durch, solange die Datenbank nicht sperrt', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    await expect(passLoginGate('a@example.com', '203.0.113.9')).resolves.toEqual({
      state: 'allowed',
    })
  })

  it('reicht Adresse und IP unverändert an die Datenbankfunktion weiter', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    await passLoginGate('a@example.com', '203.0.113.9')
    expect(rpc).toHaveBeenCalledWith('login_attempt_gate', {
      p_secret: expect.any(String),
      p_email: 'a@example.com',
      p_ip: '203.0.113.9',
    })
  })

  it('sperrt und rechnet die Restzeit in aufgerundete Minuten um', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: true, retry_after_seconds: 61 }], error: null })
    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'blocked',
      retryAfterMinutes: 2,
    })
  })

  it('fällt bei einem Datenbankfehler ZU, nicht auf', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
  })

  it('fällt auch zu, wenn die Antwort leer bleibt', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
  })

  it('versteht die Antwort auch als einzelnes Objekt statt als Liste', async () => {
    rpc.mockResolvedValue({ data: { blocked: true, retry_after_seconds: 900 }, error: null })
    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'blocked',
      retryAfterMinutes: 15,
    })
  })
})

describe('Registrierungs-Tor (AC-17)', () => {
  beforeEach(() => rpc.mockReset())

  it('ruft das eigene Tor auf, nicht das der Anmeldung', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    await passSignupGate('neu@example.com', '203.0.113.9')
    expect(rpc).toHaveBeenCalledWith('signup_attempt_gate', {
      p_secret: expect.any(String),
      p_email: 'neu@example.com',
      p_ip: '203.0.113.9',
    })
  })

  it('sperrt mit der Restzeit aus der Datenbank', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: true, retry_after_seconds: 3600 }], error: null })
    await expect(passSignupGate('neu@example.com', '203.0.113.9')).resolves.toEqual({
      state: 'blocked',
      retryAfterMinutes: 60,
    })
  })

  it('fällt bei einem Datenbankfehler ZU, nicht auf', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(passSignupGate('neu@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
  })
})

describe('Frist auf dem Tor-Aufruf (EC-4, QA-Lauf 6 BUG-1)', () => {
  let timeoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    rpc.mockReset()
    abortSignal.mockReset()
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    // Direkt auf `AbortSignal.timeout` horchen. Nur so faellt auf, wenn die Frist durch ein
    // Signal ohne Ablauf ersetzt wird — ein blosses `instanceof AbortSignal` haelt das nicht
    // auseinander und liesse den Befund aus Lauf 6 zurueckkehren.
    timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
  })

  afterEach(() => timeoutSpy.mockRestore())

  /**
   * Warum diese Tests existieren: Ohne eigene Frist wartete der Aufruf, bis der HTTP-Client
   * aufgab — gemessen 60 Sekunden bei angehaltener Datenbank. Die Meldung aus EC-4 kam dann
   * zwar richtig, aber eine Minute zu spaet.
   */
  it('setzt dem Anmelde-Tor eine echte Frist, kein Signal ohne Ablauf', async () => {
    await passLoginGate('a@example.com', null)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    const ms = timeoutSpy.mock.calls[0][0] as number
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(5000)
  })

  it('setzt dem Registrierungs-Tor dieselbe Frist', async () => {
    await passSignupGate('a@example.com', null)

    expect(timeoutSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy.mock.calls[0][0]).toBe(2000)
  })

  it('reicht genau dieses Signal an den Aufruf weiter', async () => {
    await passLoginGate('a@example.com', null)

    expect(abortSignal).toHaveBeenCalledTimes(1)
    expect(abortSignal.mock.calls[0][0]).toBe(timeoutSpy.mock.results[0].value)
  })

  it('bricht nicht sofort ab — sonst waere jede Anmeldung gesperrt', async () => {
    await passLoginGate('a@example.com', null)

    expect((abortSignal.mock.calls[0][0] as AbortSignal).aborted).toBe(false)
  })

  it('faellt ZU, wenn die Frist ablaeuft — nicht auf', async () => {
    // So meldet der Supabase-Client einen Abbruch: als gewoehnlicher Fehler, nicht als
    // Ausnahme (postgrest-js, PostgrestBuilder).
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'AbortError: The operation was aborted', code: '', status: 0 },
    })

    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
    await expect(passSignupGate('a@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
  })
})

describe('Das geteilte Geheimnis am Tor (TD-26, QA-Lauf 6 BUG-2)', () => {
  beforeEach(() => {
    rpc.mockReset()
    vi.unstubAllEnvs()
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  /**
   * Warum diese Tests existieren: Ohne das Geheimnis genügten fünf anonyme RPC-Aufrufe, um
   * ein fremdes Konto 15 Minuten zu sperren — der öffentliche Schlüssel steckt in jedem
   * Browser. Das Ausführungsrecht kann nicht entzogen werden, weil die App die Tore ohne
   * Sitzung aufrufen muss; der Schutz hängt also allein daran, dass das Geheimnis
   * tatsächlich mitgeschickt wird.
   */
  it('schickt das Geheimnis aus der Umgebung an das Anmelde-Tor', async () => {
    vi.stubEnv('GATE_SECRET', 'ein-hinreichend-langes-geheimnis')

    await passLoginGate('a@example.com', null)

    expect(rpc).toHaveBeenCalledWith('login_attempt_gate', {
      p_secret: 'ein-hinreichend-langes-geheimnis',
      p_email: 'a@example.com',
      p_ip: null,
    })
  })

  it('schickt es auch an das Registrierungs-Tor', async () => {
    vi.stubEnv('GATE_SECRET', 'ein-hinreichend-langes-geheimnis')

    await passSignupGate('neu@example.com', null)

    expect(rpc).toHaveBeenCalledWith('signup_attempt_gate', {
      p_secret: 'ein-hinreichend-langes-geheimnis',
      p_email: 'neu@example.com',
      p_ip: null,
    })
  })

  it('schickt niemals `undefined` — ein fehlender Wert wird zum leeren Text, den die Datenbank ablehnt', async () => {
    vi.stubEnv('GATE_SECRET', undefined)

    await passLoginGate('a@example.com', null)

    expect(rpc.mock.calls[0][1]).toMatchObject({ p_secret: '' })
  })

  it('behandelt die Ablehnung der Datenbank als Störung — die Anmeldung läuft NICHT durch', async () => {
    // So kommt `raise exception … errcode 42501` beim Client an.
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'gate secret mismatch', code: '42501' },
    })

    await expect(passLoginGate('a@example.com', null)).resolves.toEqual({
      state: 'unavailable',
    })
  })
})
