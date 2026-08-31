import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Erfassen, Ändern, Löschen — die Verzweigungen, nicht die Datenbank.
 *
 * Geprüft wird, was der Code aus der Antwort macht und **womit er die Datenbank aufruft**:
 * Steht die Nutzer-ID wirklich aus der Sitzung und nie aus dem Formular in der Anweisung
 * (AC-25)? Ist die Änderung auf die eigene Zeile eingeschränkt (AC-24)? Wird aus einer
 * Verletzung der Eindeutigkeit ein Erfolg statt eines Fehlers (EC-1)? Wird nach null
 * betroffenen Zeilen nichts wieder angelegt (EC-2)?
 *
 * Row Level Security ist die zweite, unabhängige Schicht — sie wird hier nicht mitgeprüft,
 * sondern liegt in der Migration und gehört `/qa`.
 */

const refresh = vi.fn()
const requireUser = vi.fn()
const from = vi.fn()

vi.mock('next/cache', () => ({ refresh: () => refresh() }))
vi.mock('@/lib/auth', () => ({ requireUser: () => requireUser() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from }),
}))

const { createExpense, updateExpense, deleteExpense } = await import('./expenses')
const { IDLE } = await import('@/lib/expenses/form-state')

type Result = { data: unknown; error: unknown }

/** Ein Abfrage-Baustein, der jeden Aufruf mitschreibt und am Ende das gesetzte Ergebnis liefert. */
function builder(result: Result) {
  const calls: [string, ...unknown[]][] = []
  const self: Record<string, unknown> = {}
  for (const method of ['insert', 'select', 'eq', 'update', 'delete', 'gte', 'lte', 'order']) {
    self[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return self
    }
  }
  self.single = async () => result
  self.maybeSingle = async () => result
  self.then = (ok: (r: Result) => unknown, no?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, no)
  self.calls = calls
  return self as typeof self & { calls: [string, ...unknown[]][] }
}

/** Der Aufruf `n` an die Tabelle, mit allem, was daran gekettet wurde. */
function callArgs(index: number) {
  return (from.mock.results[index].value as { calls: [string, ...unknown[]][] }).calls
}

function argOf(index: number, method: string) {
  return callArgs(index).find(([name]) => name === method)?.slice(1)
}

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.append(key, value)
  return data
}

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const EXPENSE_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
const VALID = { amount: '29,00', category: 'software', spentOn: '2026-07-14', note: 'Hosting' }

beforeEach(() => {
  refresh.mockReset()
  requireUser.mockReset()
  from.mockReset()
  requireUser.mockResolvedValue({ id: 'uid-1', email: 'wer@example.at' })
})

describe('Erfassen (AC-1, AC-4, AC-25)', () => {
  it('schreibt die Ausgabe und meldet den Monat zurück', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))

    const state = await createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))

    expect(state).toEqual({ status: 'saved', month: '2026-07', token: TOKEN })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('nimmt die Nutzer-ID aus der Sitzung, nie aus dem Formular', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))

    await createExpense(
      IDLE,
      form({ ...VALID, clientToken: TOKEN, user_id: 'fremde-id', userId: 'fremde-id' }),
    )

    expect(argOf(0, 'insert')?.[0]).toMatchObject({
      user_id: 'uid-1',
      amount_cents: 2900,
      category: 'software',
      spent_on: '2026-07-14',
      note: 'Hosting',
      client_token: TOKEN,
    })
  })

  it('speichert den Betrag in ganzen Cent', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))
    await createExpense(IDLE, form({ ...VALID, amount: '1.284,50', clientToken: TOKEN }))
    expect((argOf(0, 'insert')?.[0] as { amount_cents: number }).amount_cents).toBe(128450)
  })

  it('schreibt bei einem Feldfehler gar nichts', async () => {
    const state = await createExpense(IDLE, form({ ...VALID, amount: '0', clientToken: TOKEN }))

    expect(state.status).toBe('error')
    expect(state.fieldErrors?.amount).toBe('Der Betrag muss größer als 0 sein.')
    expect(from).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('meldet mehrere Feldfehler gleichzeitig, jeden an seinem Feld', async () => {
    const state = await createExpense(
      IDLE,
      form({ amount: 'abc', category: '', spentOn: '2999-01-01', note: '', clientToken: TOKEN }),
    )

    expect(state.fieldErrors).toEqual({
      amount: 'Bitte gib den Betrag als Zahl ein, zum Beispiel 24,90.',
      category: 'Bitte wähl eine Kategorie.',
      spentOn: 'Das Datum darf nicht in der Zukunft liegen.',
    })
  })

  it('macht aus dem zweiten Klick keinen Fehler, sondern einen Erfolg (EC-1)', async () => {
    from
      .mockReturnValueOnce(builder({ data: null, error: { code: '23505' } }))
      .mockReturnValueOnce(builder({ data: { spent_on: '2026-07-14' }, error: null }))

    const state = await createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))

    expect(state).toEqual({ status: 'saved', month: '2026-07', token: TOKEN })
    // Der Nachschlag sucht genau den einen Vorgang dieser Person.
    expect(callArgs(1).filter(([name]) => name === 'eq')).toEqual([
      ['eq', 'user_id', 'uid-1'],
      ['eq', 'client_token', TOKEN],
    ])
  })

  it('meldet einen echten Datenbankfehler formularweit (EC-4)', async () => {
    from.mockReturnValue(builder({ data: null, error: { code: '08006' } }))

    const state = await createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))

    expect(state.status).toBe('error')
    expect(state.formError).toBe(
      'Das Speichern hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal.',
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('prüft die Anmeldung, bevor irgendetwas geschrieben wird (EC-5)', async () => {
    requireUser.mockRejectedValue(new Error('redirect:/login'))

    await expect(createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))).rejects.toThrow(
      'redirect:/login',
    )
    expect(from).not.toHaveBeenCalled()
  })
})

