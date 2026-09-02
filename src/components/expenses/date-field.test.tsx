import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DateField } from './date-field'

/**
 * Das Datumsfeld (AC-31, AC-32, EC-14).
 *
 * Der Kern der Zusicherungen ist **nicht**, dass ein Kalender aufgeht — das sieht man. Der Kern
 * ist, dass die **beiden Wege denselben Wert schreiben** (AC-31) und dass der Kalender keinen Tag
 * anbietet, den das Formular danach ablehnt (EC-14). Beides wäre von außen unsichtbar falsch.
 */

/** Ein fester "heute", damit die Grenzen aus EC-14 nicht mit dem Kalender der Maschine wandern. */
const HEUTE = new Date('2026-08-20T10:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(HEUTE)
})
afterEach(() => vi.useRealTimers())

function feld(value = '2026-08-15', onChange = vi.fn()) {
  render(<DateField id="spentOn" value={value} onChange={onChange} />)
  return { onChange, input: screen.getByDisplayValue(value) as HTMLInputElement }
}

describe('Der Wochentag am Feld (AC-32)', () => {
  it('nennt den Wochentag des angezeigten Datums', () => {
    feld('2026-08-15')
    expect(screen.getByText('Sa')).toBeInTheDocument()
  })

  it('wandert mit, wenn ein anderes Datum angezeigt wird', () => {
    feld('2026-08-17')
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.queryByText('Sa')).not.toBeInTheDocument()
  })

  it('zeigt nichts an, solange kein Datum dasteht', () => {
    const onChange = vi.fn()
    render(<DateField id="spentOn" value="" onChange={onChange} />)
    for (const tag of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(screen.queryByText(tag)).not.toBeInTheDocument()
    }
  })
})

describe('Zwei Wege zum selben Wert (AC-31)', () => {
  it('bleibt tippbar — das Feld ist ein echtes Datumsfeld', () => {
    const { input } = feld()
    expect(input.type).toBe('date')
    expect(input).not.toHaveAttribute('readonly')
    expect(input).not.toBeDisabled()
  })

  it('meldet eine Tastatureingabe über dasselbe onChange wie der Kalender', async () => {
    const onChange = vi.fn()
    const { input } = feld('2026-08-15', onChange)
    fireEvent.change(input, { target: { value: '2026-08-17' } })
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('2026-08-17')
  })

  it('schreibt beim Klick im Kalender denselben Wert in derselben Schreibweise', async () => {
    const onChange = vi.fn()
    feld('2026-08-15', onChange)

    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Montag, 17. August 2026' }))

    // Kein `2026-08-17T00:00:00Z`, kein `17.08.2026` — genau die Schreibweise, die gespeichert
    // wird. Ein zweiter Eingabeweg darf kein zweites Format erzeugen.
    expect(onChange).toHaveBeenCalledWith('2026-08-17')
  })

  it('gibt den Tag in Ortszeit zurück, nicht um einen verschoben', async () => {
    // Über `toISOString()` gebaut wäre der 1. eines Monats westlich von Greenwich der Vormonat.
    const onChange = vi.fn()
    feld('2026-08-15', onChange)

    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Samstag, 1. August 2026' }))

    expect(onChange).toHaveBeenCalledWith('2026-08-01')
  })
})

describe('Der Kalender bietet nichts Unzulässiges an (EC-14)', () => {
  it('zeigt keinen Tag nach heute', async () => {
    feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    await screen.findByRole('button', { name: /20\. August 2026/ })

    // Heute ist der 20.08.2026 — alles danach darf im Kalender gar nicht erst stehen (AC-7).
    expect(
      screen.queryByRole('button', { name: 'Freitag, 21. August 2026' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Montag, 31. August 2026' }),
    ).not.toBeInTheDocument()
  })

  it('lässt den heutigen Tag zu — die Grenze ist einschließlich', async () => {
    feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    expect(
      await screen.findByRole('button', { name: /20\. August 2026/ }),
    ).toBeInTheDocument()
  })

  it('begrenzt das Feld zusätzlich über min und max — auch ohne Kalender', () => {
    const { input } = feld()
    expect(input).toHaveAttribute('min', '2000-01-01')
    expect(input).toHaveAttribute('max', '2026-08-20')
  })
})

describe('Der Auslöser schickt das Formular nicht ab', () => {
  it('trägt type="button" — sonst wäre er ein Absende-Knopf (BUG-5)', () => {
    feld()
    expect(screen.getByRole('button', { name: 'Kalender öffnen' })).toHaveAttribute(
      'type',
      'button',
    )
  })
})
