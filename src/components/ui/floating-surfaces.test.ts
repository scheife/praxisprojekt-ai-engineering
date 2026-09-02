import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Schwebende Flächen folgen `docs/design-system.md` — Erhebung (§6.1) **und** Fläche (§3.2).
 * Angelegt für BUG-13, erweitert um die Flächenfarben am 02.09.2026.
 *
 * Dort steht: „Keine Schatten im Flächenlayout. Hierarchie entsteht über Alpha-Rahmen und
 * Flächenhelligkeit. **Elevation nur für echt Schwebendes:** Dialog `0 30px 80px rgba(0,0,0,.55)`,
 * Toast `0 14px 40px rgba(0,0,0,.55)`."
 *
 * Beide Werte stehen als Token in `globals.css`. Diese Prüfung hält fest, dass die schwebenden
 * Bausteine sie **benutzen** — und nicht Tailwinds Standardschatten, mit denen sie von
 * `shadcn add` kommen. Der Unterschied ist auf dieser Oberfläche nicht kosmetisch: `shadow-md`
 * ist `rgba(0,0,0,.1)`, ein zu 90 % durchsichtiges Schwarz. Auf einem Grund von HSL 60 6.7% 2.9%
 * ist das schlicht unsichtbar — der Kalender lag ohne jede Kante über der Ausgabenliste.
 *
 * **Warum am Quelltext:** Jede Neuerzeugung über `shadcn add` bringt den Standardschatten zurück,
 * und zwar lautlos. Ein Screenshot-Vergleich fiele auf; ein Test fällt zuverlässig.
 */

const UI = join(process.cwd(), 'src/components/ui')

/** Was Tailwind an fertigen Schatten mitbringt — auf schwebenden Flächen alles zu schwach. */
const TAILWIND_STANDARD = /shadow-(2xs|xs|sm|md|lg|xl|2xl)\b/g

/**
 * Die Bausteine, die nach §6.1 „echt Schwebendes" sind, mit dem Token, der ihnen zusteht.
 * `toast.tsx` ist derzeit nicht eingebunden (der Toaster im Layout ist Sonner) — es steht
 * trotzdem hier, damit es nicht abweicht, falls es je benutzt wird.
 */
const SCHWEBEND: Record<string, string> = {
  'popover.tsx': 'shadow-float',
  'select.tsx': 'shadow-float',
  'dropdown-menu.tsx': 'shadow-float',
  'sonner.tsx': '--shadow-float',
  'toast.tsx': 'shadow-float',
  'dialog.tsx': 'shadow-dialog',
  'alert-dialog.tsx': 'shadow-dialog',
}

describe('Elevation folgt dem Design System (§6.1)', () => {
  for (const [datei, token] of Object.entries(SCHWEBEND)) {
    it(`${datei} benutzt ${token}`, () => {
      expect(readFileSync(join(UI, datei), 'utf8')).toContain(token)
    })

    it(`${datei} trägt keinen Tailwind-Standardschatten mehr`, () => {
      const funde = readFileSync(join(UI, datei), 'utf8').match(TAILWIND_STANDARD) ?? []
      expect(
        funde,
        `${datei} soll ${token} benutzen. Tailwinds Standardschatten sind auf diesem dunklen ` +
          `Grund unsichtbar (rgba(0,0,0,.1) auf HSL 60 6.7% 2.9%).`,
      ).toEqual([])
    })
  }

  it('kennt die beiden Werte aus §6.1 wörtlich', () => {
    // Ändert jemand den Token, soll er es bewusst tun — und dabei das Design System mitziehen.
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    expect(css).toContain('--shadow-float: 0 14px 40px rgba(0, 0, 0, 0.55)')
    expect(css).toContain('--shadow-dialog: 0 30px 80px rgba(0, 0, 0, 0.55)')
  })
})

