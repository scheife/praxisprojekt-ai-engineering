import { describe, expect, it } from 'vitest'

import { summarize } from './summary'

describe('Monatsrechnung (AC-13, AC-14, EC-7)', () => {
  it('summiert in ganzen Cent, ohne Rundung', () => {
    const { totalCents } = summarize([
      { category: 'software', amountCents: 10 },
      { category: 'travel', amountCents: 20 },
    ])
    expect(totalCents).toBe(30)
  })

  it('fasst je Kategorie zusammen und sortiert absteigend nach Betrag', () => {
    const { categories } = summarize([
      { category: 'software', amountCents: 2900 },
      { category: 'travel', amountCents: 12000 },
      { category: 'software', amountCents: 1500 },
      { category: 'fees', amountCents: 400 },
    ])
    expect(categories.map((c) => [c.category, c.amountCents])).toEqual([
      ['travel', 12000],
      ['software', 4400],
      ['fees', 400],
    ])
  })

  it('nennt den deutschen Anzeigenamen', () => {
    const { categories } = summarize([{ category: 'fees', amountCents: 400 }])
    expect(categories[0].label).toBe('Gebühren & Beiträge')
  })

  it('sortiert bei gleichem Betrag stabil nach Anzeigename', () => {
    const { categories } = summarize([
      { category: 'travel', amountCents: 500 },
      { category: 'hardware', amountCents: 500 },
      { category: 'education', amountCents: 500 },
    ])
    expect(categories.map((c) => c.label)).toEqual([
      'Fortbildung',
      'Hardware & Geräte',
      'Reise & Fahrt',
    ])
  })

  it('lässt Kategorien ohne Betrag weg (AC-14)', () => {
    const { categories } = summarize([{ category: 'software', amountCents: 100 }])
    expect(categories).toHaveLength(1)
  })

  it('gibt bei keinem Eintrag eine leere Rechnung zurück', () => {
    expect(summarize([])).toEqual({ totalCents: 0, categories: [] })
  })

  it('rechnet Prozentanteile kaufmännisch — Kategoriesummen bleiben exakt (EC-7)', () => {
    const rows = [
      { category: 'software', amountCents: 3333 },
      { category: 'travel', amountCents: 3333 },
      { category: 'fees', amountCents: 3334 },
    ]
    const { totalCents, categories } = summarize(rows)

    // Die Prozentwerte dürfen sich auf 99 % oder 101 % addieren …
    const percentSum = categories.reduce((s, c) => s + c.percent, 0)
    expect(percentSum).toBeGreaterThanOrEqual(99)
    expect(percentSum).toBeLessThanOrEqual(101)

    // … die Beträge in Cent dagegen ergeben exakt die Gesamtsumme.
    expect(categories.reduce((s, c) => s + c.amountCents, 0)).toBe(totalCents)
    expect(totalCents).toBe(10000)
  })
})
