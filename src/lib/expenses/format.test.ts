import { describe, expect, it } from 'vitest'

import { formatAmount, formatAmountPlain, formatDay, formatForeignAmount, formatMonthLabel, formatRate, formatRatePlain, formatTimestamp, formatWeekday } from './format'

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

describe('Fremdwährung und Kurs (PROJ-3, AC-7, AC-8)', () => {
  it('schreibt den Originalbetrag mit dem Code dahinter', () => {
    expect(formatForeignAmount(125000, 'USD')).toBe('1.250,00\u00a0USD')
  })

  it('nutzt den Code und nicht das Symbol', () => {
    // `$` steht für ein gutes Dutzend Währungen, `USD` für genau eine.
    expect(formatForeignAmount(125000, 'USD')).not.toContain('$')
  })

  it('gibt auch einer Währung ohne Untereinheit zwei Nachkommastellen (TD-9)', () => {
    // Fachlich unschön, aber die Alternative wäre eine Tabelle der Nachkommastellen für alle
    // 30 Währungen. Der Test hält die Entscheidung fest, statt sie zu verschweigen.
    expect(formatForeignAmount(150000, 'JPY')).toBe('1.500,00\u00a0JPY')
  })

  it('schreibt den Kurs in Leserichtung: 1 Euro kostet X (AC-8)', () => {
    expect(formatRate(1.1593, 'USD')).toBe('1\u00a0€ = 1,1593\u00a0USD')
  })

  it('kommt mit großen und mit kleinen Kursen zurecht', () => {
    // Zwei Nachkommastellen wären für das Pfund zu wenig, sechs für die Rupiah unnötig.
    expect(formatRate(20654.32, 'IDR')).toBe('1\u00a0€ = 20.654,32\u00a0IDR')
    expect(formatRate(0.8572, 'GBP')).toBe('1\u00a0€ = 0,8572\u00a0GBP')
  })

  it('schreibt den Kurs für den Export ohne Tausenderpunkt (AC-19)', () => {
    // So liest ihn eine Tabellenkalkulation mit deutschsprachigen Einstellungen als Zahl.
    expect(formatRatePlain(1.1593)).toBe('1,1593')
  })
})

describe('Der Wochentag (AC-32)', () => {
  it('nennt den Wochentag zweibuchstabig', () => {
    expect(formatWeekday('2026-08-17')).toBe('Mo')
    expect(formatWeekday('2026-08-15')).toBe('Sa')
    expect(formatWeekday('2026-08-16')).toBe('So')
  })

  it('trifft das Wochenende, an dem PROJ-3 den Kurs des Vortags nimmt', () => {
    // Genau der Fall aus PROJ-3, AC-4: Die Ausgabe vom Samstag trägt den Freitagskurs. Der
    // Wochentag am Feld ist die Erklärung dafür, bevor jemand nachfragt.
    expect(formatWeekday('2026-08-15')).toBe('Sa')
    expect(formatWeekday('2026-08-14')).toBe('Fr')
  })

  it('lässt keine Zeitzone den Tag verschieben', () => {
    // Über eine Ortszeit gerechnet läge der 01.01.2000 östlich von Greenwich schon im Vorjahr.
    expect(formatWeekday('2000-01-01')).toBe('Sa')
    expect(formatWeekday('1999-12-31')).toBe('Fr')
  })
})
