import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

import { MonthView } from '@/components/expenses/month-view'
import { TimeoutNotice } from '@/components/shell/timeout-notice'
import { MonthPanel } from '@/components/expenses/month-panel'

const listMonth = vi.fn()
const oldestMonth = vi.fn()

vi.mock('@/lib/expenses/queries', () => ({
  listMonth: (...a: unknown[]) => listMonth(...a),
  oldestMonth: (...a: unknown[]) => oldestMonth(...a),
}))

/**
 * Sucht im zurückgegebenen Elementbaum nach einer Komponente.
 *
 * `MonthView` ist eine Server-Komponente — eine `async` Funktion, die einen Baum liefert. Sie
 * lässt sich damit direkt aufrufen und untersuchen, ohne sie zu rendern; das erspart einen
 * Router-Kontext für die Client-Komponenten darin.
 */
function enthaelt(node: unknown, gesucht: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((n) => enthaelt(n, gesucht))
  const el = node as ReactElement<{ children?: unknown }>
  if (el.type === gesucht) return true
  return enthaelt(el.props?.children, gesucht)
}

const NICHT_ERREICHBAR = new Error('auslage/unreachable: TimeoutError')

beforeEach(() => {
  listMonth.mockReset()
  oldestMonth.mockReset()
})

describe('Der Lesepfad, wenn der Datenzugriff nicht antwortet (EC-4, BUG-4)', () => {
  it('zeigt den Nicht-erreichbar-Zustand statt zu werfen', async () => {
    // Ohne dieses Abfangen warf `queries.ts` weiter, niemand fing es, und die Person sah
    // dauerhaft das Ladegerüst — sichtbarer Text der ganzen Seite: „auslage."
    listMonth.mockRejectedValue(NICHT_ERREICHBAR)
    oldestMonth.mockRejectedValue(NICHT_ERREICHBAR)

    const baum = await MonthView({ userId: 'uid-1', month: '2026-08' })

    expect(enthaelt(baum, TimeoutNotice)).toBe(true)
    expect(enthaelt(baum, MonthPanel)).toBe(false)
  })

  it('greift auch, wenn nur die Monatsabfrage scheitert', async () => {
    listMonth.mockRejectedValue(NICHT_ERREICHBAR)
    oldestMonth.mockResolvedValue('2026-01')

    expect(enthaelt(await MonthView({ userId: 'uid-1', month: '2026-08' }), TimeoutNotice)).toBe(true)
  })

  it('reicht jeden ANDEREN Fehler weiter, statt ihn als Nichterreichen auszugeben', async () => {
    // Der Gegenpol zu EC-12: Ein Fehler, der etwas anderes bedeutet, darf nicht als „gerade
    // nicht erreichbar" erscheinen. Das wäre dieselbe falsche Behauptung, nur andersherum.
    listMonth.mockRejectedValue({ code: '42501', message: 'permission denied for table expenses' })
    oldestMonth.mockResolvedValue(null)

    await expect(MonthView({ userId: 'uid-1', month: '2026-08' })).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('zeigt im Normalfall die Monatsansicht', async () => {
    listMonth.mockResolvedValue([])
    oldestMonth.mockResolvedValue('2026-08')

    const baum = await MonthView({ userId: 'uid-1', month: '2026-08' })

    expect(enthaelt(baum, MonthPanel)).toBe(true)
    expect(enthaelt(baum, TimeoutNotice)).toBe(false)
  })
})

describe('Das Zeitbudget der Anfrage (EC-4)', () => {
  it('startet beide Abfragen, bevor die erste geantwortet hat', async () => {
    /**
     * **Diese Zusicherung trägt die Gesamtgrenze aus EC-4** (`design.md` → *Das Zeitbudget einer
     * Anfrage*). Die Rechnung dort zählt die Abfragen der Monatsansicht als **eine** Wartestation,
     * weil sie parallel laufen. Würde jemand die zweite hinter die erste hängen — die häufigste
     * Art, versehentlich eine dritte Wartestation einzubauen —, würden aus 2 Sekunden Wartezeit 4,
     * und die 5-Sekunden-Zusage kippte auf dem POST-Weg.
     *
     * Geprüft wird die **Reihenfolge**, nicht die Uhrzeit: Die erste Abfrage bleibt absichtlich
     * offen. Läuft es parallel, ist die zweite trotzdem schon gestartet. Liefe es nacheinander,
     * wäre sie noch nicht einmal aufgerufen worden.
     */
    let ersteAufloesen: ((zeilen: never[]) => void) | undefined
    listMonth.mockReturnValue(
      new Promise((aufloesen) => {
        ersteAufloesen = aufloesen as (zeilen: never[]) => void
      }),
    )
    oldestMonth.mockResolvedValue('2026-08')

    const laeuft = MonthView({ userId: 'uid-1', month: '2026-08' })
    await Promise.resolve()

    expect(oldestMonth).toHaveBeenCalled()

    ersteAufloesen?.([])
    await laeuft
  })
})
