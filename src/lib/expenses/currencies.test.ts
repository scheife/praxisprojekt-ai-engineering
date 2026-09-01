import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  PINNED_CURRENCY_COUNT,
  currencyLabel,
  isCurrencyCode,
  isForeign,
} from './currencies'

/**
 * Die Migration ist die zweite Hälfte dieser Liste. `currencies.ts` sagt selbst: „Weichen die
 * beiden Listen auseinander, gewinnt die Datenbank — sie lehnt ab, was der Code durchgelassen
 * hat." Genau dieser Fall ist von außen unsichtbar und teuer: Die Auswahl bietet die Währung an,
 * der Kurs wird geholt (ein Aufruf beim fremden Dienst), und **erst das Schreiben** scheitert.
 */
const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260831140000_expenses_currency.sql',
)

/** Die Codes aus der Prüfregel `expenses_currency_known` der Migration. */
function codesInMigration(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8')
  const constraint = sql.slice(sql.indexOf('expenses_currency_known'))
  const list = constraint.slice(constraint.indexOf('('), constraint.indexOf(')'))
  return [...list.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]).sort()
}

describe('Währungsliste (AC-1)', () => {
  it('deckt sich zeichengleich mit der Prüfregel der Datenbank', () => {
    expect(CURRENCIES.map((c) => c.code).sort()).toEqual(codesInMigration())
  })

  it('beginnt mit EUR, USD, CHF, GBP — die vorangestellten Währungen', () => {
    expect(CURRENCIES.slice(0, PINNED_CURRENCY_COUNT).map((c) => c.code)).toEqual([
      'EUR',
      'USD',
      'CHF',
      'GBP',
    ])
  })

  it('führt die übrigen alphabetisch nach Code', () => {
    const rest = CURRENCIES.slice(PINNED_CURRENCY_COUNT).map((c) => c.code)
    expect(rest).toEqual([...rest].sort())
  })

  it('vergibt jeden Code genau einmal und zu jedem einen Anzeigenamen', () => {
    const codes = CURRENCIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(CURRENCIES.every((c) => c.label.trim().length > 0)).toBe(true)
  })

  it('hat EUR als Vorbelegung, und zwar an erster Stelle', () => {
    expect(DEFAULT_CURRENCY).toBe('EUR')
    expect(CURRENCIES[0].code).toBe('EUR')
  })

  it('erkennt gültige Codes und weist alles andere ab', () => {
    expect(isCurrencyCode('USD')).toBe(true)
    expect(isCurrencyCode('usd')).toBe(false)
    expect(isCurrencyCode('XYZ')).toBe(false)
    expect(isCurrencyCode('USD/../../../etc/passwd')).toBe(false)
    expect(isCurrencyCode('')).toBe(false)
    expect(isCurrencyCode(null)).toBe(false)
    expect(isCurrencyCode(3)).toBe(false)
  })

  it('übersetzt Codes in Anzeigenamen und lässt Unbekanntes stehen', () => {
    expect(currencyLabel('CHF')).toBe('Schweizer Franken')
    expect(currencyLabel('XYZ')).toBe('XYZ')
  })

  it('nennt genau alles außer Euro eine Fremdwährung', () => {
    expect(isForeign('EUR')).toBe(false)
    expect(isForeign('USD')).toBe(true)
  })
})
