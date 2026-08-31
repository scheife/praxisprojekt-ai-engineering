import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRate, isCompletedDay, readRate, toEuroCents } from './rate'

/**
 * Der Kurs-Abruf und die Umrechnung.
 *
 * Geprüft wird, was der Code aus der Antwort macht — nicht der fremde Dienst. Die drei Dinge,
 * an denen dieses Feature scheitern könnte, stehen im Mittelpunkt: dass die **zwei
 * Fehlerklassen** wirklich getrennt bleiben (eine Meldung, die einen Ausfall behauptet, wo
 * keiner ist, schickt Leute ins Leere), dass der **laufende Tag nicht zwischengespeichert**
 * wird, und dass ein Betrag größer null **nie zu 0,00 €** wird.
 */

const antwort = (body: unknown, status = 200) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Antwort auswerten (EC-3, EC-4)', () => {
  it('liest Kurs und das **gelieferte** Kursdatum, nicht das angefragte (AC-4)', () => {
    // Angefragt war der Samstag; der Dienst antwortet mit dem Freitag. Gespeichert wird, was
    // er sagt — sonst stünde in der Zeile ein Kurs, den es an dem Tag nie gab.
    expect(readRate({ date: '2026-08-14', rates: { USD: 1.1567 } }, 'USD')).toEqual({
      state: 'ok',
      ratePerEur: 1.1567,
      rateDate: '2026-08-14',
    })
  })

  it('wertet eine fehlende Währung als dauerhaft, nicht als Ausfall (EC-4)', () => {
    // Der Dienst führte BRL im Jahr 2000 noch nicht. Ein zweiter Versuch ändert daran nichts,
    // und die Meldung darf keinen vorübergehenden Ausfall behaupten.
    expect(readRate({ date: '2000-01-03', rates: { USD: 0.99 } }, 'BRL')).toEqual({
      state: 'no-rate-for-date',
    })
  })

  it.each([
    ['Kurs 0', { date: '2026-08-14', rates: { USD: 0 } }],
    ['negativer Kurs', { date: '2026-08-14', rates: { USD: -1.2 } }],
    ['Kurs keine Zahl', { date: '2026-08-14', rates: { USD: '1.15' } }],
    ['Kurs unendlich', { date: '2026-08-14', rates: { USD: Infinity } }],
    ['Datum fehlt', { rates: { USD: 1.15 } }],
    ['Datum unlesbar', { date: '14.08.2026', rates: { USD: 1.15 } }],
    ['rates fehlt', { date: '2026-08-14' }],
    ['gar kein Objekt', 'kaputt'],
  ])('behandelt %s als Störung und nie als Kurs (EC-3)', (_name, body) => {
    expect(readRate(body, 'USD')).toEqual({ state: 'unavailable' })
  })
})

describe('Zwischenspeicher (EC-6, TD-11)', () => {
  it('speichert einen abgeschlossenen Tag zwischen', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(antwort({ date: '2026-08-14', rates: { USD: 1.1567 } }))
    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'))

    await fetchRate('USD', '2026-08-14')

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'force-cache' })
  })

  it('speichert den LAUFENDEN Tag NICHT zwischen', async () => {
    // Der Kurs von heute erscheint erst am Nachmittag. Würde die Vormittagsantwort 24 Stunden
    // festgehalten, bekämen alle weiteren Erfassungen dieses Tages den Vortageskurs — über ein
    // Wochenende bis zu drei Tage alt. Das ist der Fehler, den diese Zusicherung bewacht.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(antwort({ date: '2026-08-28', rates: { USD: 1.1593 } }))
    vi.setSystemTime(new Date('2026-08-31T08:00:00Z'))

    await fetchRate('USD', '2026-08-31')

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
  })

  it('zieht die Tagesgrenze in Wien, nicht in UTC', () => {
    // 31.08. 23:30 in London ist in Wien schon der 01.09. — der 31.08. ist dort abgeschlossen.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T22:30:00Z'))
    expect(isCompletedDay('2026-08-31')).toBe(true)
    expect(isCompletedDay('2026-09-01')).toBe(false)
  })
})

