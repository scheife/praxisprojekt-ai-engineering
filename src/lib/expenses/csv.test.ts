import { describe, expect, it } from 'vitest'

import { buildCsv, csvFilename } from './csv'
import type { Expense } from './queries'

const ACCOUNT = { email: 'person@example.at', registeredAt: '2026-08-27T09:00:00Z' }

function expense(patch: Partial<Expense> = {}): Expense {
  const merged: Expense = {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    amount_cents: 2900,
    category: 'software',
    spent_on: '2026-08-14',
    note: 'Hosting',
    created_at: '2026-08-14T07:12:00Z',
    currency: 'EUR',
    amount_original: 2900,
    rate_per_eur: null,
    rate_date: null,
    ...patch,
  }

  // Bei einer Euro-Ausgabe **ist** der Originalbetrag der Euro-Betrag — dieselbe Zusicherung,
  // die `expenses_currency_rate_consistent` in der Datenbank erzwingt. Die Vorlage hält sie
  // mit, damit kein Test gegen einen Zustand prüft, den es gar nicht geben kann.
  if (merged.currency === 'EUR' && patch.amount_original === undefined) {
    merged.amount_original = merged.amount_cents
  }

  return merged
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
    expect(lines[3]).toBe(
      'Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am;' +
        'Währung;Betrag (Original);Kurs (1 EUR =);Kursdatum',
    )
  })

  it('schreibt eine Ausgabe mit Anzeigename, Betrag ohne Zeichen und Wiener Zeit', () => {
    const lines = buildCsv(ACCOUNT, [expense()]).split('\r\n')
    // Eine Euro-Ausgabe: Währung und Originalbetrag stehen da, die beiden Kursspalten
    // bleiben **leer** — ein Kurs, den es nie gab, wäre eine Behauptung (AC-19).
    expect(lines[4]).toBe(
      '14.08.2026;Software & Abos;29,00;Hosting;14.08.2026 09:12;EUR;29,00;;',
    )
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
      '14.08.2026;Software & Abos;29,00;"Zeile eins\nZeile zwei";14.08.2026 09:12;EUR;29,00;;',
    )
  })

  it('führt bei Fremdwährung Originalbetrag, Kurs und Kursdatum mit (PROJ-3, AC-19)', () => {
    const lines = buildCsv(ACCOUNT, [
      expense({
        currency: 'USD',
        amount_original: 125000,
        amount_cents: 107824,
        rate_per_eur: 1.1593,
        rate_date: '2026-08-14',
        note: 'Jahreslizenz',
      }),
    ]).split('\r\n')

    // Der Euro-Betrag bleibt in seiner alten Spalte — er trägt die Summen. Daneben steht,
    // woraus er entstanden ist, sodass die Umrechnung in der Tabellenkalkulation
    // nachrechenbar ist: 1250,00 / 1,1593 = 1078,24.
    expect(lines[4]).toBe(
      '14.08.2026;Software & Abos;1078,24;Jahreslizenz;14.08.2026 09:12;' +
        'USD;1250,00;1,1593;14.08.2026',
    )
  })

  it('lässt bei Euro die beiden Kursspalten leer, statt 1,0000 zu behaupten (AC-19)', () => {
    const lines = buildCsv(ACCOUNT, [expense()]).split('\r\n')
    const felder = lines[4].split(';')
    expect(felder[5]).toBe('EUR')
    expect(felder[6]).toBe('29,00')
    expect(felder[7]).toBe('')
    expect(felder[8]).toBe('')
  })

  it('nimmt einer Formel den Anfang, statt sie in die Datei zu schreiben (BUG-1)', () => {
    const rows = buildCsv(ACCOUNT, [
      expense({ note: '=Rest aus Juli' }),
      expense({ note: '-50% Rabatt Parkhaus' }),
      expense({ note: '+Nachtrag' }),
      expense({ note: '@Kunde' }),
      expense({ note: "=cmd|' /C calc'!A0" }),
    ]).split('\r\n')

    // Ein vorangestelltes Hochkomma markiert den Inhalt als Text; die gängigen
    // Tabellenkalkulationen zeigen ihn danach an, statt ihn zu rechnen.
    expect(rows[4]).toContain(';"\'=Rest aus Juli";')
    expect(rows[5]).toContain(';"\'-50% Rabatt Parkhaus";')
    expect(rows[6]).toContain(";\"'+Nachtrag\";")
    expect(rows[7]).toContain(";\"'@Kunde\";")
    expect(rows[8]).toContain(";\"'=cmd|' /C calc'!A0\";")

    // Kein Feld beginnt mehr unbegrenzt mit einem Formelzeichen.
    for (const row of rows.slice(4)) {
      for (const cell of row.split(';')) {
        expect(cell.startsWith('=') || cell.startsWith('@')).toBe(false)
      }
    }
  })

  it('lässt gewöhnliche Notizen unangetastet', () => {
    const lines = buildCsv(ACCOUNT, [expense({ note: 'Hosting 50% Anteil' })]).split('\r\n')
    expect(lines[4]).toBe(
      '14.08.2026;Software & Abos;29,00;Hosting 50% Anteil;14.08.2026 09:12;EUR;29,00;;',
    )
  })

  it('rührt Datum, Kategorie und Betrag nicht an', () => {
    const lines = buildCsv(ACCOUNT, [expense()]).split('\r\n')
    // Beträge sind laut AC-5 immer größer 0, beginnen also nie mit einem Minus.
    expect(lines[4].split(';')[2]).toBe('29,00')
    expect(lines[4].split(';')[0]).toBe('14.08.2026')
  })

  it('lässt eine fehlende Notiz als leeres Feld stehen', () => {
    const lines = buildCsv(ACCOUNT, [expense({ note: null })]).split('\r\n')
    expect(lines[4]).toBe('14.08.2026;Software & Abos;29,00;;14.08.2026 09:12;EUR;29,00;;')
  })

  it('liefert ohne Ausgaben trotzdem Kopfblock und Überschriften', () => {
    const lines = buildCsv(ACCOUNT, []).replace('﻿', '').split('\r\n')
    expect(lines.filter(Boolean)).toHaveLength(3)
  })

  it('benennt die Datei nach dem Tag des Abrufs', () => {
    expect(csvFilename('2026-08-31')).toBe('auslage-export-2026-08-31.csv')
  })
})
