import { describe, expect, it, vi, afterEach } from 'vitest'

import { DEADLINE_MS, DEADLINE_CLIENT_OPTIONS, isUnreachable } from '@/lib/supabase/deadline'

/** Der `fetch` mit Frist, so wie er tatsächlich an beide Clients gereicht wird. */
const deadlineFetch = DEADLINE_CLIENT_OPTIONS.global.fetch

afterEach(() => vi.restoreAllMocks())

describe('Die Frist (EC-4)', () => {
  it('bricht wirklich ab — sie ist keine Zusage auf dem Papier', async () => {
    // Eine Gegenstelle, die annimmt und **nie** antwortet: genau die Lage, die im QA-Lauf
    // 50,4 Sekunden gekostet hat. Der Abbruch kommt hier aus dem echten `AbortSignal`, nicht
    // aus einer gestellten Ablehnung — deshalb dauert dieser Test seine zwei Sekunden.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )

    const begonnen = Date.now()
    await expect(deadlineFetch('http://example.invalid')).rejects.toThrow(/auslage\/unreachable/)
    const gedauert = Date.now() - begonnen

    expect(gedauert).toBeGreaterThanOrEqual(DEADLINE_MS - 250)
    expect(gedauert).toBeLessThan(DEADLINE_MS + 1500)
  }, 10_000)

  it('markiert auch einen sofortigen Netzfehler als Nichterreichen', async () => {
    // Nicht nur die abgelaufene Frist: Wer gar nicht erst zustande kommt, ist ebenso wenig
    // erreichbar. Beides muss dieselbe Antwort auslösen.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    await expect(deadlineFetch('http://example.invalid')).rejects.toThrow(/auslage\/unreachable/)
  })

  it('lässt eine gelungene Antwort unangetastet durch', async () => {
    const antwort = new Response('{}', { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(antwort)

    await expect(deadlineFetch('http://example.invalid')).resolves.toBe(antwort)
  })

  it('nimmt ein Abbruchsignal des Aufrufers mit, statt es zu verwerfen', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const eigenes = new AbortController()

    await deadlineFetch('http://example.invalid', { signal: eigenes.signal })

    const durchgereicht = (fetchMock.mock.calls[0][1] as RequestInit).signal
    expect(durchgereicht).toBeInstanceOf(AbortSignal)
    // Das durchgereichte Signal ist nicht das eigene, sondern die Verbindung aus beiden.
    expect(durchgereicht).not.toBe(eigenes.signal)
    eigenes.abort()
    expect(durchgereicht?.aborted).toBe(true)
  })
})

describe('Die eingebauten Wiederholversuche (TD-28)', () => {
  it('sind abgeschaltet — sonst wäre die Frist je Versuch wirksam', () => {
    // **Diese eine Zeile trägt EC-4.** Seit `supabase-js` 2.102.0 wiederholt der Client
    // Netzwerkfehler von sich aus (Vorgabe `true`). Stünde das wieder an, dauerte ein Ausfall
    // ein Vielfaches der zugesagten zwei Sekunden — und niemand würde es merken, weil keine
    // einzelne Anfrage länger bräuchte als erlaubt. Deshalb steht es hier als Zusicherung.
    expect(DEADLINE_CLIENT_OPTIONS.db.retry).toBe(false)
  })

  it('hält die Frist bei den zwei Sekunden aus PROJ-1', () => {
    expect(DEADLINE_MS).toBe(2000)
  })
})

describe('Antwort oder Nichterreichen (EC-12)', () => {
  it('erkennt die eigene Markierung', () => {
    expect(isUnreachable(new Error('auslage/unreachable: TimeoutError'))).toBe(true)
  })

  it('erkennt den Netzwerkfehler der Auth-Bibliothek — er umfasst auch 5xx', () => {
    expect(isUnreachable(Object.assign(new Error('HTTP 503'), {
      name: 'AuthRetryableFetchError',
    }))).toBe(true)
  })

  it('hält eine beantwortete Ablehnung NICHT für ein Nichterreichen', () => {
    // Der Kern der Unterscheidung: Hier hat der Server geantwortet. Wer das verwechselt,
    // schickt eine angemeldete Person in den Nicht-erreichbar-Zustand — oder, schlimmer, eine
    // abgemeldete an der Anmeldung vorbei.
    expect(isUnreachable({ name: 'AuthApiError', message: 'Invalid claim', status: 401 })).toBe(false)
    expect(isUnreachable({ code: '42501', message: 'permission denied for table expenses' })).toBe(false)
    expect(isUnreachable({ code: '23505', message: 'duplicate key value' })).toBe(false)
  })

  it('kommt mit allem zurecht, was kein Fehlerobjekt ist', () => {
    expect(isUnreachable(null)).toBe(false)
    expect(isUnreachable(undefined)).toBe(false)
    expect(isUnreachable('auslage/unreachable')).toBe(false)
  })
})
