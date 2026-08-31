import { describe, expect, it } from 'vitest'

import {
  createExpenseSchema,
  expenseFieldsSchema,
  updateExpenseSchema,
} from './expense'

const NOW = new Date('2026-08-14T12:00:00Z')
const schema = () => expenseFieldsSchema(NOW)

const VALID = {
  amount: '24,90',
  category: 'software',
  spentOn: '2026-08-14',
  note: '',
}

function parse(patch: Partial<typeof VALID>) {
  return schema().safeParse({ ...VALID, ...patch })
}

function messageFor(patch: Partial<typeof VALID>, field: string): string | undefined {
  const result = parse(patch)
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === field)?.message
}

describe('Betrag lesen (AC-5, AC-6)', () => {
  it('versteht Komma und Punkt gleich', () => {
    expect(parse({ amount: '1284,50' }).success && parse({ amount: '1284,50' }).data?.amount)
      .toBe(128450)
    const dot = parse({ amount: '1284.50' })
    expect(dot.success && dot.data.amount).toBe(128450)
  })

  it('nimmt beide Trennzeichen gemischt — das rechteste trennt die Dezimalen', () => {
    expect((parse({ amount: '1.284,50' }) as { data: { amount: number } }).data.amount).toBe(128450)
    expect((parse({ amount: '1,284.50' }) as { data: { amount: number } }).data.amount).toBe(128450)
  })

  it('entfernt Leerzeichen, geschützte Leerzeichen und das Eurozeichen', () => {
    expect((parse({ amount: ' 24,90 € ' }) as { data: { amount: number } }).data.amount).toBe(2490)
    expect((parse({ amount: '1 284,50' }) as { data: { amount: number } }).data.amount).toBe(128450)
  })

  it('füllt fehlende Nachkommastellen auf', () => {
    expect((parse({ amount: '7' }) as { data: { amount: number } }).data.amount).toBe(700)
    expect((parse({ amount: '7,5' }) as { data: { amount: number } }).data.amount).toBe(750)
  })

  it('rechnet ohne Gleitkomma-Rundung (design.md, TD-1)', () => {
    expect((parse({ amount: '24,99' }) as { data: { amount: number } }).data.amount).toBe(2499)
    expect((parse({ amount: '0,10' }) as { data: { amount: number } }).data.amount).toBe(10)
  })

  it('meldet einen leeren Betrag', () => {
    expect(messageFor({ amount: '   ' }, 'amount')).toBe('Bitte gib einen Betrag ein.')
  })

  it('meldet einen unlesbaren Betrag', () => {
    // `12€34` steht hier bewusst nicht: das Eurozeichen wird laut design.md entfernt,
    // die Eingabe wird damit zu `1234` und ist lesbar.
    for (const raw of ['abc', '12,34,56', '1.2.3', '--5', '12a34', '1 2,3 4x']) {
      expect(messageFor({ amount: raw }, 'amount')).toBe(
        'Bitte gib den Betrag als Zahl ein, zum Beispiel 24,90.',
      )
    }
  })

  it('meldet mehr als zwei Nachkommastellen (AC-5)', () => {
    expect(messageFor({ amount: '24,905' }, 'amount')).toBe(
      'Höchstens zwei Nachkommastellen — zum Beispiel 24,90.',
    )
  })

  it('meldet 0 und negative Beträge mit eigenem Satz (AC-5)', () => {
    expect(messageFor({ amount: '0' }, 'amount')).toBe('Der Betrag muss größer als 0 sein.')
    expect(messageFor({ amount: '0,00' }, 'amount')).toBe('Der Betrag muss größer als 0 sein.')
    expect(messageFor({ amount: '-12,50' }, 'amount')).toBe('Der Betrag muss größer als 0 sein.')
  })

  it('meldet den Höchstbetrag (AC-29)', () => {
    expect((parse({ amount: '9999999,99' }) as { data: { amount: number } }).data.amount).toBe(999999999)
    expect(messageFor({ amount: '10000000,00' }, 'amount')).toBe(
      'Der Betrag darf höchstens 9.999.999,99 € sein.',
    )
  })
})

