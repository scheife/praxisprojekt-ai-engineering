import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Die Leseseite — geprüft wird, **womit** gefragt wird, nicht was die Datenbank antwortet.
 *
 * Die Zugehörigkeitsbedingung im Anwendungscode ist die zweite Hälfte von AC-25 (die erste ist
 * Row Level Security, AC-24). Sie ist genau die Art Bedingung, die beim Umbauen still
 * verschwindet, ohne dass ein einziger Ablauf kaputtgeht — bis jemand fremde Zeilen sieht.
 * Deshalb steht sie hier als Zusicherung.
 */

const from = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from }) }))

const { listMonth, oldestMonth, listAll } = await import('./queries')

type Result = { data: unknown; error: unknown }

function builder(result: Result) {
  const calls: [string, ...unknown[]][] = []
  const self: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) {
    self[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return self
    }
  }
  self.maybeSingle = async () => result
  self.then = (ok: (r: Result) => unknown, no?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, no)
  self.calls = calls
  return self as typeof self & { calls: [string, ...unknown[]][] }
}

function calls() {
  return (from.mock.results[0].value as { calls: [string, ...unknown[]][] }).calls
}

beforeEach(() => from.mockReset())

describe('Monat lesen (AC-11, AC-24, AC-25, EC-9)', () => {
  it('fragt nur die eigenen Zeilen und nur den angefragten Monat', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))

    await listMonth('uid-1', '2026-02')

    expect(calls()).toContainEqual(['eq', 'user_id', 'uid-1'])
    expect(calls()).toContainEqual(['gte', 'spent_on', '2026-02-01'])
    // Februar 2026 hat 28 Tage — die Grenze wird gerechnet, nicht geraten.
    expect(calls()).toContainEqual(['lte', 'spent_on', '2026-02-28'])
  })

  it('kennt den letzten Tag auch im Schaltjahr', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))
    await listMonth('uid-1', '2028-02')
    expect(calls()).toContainEqual(['lte', 'spent_on', '2028-02-29'])
  })

  it('sortiert absteigend nach Datum, bei gleichem Datum die zuletzt erfasste zuerst (AC-11)', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))
    await listMonth('uid-1', '2026-08')

    const order = calls().filter(([name]) => name === 'order')
    expect(order).toEqual([
      ['order', 'spent_on', { ascending: false }],
      ['order', 'created_at', { ascending: false }],
    ])
  })

  it('holt keine Seitenblätterung und keine Obergrenze — der Monat kommt vollständig (EC-9)', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))
    await listMonth('uid-1', '2026-08')
    expect(calls().some(([name]) => name === 'limit')).toBe(false)
  })

  it('reicht einen Datenbankfehler weiter, statt eine leere Liste vorzutäuschen', async () => {
    from.mockReturnValue(builder({ data: null, error: { code: '08006' } }))
    await expect(listMonth('uid-1', '2026-08')).rejects.toEqual({ code: '08006' })
  })
})

describe('Ältesten Monat lesen (AC-18, EC-8)', () => {
  it('fragt aufsteigend nach der eigenen ersten Zeile', async () => {
    from.mockReturnValue(builder({ data: { spent_on: '2026-06-15' }, error: null }))

    expect(await oldestMonth('uid-1')).toBe('2026-06')
    expect(calls()).toContainEqual(['eq', 'user_id', 'uid-1'])
    expect(calls()).toContainEqual(['order', 'spent_on', { ascending: true }])
    expect(calls()).toContainEqual(['limit', 1])
  })

  it('liefert null, wenn es keine eigene Ausgabe gibt', async () => {
    from.mockReturnValue(builder({ data: null, error: null }))
    expect(await oldestMonth('uid-1')).toBeNull()
  })
})

describe('Alles lesen für den Export (AC-27)', () => {
  it('schränkt auf die eigene Person ein, aber auf keinen Monat', async () => {
    from.mockReturnValue(builder({ data: [], error: null }))

    await listAll('uid-1')

    expect(calls()).toContainEqual(['eq', 'user_id', 'uid-1'])
    // Kein Datumsfilter: Art. 15 DSGVO verlangt Auskunft über alles, nicht über den
    // gerade angezeigten Monat.
    expect(calls().some(([name]) => name === 'gte' || name === 'lte')).toBe(false)
  })
})