describe('Ändern (AC-20, AC-21, AC-24, EC-2, EC-3)', () => {
  it('schreibt alle vier Felder in einer Anweisung, eingeschränkt auf die eigene Zeile', async () => {
    from.mockReturnValue(builder({ data: [{ spent_on: '2026-07-20' }], error: null }))

    const state = await updateExpense(
      IDLE,
      form({ ...VALID, spentOn: '2026-07-20', id: EXPENSE_ID }),
    )

    expect(argOf(0, 'update')?.[0]).toEqual({
      amount_cents: 2900,
      category: 'software',
      spent_on: '2026-07-20',
      note: 'Hosting',
    })
    expect(callArgs(0).filter(([name]) => name === 'eq')).toEqual([
      ['eq', 'id', EXPENSE_ID],
      ['eq', 'user_id', 'uid-1'],
    ])
    expect(state).toEqual({ status: 'saved', month: '2026-07', token: EXPENSE_ID })
  })

  it('legt bei null betroffenen Zeilen nichts an — kein Upsert (EC-2)', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))

    const state = await updateExpense(IDLE, form({ ...VALID, id: EXPENSE_ID }))

    expect(state.status).toBe('error')
    expect(state.formError).toBe('Diese Ausgabe gibt es nicht mehr.')
    expect(callArgs(0).some(([name]) => name === 'insert')).toBe(false)
    // Der hängende Tab kommt trotzdem auf Stand.
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('sagt bei einer fremden Ausgabe dasselbe wie bei einer gelöschten', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))
    const state = await updateExpense(IDLE, form({ ...VALID, id: EXPENSE_ID }))
    expect(state.formError).toBe('Diese Ausgabe gibt es nicht mehr.')
  })

  it('wendet dieselben Feldregeln an wie das Erfassen (AC-21)', async () => {
    const state = await updateExpense(
      IDLE,
      form({ ...VALID, note: 'x'.repeat(201), id: EXPENSE_ID }),
    )

    expect(state.fieldErrors?.note).toBe('Die Notiz darf höchstens 200 Zeichen haben.')
    expect(from).not.toHaveBeenCalled()
  })

  it('meldet den neuen Monat, wenn die Änderung die Ausgabe verschiebt (EC-11)', async () => {
    from.mockReturnValue(builder({ data: [{ spent_on: '2026-06-02' }], error: null }))
    const state = await updateExpense(
      IDLE,
      form({ ...VALID, spentOn: '2026-06-02', id: EXPENSE_ID }),
    )
    expect(state.month).toBe('2026-06')
  })
})

describe('Löschen (AC-23, AC-24, EC-2)', () => {
  it('löscht nur die eigene Zeile und meldet den Monat', async () => {
    from.mockReturnValue(builder({ data: [{ spent_on: '2026-07-14' }], error: null }))

    const state = await deleteExpense(IDLE, form({ id: EXPENSE_ID }))

    expect(callArgs(0).filter(([name]) => name === 'eq')).toEqual([
      ['eq', 'id', EXPENSE_ID],
      ['eq', 'user_id', 'uid-1'],
    ])
    expect(state).toEqual({ status: 'saved', month: '2026-07', token: EXPENSE_ID })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('meldet eine bereits gelöschte Ausgabe verständlich (EC-2)', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))
    const state = await deleteExpense(IDLE, form({ id: EXPENSE_ID }))
    expect(state.formError).toBe('Diese Ausgabe gibt es nicht mehr.')
  })

  it('prüft die Anmeldung zuerst', async () => {
    requireUser.mockRejectedValue(new Error('redirect:/login'))
    await expect(deleteExpense(IDLE, form({ id: EXPENSE_ID }))).rejects.toThrow('redirect:/login')
    expect(from).not.toHaveBeenCalled()
  })
})
