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

  /**
   * Ergänzt von `/qa` am 02.09.2026 (BUG-8). Die sichtbare Kurzform ist `aria-hidden` — richtig,
   * sonst spricht die Hilfstechnik ein zusammenhangloses „Sa" hinter dem Datum. Falsch war, dass
   * es dabei blieb: Der Wochentag fehlte dem Vorlesefluss ganz, obwohl AC-32 ihn „ohne den
   * Kalender zu öffnen" verlangt.
   */
  it('nennt den Wochentag auch der Hilfstechnik — ausgeschrieben, über die Feldbeschreibung', () => {
    const { input } = feld('2026-08-15')

    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    const beschreibung = ids
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')

    expect(beschreibung).toContain('Samstag')
  })

  it('nimmt die sichtbare Kurzform aus dem Vorlesefluss — sonst stünde sie doppelt', () => {
    feld('2026-08-15')
    expect(screen.getByText('Sa')).toHaveAttribute('aria-hidden')
  })

  it('beschreibt gar nichts, solange kein Datum dasteht', () => {
    const onChange = vi.fn()
    render(<DateField id="spentOn" value="" onChange={onChange} />)
    const input = document.getElementById('spentOn')!
    // Kein Datum, kein Wochentag — und keine Verweisung auf ein Element, das es nicht gibt.
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull()
  })

  it('verliert die Beschreibung des Aufrufers nicht — die Fehlermeldung bleibt verknüpft', () => {
    const onChange = vi.fn()
    render(
      <>
        <DateField id="spentOn" value="2026-08-15" onChange={onChange} describedBy="fehler-1" />
        <p id="fehler-1">Das Datum darf nicht in der Zukunft liegen.</p>
      </>,
    )
    const input = document.getElementById('spentOn')!
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(ids).toContain('fehler-1')

    const beschreibung = ids
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
    expect(beschreibung).toContain('Zukunft')
    expect(beschreibung).toContain('Samstag')
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
  /**
   * **Geändert am 02.09.2026 (BUG-12).** Diese Zusicherung hieß einmal „zeigt keinen Tag nach
   * heute" und prüfte, dass solche Tage **gar nicht im Dokument** stehen. Das war strenger als
   * der Vertrag und im Ergebnis falsch: Im laufenden Monat verschwand damit fast das ganze
   * Blatt — am 2. September blieben drei Zahlen übrig. Man sah den Monat nicht mehr.
   *
   * EC-14 sagt: „wenn ein Tag außerhalb des zulässigen Bereichs **angezeigt** wird …, dann lässt
   * er sich **gar nicht erst auswählen**." Der Edge Case setzt voraus, dass solche Tage zu sehen
   * sind. Geprüft wird deshalb, was er wirklich verlangt — und zwar am Verhalten: Ein Klick auf
   * einen gesperrten Tag darf **nichts** auslösen. Das ist die Zusicherung, die den Vertrag hält;
   * `disabled` am Knopf ist nur ihr Mechanismus.
   */
  it('sperrt jeden Tag nach heute, statt ihn zu verstecken', async () => {
    const { onChange } = feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    // Der heutige Tag heißt „Heute, Donnerstag, 20. August 2026" — deshalb ein Muster und
    // kein exakter Name: `react-day-picker` stellt „Heute" voran und hängt „, ausgewählt" an.
    await screen.findByRole('button', { name: /20\. August 2026/ })

    // Heute ist der 20.08.2026. Der Rest des Monats bleibt sichtbar — der Kalender ist sonst
    // im laufenden Monat kein Kalender mehr —, ist aber gesperrt.
    for (const tag of ['Freitag, 21. August 2026', 'Montag, 31. August 2026']) {
      const knopf = screen.getByRole('button', { name: tag })
      expect(knopf).toBeInTheDocument()
      expect(knopf).toBeDisabled()
    }

    // Und der Vertrag selbst: Klicken ändert nichts (AC-7 bleibt trotzdem serverseitig).
    fireEvent.click(screen.getByRole('button', { name: 'Freitag, 21. August 2026' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lässt den ganzen Monat stehen, auch wenn fast alles gesperrt ist', async () => {
    // Der Fall aus BUG-12: „heute" ist der 20., der August hat 31 Tage. Ein Kalender, der nur
    // die ersten zwanzig zeigt, beantwortet die Frage nicht mehr, für die man ihn öffnet —
    // nämlich auf welchen Wochentag ein Datum fällt.
    feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    await screen.findByRole('button', { name: /20\. August 2026/ })

    const tage = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? '')
      // „Heute, …" und „…, ausgewählt" gehören dazu, deshalb kein Anker am Zeilenende.
      .filter((n) => /\d+\. August 2026/.test(n))
    expect(tage).toHaveLength(31)
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

  /**
   * Ergänzt von `/qa` am 02.09.2026. EC-14 nennt **zwei** Grenzen, abgedeckt war nur die obere.
   * Die untere ist die unauffälligere: Ein Kalender, der den 31.12.1999 anbietet, sieht bis zum
   * Klick völlig richtig aus — und AC-30 lehnt danach ab. Genau die Falle, die EC-14 verbietet.
   */
  it('zeigt keinen Tag vor dem 01.01.2000 — die untere Grenze aus EC-14', async () => {
    feld('2000-01-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    await screen.findByRole('button', { name: 'Samstag, 1. Januar 2000' })

    // Der Januar 2000 beginnt an einem Samstag; die Randtage davor gehören zum Dezember 1999
    // und sind unzulässig. Sie dürfen deshalb gar nicht erst anklickbar sein.
    for (const tag of ['Freitag, 31. Dezember 1999', 'Donnerstag, 30. Dezember 1999']) {
      expect(screen.queryByRole('button', { name: tag })).not.toBeInTheDocument()
    }
  })

  it('lässt den 01.01.2000 zu — auch die untere Grenze ist einschließlich', async () => {
    feld('2000-01-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    expect(
      await screen.findByRole('button', { name: 'Samstag, 1. Januar 2000' }),
    ).toBeInTheDocument()
  })
})

/**
 * Ergänzt von `/qa` am 02.09.2026.
 *
 * TD-37 begrenzt das Blättern **zusätzlich** zum Ausblenden der Tage — „sonst landet man mit zwei
 * Klicks im Jahr 1850". Diese zweite Ebene hatte keine einzige Zusicherung: Fielen `startMonth`
 * und `endMonth` weg, blieben alle bestehenden Tests grün, weil sie nur das aufgeschlagene Blatt
 * ansehen. Der Kalender liefe dann durch leere Monate, in denen kein Tag wählbar ist — sichtbar
 * kaputt, aber von keinem Test bemerkt.
 */
describe('Das Blättern bleibt im zulässigen Bereich (EC-14, TD-37)', () => {
  it('lässt nicht vor den Januar 2000 zurückblättern', async () => {
    feld('2000-01-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    // `react-day-picker` sperrt die Navigation über `aria-disabled`, nicht über das
    // `disabled`-Attribut — geprüft wird deshalb genau das, was die Bibliothek wirklich setzt.
    expect(
      await screen.findByRole('button', { name: 'Zum vorherigen Monat' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('lässt nicht über den laufenden Monat hinaus vorblättern', async () => {
    feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    expect(
      await screen.findByRole('button', { name: 'Zum nächsten Monat' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('blättert innerhalb des Bereichs ganz normal', async () => {
    feld('2026-08-15')
    fireEvent.click(screen.getByRole('button', { name: 'Kalender öffnen' }))
    const zurueck = await screen.findByRole('button', { name: 'Zum vorherigen Monat' })
    expect(zurueck).not.toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(zurueck)
    expect(
      await screen.findByRole('button', { name: 'Mittwoch, 15. Juli 2026' }),
    ).toBeInTheDocument()
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
