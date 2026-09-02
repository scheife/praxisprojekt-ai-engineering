import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Elevation folgt `docs/design-system.md` §6.1 (BUG-13, 02.09.2026).
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