describe('Kategorie (AC-8, AC-10)', () => {
  it('nimmt einen bekannten Schlüssel', () => {
    expect(parse({ category: 'fees' }).success).toBe(true)
  })

  it('meldet eine fehlende Kategorie', () => {
    expect(messageFor({ category: '' }, 'category')).toBe('Bitte wähl eine Kategorie.')
  })

  it('lehnt einen erfundenen Schlüssel ab, auch am Formular vorbei', () => {
    expect(messageFor({ category: 'urlaub' }, 'category')).toBe('Diese Kategorie gibt es nicht.')
    expect(messageFor({ category: 'Software & Abos' }, 'category')).toBe(
      'Diese Kategorie gibt es nicht.',
    )
  })
})

describe('Datum (AC-7, AC-30)', () => {
  it('nimmt heute und die Vergangenheit', () => {
    expect(parse({ spentOn: '2026-08-14' }).success).toBe(true)
    expect(parse({ spentOn: '2000-01-01' }).success).toBe(true)
  })

  it('meldet ein fehlendes oder unlesbares Datum', () => {
    for (const raw of ['', '14.08.2026', '2026-8-14', '2026-02-31']) {
      expect(messageFor({ spentOn: raw }, 'spentOn')).toBe('Bitte gib ein Datum ein.')
    }
  })

  it('lehnt die Zukunft ab (AC-7)', () => {
    expect(messageFor({ spentOn: '2026-08-15' }, 'spentOn')).toBe(
      'Das Datum darf nicht in der Zukunft liegen.',
    )
  })

  it('lehnt Daten vor dem 01.01.2000 ab (AC-30)', () => {
    expect(messageFor({ spentOn: '1999-12-31' }, 'spentOn')).toBe(
      'Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl.',
    )
    expect(messageFor({ spentOn: '0202-08-14' }, 'spentOn')).toBe(
      'Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl.',
    )
  })
})

describe('Notiz (AC-9)', () => {
  it('macht aus einer leeren Notiz ein Fehlen, nicht einen leeren Text', () => {
    expect((parse({ note: '' }) as { data: { note: null } }).data.note).toBeNull()
    expect((parse({ note: '   ' }) as { data: { note: null } }).data.note).toBeNull()
  })

  it('behält eine Notiz und bereinigt ihre Ränder', () => {
    expect((parse({ note: '  Hosting  ' }) as { data: { note: string } }).data.note).toBe('Hosting')
  })

  it('lässt genau 200 Zeichen zu und meldet 201', () => {
    expect(parse({ note: 'a'.repeat(200) }).success).toBe(true)
    expect(messageFor({ note: 'a'.repeat(201) }, 'note')).toBe(
      'Die Notiz darf höchstens 200 Zeichen haben.',
    )
  })
})

describe('Erfassen und Ändern teilen die Regeln (AC-21)', () => {
  const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('verlangt beim Erfassen eine Vorgangskennung', () => {
    expect(createExpenseSchema(NOW).safeParse({ ...VALID, clientToken: UUID }).success).toBe(true)
    expect(createExpenseSchema(NOW).safeParse({ ...VALID, clientToken: 'keine' }).success).toBe(false)
  })

  it('verlangt beim Ändern eine Kennung der Ausgabe', () => {
    expect(updateExpenseSchema(NOW).safeParse({ ...VALID, id: UUID }).success).toBe(true)
    expect(updateExpenseSchema(NOW).safeParse({ ...VALID, id: '7' }).success).toBe(false)
  })

  it('wendet beim Ändern dieselben Feldregeln an', () => {
    const result = updateExpenseSchema(NOW).safeParse({ ...VALID, id: UUID, amount: '0' })
    expect(result.success).toBe(false)
    expect(!result.success && result.error.issues[0].message).toBe(
      'Der Betrag muss größer als 0 sein.',
    )
  })
})
