import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `GET /konto/export` — die Verzweigungen, nicht die CSV-Erzeugung.
 *
 * Den Inhalt der Datei prüft `csv.test.ts`. Hier geht es um die **Antworten**, die die Route
 * gibt, wenn etwas nicht geht — und besonders um den 503-Weg: Er trägt einen der vier Sätze,
 * die EC-13 gemeinsam halten muss, und hatte bis zum QA-Lauf vom 02.09.2026 **keine einzige
 * Zusicherung**. Eine Route ohne Testdatei ist der bequemste Ort, um unbemerkt wieder einen
 * eigenen Satz hinzuschreiben.
 */

const requireUser = vi.fn()
const from = vi.fn()
const listAll = vi.fn()

vi.mock('@/lib/auth', () => ({ requireUser: () => requireUser() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from }) }))
vi.mock('@/lib/expenses/queries', () => ({ listAll: (...a: unknown[]) => listAll(...a) }))

const { GET } = await import('./route')
const { TIMEOUT_MESSAGE, DEADLINE_MS } = await import('@/lib/supabase/deadline')

/** Ein Nichterreichen, so wie `deadlineFetch` es wirft. */
const nichtErreichbar = () => new Error(`auslage/unreachable: TimeoutError ${DEADLINE_MS}`)

const profilZeile = () => ({
  select: () => ({
    eq: () => ({ maybeSingle: async () => ({ data: { created_at: '2026-08-01' }, error: null }) }),
  }),
})

beforeEach(() => {
  requireUser.mockReset()
  from.mockReset()
  listAll.mockReset()
  requireUser.mockResolvedValue({
    state: 'signed-in',
    user: { id: 'uid-1', email: 'wer@example.com', created_at: '2026-08-01' },
  })
  from.mockImplementation(profilZeile)
  listAll.mockResolvedValue([])
})

describe('Der Export im Normalfall (AC-27)', () => {
  it('liefert eine CSV-Datei zum Herunterladen', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/)
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="auslage-export-/)
  })

  it('legt die Datei nirgends ab — sie darf nicht zwischengespeichert werden', async () => {
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/)
  })
})

describe('Wenn der Datenzugriff in die Frist läuft (EC-4, EC-12, EC-13)', () => {
  it('antwortet mit 503, wenn schon die Anmeldung nicht feststellbar ist', async () => {
    requireUser.mockResolvedValue({ state: 'unavailable' })
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.text()).toContain(TIMEOUT_MESSAGE)
  })

  it('antwortet mit 503, wenn erst das Lesen der Ausgaben scheitert', async () => {
    // Der Fall, den BUG-4 zutage gefördert hat: Die Sitzung steht, der Datenzugriff nicht.
    listAll.mockRejectedValue(nichtErreichbar())
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.text()).toContain(TIMEOUT_MESSAGE)
  })

  it('nimmt den Satz aus der gemeinsamen Quelle und behauptet keine Ursache (EC-13)', async () => {
    requireUser.mockResolvedValue({ state: 'unavailable' })
    const text = await (await GET()).text()
    expect(text).not.toMatch(/erreich|Datenbank|Verbindung|Netzwerk|nichts gespeichert/i)
    expect(text).toMatch(/zu lange gedauert/)
  })

  it('gibt keine halbe Datei aus — bei 503 ist nichts vom Export drin', async () => {
    requireUser.mockResolvedValue({ state: 'unavailable' })
    const res = await GET()
    expect(res.headers.get('Content-Type')).toMatch(/text\/plain/)
    expect(await res.text()).not.toContain('Datum;Kategorie')
  })
})

describe('Ein echter Fehler bleibt ein Fehler', () => {
  it('verschweigt einen Programmfehler NICHT als Zeitüberschreitung', async () => {
    // Sonst verschwindet jeder Defekt hinter „versuch es später noch einmal" — dieselbe falsche
    // Behauptung, gegen die EC-13 geschrieben wurde, nur in die andere Richtung.
    listAll.mockRejectedValue(new TypeError('undefined is not a function'))
    await expect(GET()).rejects.toThrow('undefined is not a function')
  })
})
