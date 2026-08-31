import { describe, expect, it } from 'vitest'

import {
  addMonths,
  currentMonth,
  defaultSpentOn,
  monthBounds,
  monthOf,
  resolveMonth,
  todayInVienna,
} from './month'

// 2026-09-01T00:30 Wiener Zeit ist 2026-08-31T22:30 UTC — der Fall aus EC-6.
const AFTER_MIDNIGHT_IN_VIENNA = new Date('2026-08-31T22:30:00Z')
const AUGUST = new Date('2026-08-14T12:00:00Z')

describe('Zeitzone (EC-6)', () => {
  it('liest „heute" in Wien, nicht in UTC', () => {
    expect(todayInVienna(AFTER_MIDNIGHT_IN_VIENNA)).toBe('2026-09-01')
    expect(currentMonth(AFTER_MIDNIGHT_IN_VIENNA)).toBe('2026-09')
  })

  it('bleibt untertags gleich', () => {
    expect(todayInVienna(AUGUST)).toBe('2026-08-14')
  })
})

describe('Monatsgrenzen', () => {
  it('kennt den letzten Tag jedes Monats', () => {
    expect(monthBounds('2026-08')).toEqual({ first: '2026-08-01', last: '2026-08-31' })
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' })
    expect(monthBounds('2028-02').last).toBe('2028-02-29')
    expect(monthBounds('2026-04').last).toBe('2026-04-30')
  })

  it('verschiebt über Jahresgrenzen', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-08', -8)).toBe('2025-12')
  })

  it('liest den Monat eines Tages', () => {
    expect(monthOf('2026-08-14')).toBe('2026-08')
  })
})

describe('Monat aus der Adresse (AC-17, AC-19)', () => {
  it('nimmt einen gültigen vergangenen Monat', () => {
    expect(resolveMonth('2026-07', AUGUST)).toBe('2026-07')
  })

  it('fällt ohne Angabe auf den laufenden Monat', () => {
    expect(resolveMonth(undefined, AUGUST)).toBe('2026-08')
    expect(resolveMonth(null, AUGUST)).toBe('2026-08')
    expect(resolveMonth('', AUGUST)).toBe('2026-08')
  })

  it('fällt bei unbekanntem Format auf den laufenden Monat', () => {
    for (const junk of ['august', '2026', '26-08', '2026-8', '2026-08-14', '../etc']) {
      expect(resolveMonth(junk, AUGUST)).toBe('2026-08')
    }
  })

  it('fällt bei einem Monat, den es nicht gibt, auf den laufenden', () => {
    expect(resolveMonth('2026-13', AUGUST)).toBe('2026-08')
    expect(resolveMonth('2026-00', AUGUST)).toBe('2026-08')
  })

  it('fällt bei Zukunft und bei Vorzeit auf den laufenden Monat', () => {
    expect(resolveMonth('2026-09', AUGUST)).toBe('2026-08')
    expect(resolveMonth('1999-12', AUGUST)).toBe('2026-08')
    expect(resolveMonth('0202-08', AUGUST)).toBe('2026-08')
  })
})

describe('Datumsvorbelegung (AC-2)', () => {
  it('belegt im laufenden Monat mit heute vor', () => {
    expect(defaultSpentOn('2026-08', AUGUST)).toBe('2026-08-14')
  })

  it('belegt in einem früheren Monat mit dessen erstem Tag vor', () => {
    expect(defaultSpentOn('2026-07', AUGUST)).toBe('2026-07-01')
  })
})
