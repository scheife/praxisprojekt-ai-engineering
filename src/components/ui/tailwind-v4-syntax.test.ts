import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Die Zusicherung gegen eine **stille** Fehlerklasse (BUG-11, 02.09.2026).
 *
 * Tailwind v3 erlaubte es, eine CSS-Variable als beliebigen Wert in eckigen Klammern zu
 * schreiben, und wickelte sie beim Erzeugen selbst in `var()`. **v4 hat das abgeschafft** und
 * verlangt runde Klammern. Die alte Form wirft keinen Fehler — sie erzeugt eine Regel mit einem
 * ungültigen Wert, die der Browser wortlos verwirft. Es gibt keine Warnung, keinen roten Build,
 * keinen Testfehler: Die Gestaltung fehlt einfach.
 *
 * Genau so ist der Kalender aus AC-31 kaputtgegangen: Ohne Höhe, Breite und `min-width` fiel das
 * Monatsraster von ~250 auf 109 Pixel zusammen, die Wochentage klebten als „MoDiMiDoFrSaSo"
 * aneinander. Aufgefallen ist es einem Menschen auf einem Screenshot — 297 Einheitentests und
 * 32 Browser-Journeys waren dabei grün, weil sie die **Struktur** prüfen und nicht die Regeln,
 * die am Ende wirklich gelten.
 *
 * **Warum die Prüfung am Quelltext und nicht am Aussehen ansetzt:** Diese Dateien kommen von
 * `npx shadcn@latest add …` und tragen die v3-Schreibweise ab Werk. Jede Neuerzeugung bringt sie
 * zurück. Eine Zusicherung je Baustein müsste man für jeden künftigen Baustein neu schreiben;
 * diese hier deckt alle ab, die es je geben wird — und sie nennt die betroffene Datei samt Zeile.
 */

const UI = join(process.cwd(), 'src/components/ui')

/**
 * Trifft `h-[--cell-size]`, `origin-[--radix-…]`, `max-w-[--skeleton-width]` — also einen
 * Utility-Namen, direkt gefolgt von einer eckigen Klammer mit einem Variablennamen darin.
 *
 * Trifft **nicht** die Deklaration `[--cell-size:2rem]` (kein Utility davor, Doppelpunkt darin)
 * und nicht `w-[var(--x)]`, die ausgeschriebene Form, die in v4 gültig bleibt.
 */
const V3_KURZFORM = /[a-z][a-z0-9-]*-\[--[a-z][a-z0-9-]*\]/g

function dateien(): string[] {
  return readdirSync(UI).filter((f) => f.endsWith('.tsx'))
}

describe('Keine Tailwind-v3-Kurzform für CSS-Variablen (BUG-11)', () => {
  it('findet in keinem UI-Baustein eine Variable in eckigen Klammern', () => {
    const funde: string[] = []

    for (const datei of dateien()) {
      const zeilen = readFileSync(join(UI, datei), 'utf8').split('\n')
      zeilen.forEach((zeile, i) => {
        for (const treffer of zeile.match(V3_KURZFORM) ?? []) {
          funde.push(`${datei}:${i + 1}  ${treffer}`)
        }
      })
    }

    // Die Meldung nennt jede Fundstelle — wer den Test rot sieht, weiß sofort, wo und was.
    expect(
      funde,
      `Tailwind v4 erzeugt daraus eine ungültige Regel, die der Browser verwirft.\n` +
        `Schreib die Variable in runden Klammern, z. B. aus "h-" plus eckigen Klammern wird "h-(--cell-size)".\n` +
        `Fundstellen:\n  ${funde.join('\n  ')}\n`,
    ).toEqual([])
  })

  it('prüft überhaupt etwas — es gibt UI-Bausteine zum Durchsuchen', () => {
    // Ohne das wäre der Test oben grün, sobald jemand den Ordner umbenennt.
    expect(dateien().length).toBeGreaterThan(5)
  })
})
