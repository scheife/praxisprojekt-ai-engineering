import { describe, expect, it } from 'vitest'

import {
  formatAmount,
  formatAmountPlain,
  formatDay,
  formatMonthLabel,
  formatTimestamp,
} from './format'

describe('Beträge (AC-6, docs/design-system.md §5)', () => {
  it('schreibt deutschsprachig mit zwei Nachkommastellen und dem Zeichen dahinter', () => {
    expect(formatAmount(128450)).toBe('1.284,50 €')
    expect(formatAmount(2900)).toBe('29,00 €')
    expect(formatAmount(5)).toBe('0,05 €')
  })

  it('setzt ein geschütztes Leerzeichen, nicht ein gewöhnliches', () => {
    expect(formatAmount(100)).not.toContain(' €')
  })

  it('schreibt für den Export ohne Tausenderpunkt und ohne Zeichen (AC-27)', () => {
    expect(formatAmountPlain(123450)).toBe('1234,50')
    expect(formatAmountPlain(4250)).toBe('42,50')
  })
})

describe('Datum und Monat', () => {
  it('schreibt Tage österreichisch', () => {
    expect(formatDay('2026-08-14')).toBe('14.08.2026')
    expect(formatDay('2026-01-01')).toBe('01.01.2026')
  })

  it('benennt Monate ausgeschrieben', () => {
    expect(formatMonthLabel('2026-08')).toBe('August 2026')
    expect(formatMonthLabel('2026-01')).toBe('Jänner 2026')
  })

  it('schreibt Erfassungszeitpunkte in Wiener Zeit', () => {
    // 07:12 UTC im August ist 09:12 in Wien (Sommerzeit).
    expect(formatTimestamp('2026-08-14T07:12:00Z')).toBe('14.08.2026 09:12')
  })
})
