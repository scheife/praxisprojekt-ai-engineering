import { describe, expect, it } from 'vitest'

import { clientIpFrom, retryAfterMinutes } from './rate-limit'

describe('IP-Ermittlung (TD-14)', () => {
  it('nimmt bei mehreren Einträgen den ersten — die ursprüngliche Person', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9, 198.51.100.7, 192.0.2.1',
    })
    expect(clientIpFrom(headers)).toBe('203.0.113.9')
  })

  it('weicht auf x-real-ip aus', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('liefert null, wenn keine IP erkennbar ist — dann greift nur die Adress-Regel', () => {
    expect(clientIpFrom(new Headers())).toBeNull()
  })

  it('behandelt einen leeren Kopf wie einen fehlenden', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '   ' }))).toBeNull()
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