/**
 * §3.2 der Tabelle „Flächen und Text" weist `--popover` (`#111110`) ausdrücklich
 * **„Dialoge, Dropdowns, Toast"** zu. Alles, was schwebt, teilt sich also **eine** Fläche.
 *
 * **Warum das mehr ist als Geschmack:** Die Staffelung des Produkts ist Seite `#080807` →
 * Karte `#0d0d0b` → Schwebendes `#111110`. Sie wird von unten nach oben heller, und daran
 * erkennt man ohne nachzudenken, was über was liegt. Der Toast war `rgb(0,0,0)` — **dunkler
 * als die Seite**, über der er schwebte. Die Staffelung stand auf dem Kopf, und der Toast las
 * sich wie ein Loch statt wie eine Karte darüber.
 */
describe('Schwebende Flächen benutzen --popover (§3.2)', () => {
  const KLASSENBASIERT = ['popover.tsx', 'select.tsx', 'dropdown-menu.tsx', 'dialog.tsx', 'alert-dialog.tsx']

  /**
   * `z-50` markiert in diesen Bausteinen die **schwebende Ebene**. Geprüft wird nur sie — und
   * das ist der Grund: `select.tsx` enthält auch den Auslöser, ein gewöhnliches Formularfeld,
   * das zu Recht nicht auf `--popover` liegt. Eine Prüfung über die ganze Datei hätte ihn
   * mitgemeint und wäre am falschen Ort rot geworden.
   */
  for (const datei of KLASSENBASIERT) {
    it(`${datei} legt seine schwebende Ebene auf bg-popover`, () => {
      const zeilen = readFileSync(join(UI, datei), 'utf8').split('\n')
      const schwebend = zeilen.filter((z) => z.includes('z-50'))
      expect(schwebend.length, 'keine schwebende Ebene gefunden').toBeGreaterThan(0)

      // `bg-background` wäre die Seitenfläche — dann läge das Schwebende auf der Höhe des
      // Untergrunds, und nur der Rahmen hielte es noch auseinander.
      const aufSeitenflaeche = schwebend.filter((z) => z.includes('bg-background'))
      expect(aufSeitenflaeche, `${datei}: schwebende Ebene auf bg-background`).toEqual([])

      // Der Abdunkler hinter einem Dialog (`bg-black/80`) trägt keine Fläche — deshalb wird
      // nicht jede z-50-Zeile geprüft, sondern nur verlangt, dass es die Fläche überhaupt gibt.
      expect(schwebend.some((z) => z.includes('bg-popover'))).toBe(true)
    })
  }

  it('sonner.tsx setzt Fläche, Text und Rahmen über den Inline-Stil', () => {
    // Über Klassen geht es dort nicht: Sonners eigenes Stylesheet hat die höhere Spezifität
    // (siehe die Begründung in der Datei). Eine Klasse, die nichts bewirkt, ist schlimmer als
    // keine — sie sieht im Quelltext nach einer Entscheidung aus.
    const quelle = readFileSync(join(UI, 'sonner.tsx'), 'utf8')
    expect(quelle).toContain('hsl(var(--popover))')
    expect(quelle).toContain('hsl(var(--popover-foreground))')
    expect(quelle).not.toContain('group-[.toaster]:bg-background')
  })

  it('hält die Staffelung fest: Seite dunkler als Karte, Karte dunkler als Schwebendes', () => {
    // Aus den Tripeln in globals.css, damit ein Umfärben nicht unbemerkt die Reihenfolge dreht.
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    const helligkeit = (token: string) => {
      // Der Dark-Block steht hinter dem Light-Block; der letzte Treffer gewinnt.
      const treffer = [...css.matchAll(new RegExp(`--${token}:\\s*[\\d.]+ [\\d.]+% ([\\d.]+)%`, 'g'))]
      expect(treffer.length, `--${token} nicht gefunden`).toBeGreaterThan(0)
      return Number(treffer[treffer.length - 1][1])
    }
    expect(helligkeit('background')).toBeLessThan(helligkeit('card'))
    expect(helligkeit('card')).toBeLessThan(helligkeit('popover'))
  })
})
