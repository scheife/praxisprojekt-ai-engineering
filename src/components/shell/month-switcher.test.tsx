import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MonthSwitcher } from './month-switcher'

/**
 * Die Pfeilgrenzen (AC-18).
 *
 * Zwei Zusicherungen, die in der Oberfläche leicht auseinanderlaufen: der Pfeil ist an der
 * Grenze **nicht anklickbar**, und er ist trotzdem **noch da** — mit einer Erklärung für
 * Screenreader. Ein Pfeil, der verschwindet, verschiebt das Layout und lässt offen, warum es
 * nicht weitergeht.
 */
const NOW = new Date('2026-08-14T12:00:00Z')

describe('Monatswechsler (AC-17, AC-18)', () => {
  it('benennt den angezeigten Monat ausgeschrieben', () => {
    render(<MonthSwitcher month="2026-08" oldest="2026-06" now={NOW} />)
    expect(screen.getByText('August 2026')).toBeInTheDocument()
  })

  it('verlinkt beide Pfeile auf den Nachbarmonat in der Adresse (AC-17)', () => {
    render(<MonthSwitcher month="2026-07" oldest="2026-06" now={NOW} />)
    expect(screen.getByRole('link', { name: /Zurück zu Juni 2026/ })).toHaveAttribute(
      'href',
      '/?monat=2026-06',
    )
    expect(screen.getByRole('link', { name: /Weiter zu August 2026/ })).toHaveAttribute(
      'href',
      '/?monat=2026-08',
    )
  })

  it('macht den Vorwärtspfeil im laufenden Monat inaktiv, lässt ihn aber stehen (AC-18)', () => {
    render(<MonthSwitcher month="2026-08" oldest="2026-06" now={NOW} />)
    expect(screen.queryByRole('link', { name: /Weiter zu/ })).toBeNull()
    expect(
      screen.getByText('Weiter geht es nicht — das ist der laufende Monat.'),
    ).toBeInTheDocument()
  })

  it('macht den Rückwärtspfeil im ältesten Monat inaktiv, lässt ihn aber stehen (AC-18)', () => {
    render(<MonthSwitcher month="2026-06" oldest="2026-06" now={NOW} />)
    expect(screen.queryByRole('link', { name: /Zurück zu/ })).toBeNull()
    expect(
      screen.getByText('Weiter zurück geht es nicht — davor hast du nichts erfasst.'),
    ).toBeInTheDocument()
  })

  it('sperrt den Rückwärtspfeil auch, wenn es überhaupt keine Ausgabe gibt', () => {
    render(<MonthSwitcher month="2026-08" oldest={null} now={NOW} />)
    expect(screen.queryByRole('link', { name: /Zurück zu/ })).toBeNull()
  })

  it('öffnet den Rückwärtspfeil, sobald eine ältere Ausgabe existiert (EC-8)', () => {
    render(<MonthSwitcher month="2026-08" oldest="2026-07" now={NOW} />)
    expect(screen.getByRole('link', { name: /Zurück zu Juli 2026/ })).toBeInTheDocument()
  })

  it('rechnet über die Jahresgrenze', () => {
    render(<MonthSwitcher month="2026-01" oldest="2025-11" now={NOW} />)
    expect(screen.getByRole('link', { name: /Zurück zu Dezember 2025/ })).toHaveAttribute(
      'href',
      '/?monat=2025-12',
    )
  })
})