describe('Abruf (AC-5, EC-2, EC-4)', () => {
  it('fragt EUR als Basis ab — die Richtung, die genau bleibt (AC-8, TD-2)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(antwort({ date: '2026-08-17', rates: { IDR: 20654.32 } }))

    await fetchRate('IDR', '2026-08-17')

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/2026-08-17')
    expect(url).toContain('base=EUR')
    expect(url).toContain('symbols=IDR')
    // Nicht der alten Adresse folgen, sondern die neue direkt ansprechen (TD-1).
    expect(url.startsWith('https://api.frankfurter.dev/v1/')).toBe(true)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' })
  })

  it('macht aus HTTP 404 die dauerhafte Klasse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(antwort({ message: 'not found' }, 404))
    expect(await fetchRate('BRL', '2000-01-03')).toEqual({ state: 'no-rate-for-date' })
  })

  it('macht aus HTTP 500 die vorübergehende Klasse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(antwort({}, 500))
    expect(await fetchRate('USD', '2026-08-17')).toEqual({ state: 'unavailable' })
  })

  it('behandelt einen Netzwerkfehler als vorübergehend', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    expect(await fetchRate('USD', '2026-08-17')).toEqual({ state: 'unavailable' })
  })

  it('behandelt eine abgelaufene Frist als vorübergehend (EC-2)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
    )
    expect(await fetchRate('USD', '2026-08-17')).toEqual({ state: 'unavailable' })
  })

  it('gibt dem Abruf überhaupt eine Frist mit', async () => {
    // Ohne Frist wartet der Aufruf, bis der HTTP-Client von sich aus aufgibt — dieselbe
    // Lehre wie bei den Drosselungs-Toren in PROJ-1.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(antwort({ date: '2026-08-17', rates: { USD: 1.1593 } }))

    await fetchRate('USD', '2026-08-17')

    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('behandelt eine unlesbare Antwort als vorübergehend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    } as unknown as Response)
    expect(await fetchRate('USD', '2026-08-17')).toEqual({ state: 'unavailable' })
  })
})

describe('Umrechnung (AC-8, AC-18, EC-5)', () => {
  it('teilt statt zu multiplizieren — die genaue Richtung (TD-2)', () => {
    // 1.250,00 USD bei 1 € = 1,1593 USD sind 1.078,24 €.
    expect(toEuroCents(125000, 1.1593)).toEqual({ state: 'ok', amountCents: 107824 })
  })

  it('hält auch bei einer Währung mit großen Zahlen die Genauigkeit', () => {
    // Der gemessene Fehlerfall aus dem Entwurf: In der Gegenrichtung (1 IDR = 0,000048 €)
    // kämen 480,00 € heraus statt 484,16 € — rund 1 % daneben.
    expect(toEuroCents(999999999, 20654.32)).toEqual({ state: 'ok', amountCents: 48416 })
  })

  it('rundet kaufmännisch auf ganze Cent', () => {
    // 1,005 → 1 Cent bei einem Kurs von genau 1: der halbe Cent geht nach oben.
    expect(toEuroCents(3, 2)).toEqual({ state: 'ok', amountCents: 2 })
    expect(toEuroCents(1, 2)).toEqual({ state: 'ok', amountCents: 1 })
  })

  it('lehnt ab, statt einen Betrag größer null auf 0,00 € zu runden (EC-5)', () => {
    // 0,05 IDR sind rechnerisch 0,0000024 € — daraus darf keine Ausgabe über 0,00 € werden,
    // die in jeder Summe unsichtbar bliebe.
    expect(toEuroCents(5, 20654.32)).toEqual({ state: 'below-minimum', amountCents: 0 })
  })

  it('lehnt einen umgerechnet zu großen Betrag ab und nennt den Wert (AC-18)', () => {
    // In seiner eigenen Währung zulässig, umgerechnet über der Grenze — die Meldung braucht
    // den umgerechneten Wert, sonst wirkt die Ablehnung willkürlich.
    const result = toEuroCents(999999999, 0.5)
    expect(result.state).toBe('above-maximum')
    expect(result.amountCents).toBe(1999999998)
  })
})
