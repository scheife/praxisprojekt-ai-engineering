import { describe, expect, it } from 'vitest'

import { CATEGORIES, categoryLabel, isCategoryKey } from './categories'

describe('Kategorienliste (AC-10, AC-14)', () => {
  it('hat die neun Kategorien aus docs/data-model.md in ihrer Reihenfolge', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Büromaterial',
      'Software & Abos',
      'Hardware & Geräte',
      'Reise & Fahrt',
      'Bewirtung',
      'Fortbildung',
      'Marketing & Werbung',
      'Gebühren & Beiträge',
      'Sonstiges',
    ])
  })

  it('erkennt gültige Schlüssel und weist alles andere ab', () => {
    expect(isCategoryKey('software')).toBe(true)
    expect(isCategoryKey('Büromaterial')).toBe(false)
    expect(isCategoryKey('urlaub')).toBe(false)
    expect(isCategoryKey('')).toBe(false)
    expect(isCategoryKey(null)).toBe(false)
    expect(isCategoryKey(3)).toBe(false)
  })

  it('übersetzt Schlüssel in Anzeigenamen', () => {
    expect(categoryLabel('fees')).toBe('Gebühren & Beiträge')
    expect(categoryLabel('unbekannt')).toBe('unbekannt')
  })
})
