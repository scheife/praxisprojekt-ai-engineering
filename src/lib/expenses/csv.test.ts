import { describe, expect, it } from 'vitest'

import { buildCsv, csvFilename } from './csv'
import type { Expense } from './queries'

const ACCOUNT = { email: 'person@example.at', registeredAt: '2026-08-27T09:00:00Z' }

function expense(patch: Partial<Expense> = {}): Expense {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    amount_cents: 2900,
    category: 'software',
    spent_on: '2026-08-14',
    note: 'Hosting',
    created_at: '2026-08-14T07:12:00Z',
    ...patch,
  }
}

describe('Export-Datei (AC-27)', () => {
  it('beginnt mit BOM, trennt mit Semikolon und endet Zeilen mit CRLF', () => {
    const csv = buildCsv(ACCOUNT, [expense()])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('\r\n')
    expect(csv).not.toMatch(/[^\r]\n/)
  })

  it('nennt Konto, Registrierungsdatum und die Spaltenüberschriften', () => {
    const lines = buildCsv(ACCOUNT, []).replace('﻿', '').split('\r\n')
    expect(lines[0]).toBe('Konto;person@example.at')
    expect(lines[1]).toBe('Registriert am;27.08.2026')
    expect(lines[2]).toBe('')
    expect(lines[3]).toBe('Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am')
  })

  it('schreibt eine Ausgabe mit Anzeigename, Betrag ohne Zeichen und Wiener Zeit', () => {
    const lines = buildCsv(ACCOUNT, [expense()]).split('\r\n')
    expect(lines[4]).toBe('14.08.2026;Software & Abos;29,00;Hosting;14.08.2026 09:12')
  })

  it('begrenzt Felder mit Semikolon, Anführungszeichen und Umbruch (EC-10)', () => {
    const rows = buildCsv(ACCOUNT, [
      expense({ note: 'Mittagessen, Kunde' }),
      expense({ note: 'Rechnung; storniert' }),
      expense({ note: 'Der "grosse" Kunde' }),
      expense({ note: 'Zeile eins\nZeile zwei' }),
    ]).split('\r\n')

    // Ein Komma braucht keine Begrenzung — das Trennzeichen ist das Semikolon.
    expect(rows[4]).toContain(';Mittagessen, Kunde;')
    expect(rows[5]).toContain(';"Rechnung; storniert";')
    expect(rows[6]).toContain(';"Der ""grosse"" Kunde";')
    // Der Umbruch bleibt im begrenzten Feld stehen. Weil er ein reines \n ist und die
    // Datensätze mit \r\n enden, bleibt die Zeile beim Trennen an CRLF genau ein Datensatz —
    // die Spalten verrutschen nicht (EC-10).
    expect(rows[7]).toBe(
      '14.08.2026;Software & Abos;29,00;"Zeile eins\nZeile zwei";14.08.2026 09:12',
    )
  })

  it('lässt eine fehlende Notiz als leeres Feld stehen', () => {
    const lines = buildCsv(ACCOUNT, [expense({ note: null })]).split('\r\n')
    expect(lines[4]).toBe('14.08.2026;Software & Abos;29,00;;14.08.2026 09:12')
  })

  it('liefert ohne Ausgaben trotzdem Kopfblock und Überschriften', () => {
    const lines = buildCsv(ACCOUNT, []).replace('﻿', '').split('\r\n')
    expect(lines.filter(Boolean)).toHaveLength(3)
  })

  it('benennt die Datei nach dem Tag des Abrufs', () => {
    expect(csvFilename('2026-08-31')).toBe('auslage-export-2026-08-31.csv')
  })
})
