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
// Der Abruf wird ersetzt, die **Umrechnung nicht**: So läuft in diesen Tests die echte
// Division samt Rundung mit, und nur der Gang ins Netz ist gestellt.
const fetchRate = vi.fn()
vi.mock('@/lib/expenses/rate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/expenses/rate')>()),
  fetchRate: (...args: unknown[]) => fetchRate(...args),
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
  fetchRate.mockReset()
  requireUser.mockResolvedValue({ state: 'signed-in', user: { id: 'uid-1', email: 'wer@example.at' } })
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

    // Seit PROJ-3 gehen Währung, Originalbetrag und die beiden Kursfelder in derselben
    // Anweisung mit — weiterhin in **einer**, damit sich zwei Stände nicht mischen können
    // (EC-3 hier, EC-7 in PROJ-3). Bei Euro bleiben die Kursfelder leer.
    expect(argOf(0, 'update')?.[0]).toEqual({
      amount_cents: 2900,
      amount_original: 2900,
      currency: 'EUR',
      rate_per_eur: null,
      rate_date: null,
      category: 'software',
      spent_on: '2026-07-20',
      note: 'Hosting',
    })
    // Seit PROJ-3 sind es **zwei** Anweisungen: erst wird der gespeicherte Stand gelesen (nur
    // er sagt, ob Währung oder Datum sich bewegt haben — design.md TD-10), dann geschrieben.
    // Entscheidend ist, dass **beide** auf die eigene Zeile eingeschränkt sind (AC-24) und die
    // Nutzer-ID in beiden aus der Sitzung stammt, nie aus dem Formular (AC-25).
    expect(callArgs(0).filter(([name]) => name === 'eq')).toEqual([
      ['eq', 'id', EXPENSE_ID],
      ['eq', 'user_id', 'uid-1'],
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

/**
 * Der Erfassungspfad mit Währung (PROJ-3, AC-2, AC-3, AC-5, TD-13) — ergänzt von `/qa`.
 *
 * Die Zusicherung, die AC-2 ausmacht, hatte noch keinen Test: Eine **Euro**-Ausgabe darf den
 * fremden Dienst gar nicht erst behelligen. Sie ist mehr als eine Sparmaßnahme — sie ist der
 * Grund, warum ein Ausfall des Kursdienstes die Euro-Erfassung nicht mitreißt.
 */
describe('Erfassen mit Währung (PROJ-3, AC-2, AC-3, AC-5)', () => {
  it('ruft bei EUR keinen Kurs ab (AC-2)', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))

    const state = await createExpense(
      IDLE,
      form({ ...VALID, currency: 'EUR', clientToken: TOKEN }),
    )

    expect(fetchRate).not.toHaveBeenCalled()
    expect(state.status).toBe('saved')
    expect(argOf(0, 'insert')?.[0]).toMatchObject({
      currency: 'EUR',
      amount_cents: 2900,
      amount_original: 2900,
      rate_per_eur: null,
      rate_date: null,
    })
  })

  it('ruft auch bei fehlendem Währungsfeld keinen Kurs ab (EC-8)', async () => {
    // Ein Formular aus PROJ-2 schickt kein `currency` mit. Es muss unverändert funktionieren.
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))

    await createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))

    expect(fetchRate).not.toHaveBeenCalled()
    expect(argOf(0, 'insert')?.[0]).toMatchObject({ currency: 'EUR' })
  })

  it('holt bei Fremdwährung den Kurs zum AUSGABEDATUM und friert ihn ein (AC-3, AC-4)', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-07-14' }, error: null }))
    // Der Dienst antwortet mit einem anderen Tag als angefragt — gespeichert wird seiner.
    fetchRate.mockResolvedValue({ state: 'ok', ratePerEur: 1.1567, rateDate: '2026-07-10' })

    await createExpense(
      IDLE,
      form({ ...VALID, currency: 'USD', spentOn: '2026-07-12', clientToken: TOKEN }),
    )

    expect(fetchRate).toHaveBeenCalledWith('USD', '2026-07-12')
    expect(argOf(0, 'insert')?.[0]).toMatchObject({
      currency: 'USD',
      amount_original: 2900,
      amount_cents: 2507, // 29,00 USD / 1,1567
      rate_per_eur: 1.1567,
      rate_date: '2026-07-10',
    })
  })

  it('schreibt GAR NICHTS, wenn der Kurs nicht zu holen ist (AC-5)', async () => {
    fetchRate.mockResolvedValue({ state: 'unavailable' })

    const state = await createExpense(
      IDLE,
      form({ ...VALID, currency: 'USD', clientToken: TOKEN }),
    )

    expect(state.status).toBe('error')
    expect(state.formError).toContain('Wechselkurs ist gerade nicht abrufbar')
    // Kein einziger Zugriff auf die Tabelle — die Reihenfolge aus TD-13 hält.
    expect(from).not.toHaveBeenCalled()
  })

  it('prüft die Eingaberegeln VOR dem Kursabruf (TD-13)', async () => {
    // Ein unlesbarer Betrag darf keinen Aufruf des fremden Dienstes auslösen.
    const state = await createExpense(
      IDLE,
      form({ ...VALID, amount: 'zwölf', currency: 'USD', clientToken: TOKEN }),
    )

    expect(state.status).toBe('error')
    expect(fetchRate).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

/**
 * Die Verzweigung beim Ändern (PROJ-3, AC-12 bis AC-16).
 *
 * Der Kurs hängt an genau zwei Angaben — Währung und Datum. Diese Tests halten fest, wann er
 * neu geholt wird und wann **ausdrücklich nicht**: Ein Neuabruf bei jeder Änderung ließe eine
 * Notizkorrektur an einem fremden Dienst scheitern, gar kein Neuabruf hinterließe nach einer
 * Datumskorrektur eine Zeile mit widersprüchlichem Kursdatum.
 */
describe('Ändern mit Währung (PROJ-3, AC-12 bis AC-16)', () => {
  /** Der gespeicherte Stand, den die Action zuerst liest — dann das Ergebnis des Schreibens. */
  function bestand(row: Record<string, unknown>) {
    from.mockReturnValueOnce(builder({ data: row, error: null }))
    from.mockReturnValueOnce(builder({ data: [{ spent_on: '2026-07-14' }], error: null }))
  }

  const USD_BESTAND = {
    currency: 'USD',
    spent_on: '2026-07-14',
    rate_per_eur: 1.1593,
    rate_date: '2026-07-14',
  }

  /** Die Felder, die tatsächlich geschrieben wurden. */
  const geschrieben = () => argOf(1, 'update')?.[0] as Record<string, unknown>

  it('holt einen neuen Kurs, wenn die WÄHRUNG sich ändert (AC-12)', async () => {
    bestand(USD_BESTAND)
    fetchRate.mockResolvedValue({ state: 'ok', ratePerEur: 0.9364, rateDate: '2026-07-14' })

    await updateExpense(IDLE, form({ ...VALID, currency: 'CHF', id: EXPENSE_ID }))

    expect(fetchRate).toHaveBeenCalledWith('CHF', '2026-07-14')
    expect(geschrieben()).toMatchObject({
      currency: 'CHF',
      rate_per_eur: 0.9364,
      amount_original: 2900,
      amount_cents: 3097, // 29,00 CHF / 0,9364
    })
  })

  it('holt einen neuen Kurs, wenn das DATUM sich ändert (AC-12)', async () => {
    bestand(USD_BESTAND)
    fetchRate.mockResolvedValue({ state: 'ok', ratePerEur: 1.1567, rateDate: '2026-07-10' })

    await updateExpense(IDLE, form({ ...VALID, currency: 'USD', spentOn: '2026-07-11', id: EXPENSE_ID }))

    expect(fetchRate).toHaveBeenCalledWith('USD', '2026-07-11')
    expect(geschrieben()).toMatchObject({ rate_per_eur: 1.1567, rate_date: '2026-07-10' })
  })

  it('holt NICHTS, wenn nur der Betrag sich ändert — rechnet aber neu (AC-13)', async () => {
    // Eine korrigierte Rechnungssumme darf den historischen Kurs nicht verschieben.
    bestand(USD_BESTAND)

    await updateExpense(
      IDLE,
      form({ ...VALID, amount: '58,00', currency: 'USD', id: EXPENSE_ID }),
    )

    expect(fetchRate).not.toHaveBeenCalled()
    expect(geschrieben()).toMatchObject({
      rate_per_eur: 1.1593,
      rate_date: '2026-07-14',
      amount_original: 5800,
      amount_cents: 5003, // 58,00 USD / 1,1593
    })
  })

  it('holt NICHTS, wenn nur die Notiz sich ändert (AC-14)', async () => {
    // Sonst scheiterte eine Tippfehlerkorrektur an der Erreichbarkeit eines fremden Dienstes.
    bestand(USD_BESTAND)

    await updateExpense(
      IDLE,
      form({ ...VALID, note: 'Tippfehler behoben', currency: 'USD', id: EXPENSE_ID }),
    )

    expect(fetchRate).not.toHaveBeenCalled()
    expect(geschrieben()).toMatchObject({ rate_per_eur: 1.1593, note: 'Tippfehler behoben' })
  })

  it('entfernt Kurs und Kursdatum bei der Umstellung auf EUR (AC-16)', async () => {
    bestand(USD_BESTAND)

    await updateExpense(IDLE, form({ ...VALID, currency: 'EUR', id: EXPENSE_ID }))

    expect(fetchRate).not.toHaveBeenCalled()
    expect(geschrieben()).toMatchObject({
      currency: 'EUR',
      rate_per_eur: null,
      rate_date: null,
      amount_cents: 2900,
      amount_original: 2900,
    })
  })

  it('schreibt GAR NICHT, wenn der nötige Neuabruf scheitert (AC-15)', async () => {
    // Die gespeicherte Zeile bleibt vollständig unverändert — bis hierher wurde nichts
    // geschrieben, und es soll auch nichts geschrieben werden.
    bestand(USD_BESTAND)
    fetchRate.mockResolvedValue({ state: 'unavailable' })

    const state = await updateExpense(
      IDLE,
      form({ ...VALID, currency: 'CHF', id: EXPENSE_ID }),
    )

    expect(state.status).toBe('error')
    expect(state.formError).toContain('Wechselkurs ist gerade nicht abrufbar')
    // Nur der Lesevorgang, keine zweite Anweisung.
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('nennt bei fehlendem Kurs für den Tag die dauerhafte Ursache (EC-4)', async () => {
    bestand(USD_BESTAND)
    fetchRate.mockResolvedValue({ state: 'no-rate-for-date' })

    const state = await updateExpense(
      IDLE,
      form({ ...VALID, currency: 'BRL', spentOn: '2000-01-03', id: EXPENSE_ID }),
    )

    expect(state.formError).toContain('Brasilianischer Real')
    expect(state.formError).toContain('03.01.2000')
    // Kein behaupteter Ausfall — sonst versucht es jemand in zehn Minuten wieder.
    expect(state.formError).not.toContain('nicht abrufbar')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('meldet eine fremde oder gelöschte Ausgabe, ohne den Kursdienst zu behelligen', async () => {
    from.mockReturnValueOnce(builder({ data: null, error: null }))

    const state = await updateExpense(IDLE, form({ ...VALID, currency: 'USD', id: EXPENSE_ID }))

    expect(state.formError).toBe('Diese Ausgabe gibt es nicht mehr.')
    expect(fetchRate).not.toHaveBeenCalled()
    expect(from).toHaveBeenCalledTimes(1)
  })
})

describe('Wenn die Anmeldung nicht feststellbar ist (EC-4, EC-12)', () => {
  const NICHT_ERREICHBAR = { state: 'unavailable' as const }
  const MELDUNG =
    'Wir erreichen deine Daten gerade nicht. Das liegt nicht an dir — versuch es in einem Moment noch einmal.'

  it('erfasst nichts und sagt, dass es nicht an der Eingabe liegt', async () => {
    requireUser.mockResolvedValue(NICHT_ERREICHBAR)

    const state = await createExpense(IDLE, form({ ...VALID, clientToken: TOKEN }))

    expect(state).toEqual({ status: 'error', formError: MELDUNG })
    // **Nichts geschrieben, nichts abgerufen.** Ohne feststellbare Anmeldung gibt es keine
    // Person, der eine Zeile gehören könnte — und keinen Grund, einen fremden Dienst zu rufen.
    expect(from).not.toHaveBeenCalled()
    expect(fetchRate).not.toHaveBeenCalled()
  })

  it('ändert nichts', async () => {
    requireUser.mockResolvedValue(NICHT_ERREICHBAR)

    const state = await updateExpense(IDLE, form({ ...VALID, id: EXPENSE_ID }))

    expect(state).toEqual({ status: 'error', formError: MELDUNG })
    expect(from).not.toHaveBeenCalled()
  })

  it('löscht nichts', async () => {
    requireUser.mockResolvedValue(NICHT_ERREICHBAR)

    const state = await deleteExpense(IDLE, form({ id: EXPENSE_ID }))

    expect(state).toEqual({ status: 'error', formError: MELDUNG })
    expect(from).not.toHaveBeenCalled()
  })
})
