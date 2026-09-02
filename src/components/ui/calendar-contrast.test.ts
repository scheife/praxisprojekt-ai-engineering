import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Der Kontrastboden im Kalender — `docs/design-system.md`, Abschnitt Farben.
 * Angelegt für BUG-14 am 02.09.2026.
 *
 * Dort steht: „**Der Kontrastboden liegt bei `--muted-foreground`.** Das Quellsystem nutzt für
 * Meta-Text Alpha `.34–.45`; auf `#080807` ergibt `.44` nur 4,07:1 und `.34` nur 3,1:1 — beides
 * unter 4,5:1."
 *
 * `shadcn add calendar` liefert die gesperrten Tage als `text-muted-foreground opacity-50`. Das
 * ist genau der Fehler, den der Boden verhindern soll, nur eine Ebene höher: Nicht die Farbe ist
 * zu schwach, sondern die Deckkraft darüber. Gerechnet auf `--popover` (HSL 60 3% 6.5%):
 *
 * | Zustand                              | Kontrast |
 * |--------------------------------------|----------|
 * | aktiver Tag (`--popover-foreground`) | 17,27:1  |
 * | `--muted-foreground` allein          |  4,97:1  |
 * | `--muted-foreground` + `opacity-50`  |  2,13:1  |
 *
 * Ein gesperrter Tag soll **erkennbar** gesperrt sein, nicht unlesbar. Die Unterscheidung trägt
 * die Helligkeit: 4,97:1 gegen 17,27:1 ist das 3,5-fache, das sieht man auf einen Blick.
 *
 * **Warum am Quelltext:** `shadcn add` überschreibt die Datei und bringt `opacity-50` lautlos
 * zurück. Ein Screenshot-Vergleich fiele auf; ein Test fällt zuverlässig.
 */

const CALENDAR = join(process.cwd(), 'src/components/ui/calendar.tsx')

/** Nur die Zuweisung an `disabled:` — die Pfeil-Icons der Navigation sind nicht gemeint. */
function disabledDayClasses(source: string): string {
  const match = source.match(/\n\s*disabled:\s*cn\(([\s\S]*?)\),\n/)
  if (!match) throw new Error('Die `disabled`-Zuweisung in calendar.tsx wurde nicht gefunden.')
  return match[1]
}

describe('Kalender — gesperrte Tage bleiben lesbar (BUG-14)', () => {
  const source = readFileSync(CALENDAR, 'utf8')

  it('trägt den Kontrastboden `text-muted-foreground`', () => {
    expect(disabledDayClasses(source)).toContain('text-muted-foreground')
  })

  it('schwächt ihn nicht zusätzlich mit `opacity-`', () => {
    // 2,13:1 statt 4,97:1 — das ist der Zustand, in dem der Kalender ausgeliefert wurde.
    expect(disabledDayClasses(source)).not.toMatch(/\bopacity-\d+/)
  })
})
