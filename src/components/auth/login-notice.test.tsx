import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginNotice } from './login-notice'

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }))

describe('Hinweiszeile auf /login', () => {
  beforeEach(() => toastSuccess.mockClear())

  it('nennt den Grund, wenn die Sitzung abgelaufen ist (EC-3)', () => {
    render(<LoginNotice reason="session-expired" />)
    expect(
      screen.getByText('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.'),
    ).toBeInTheDocument()
  })

  it('bestätigt die Kontolöschung (AC-15)', () => {
    render(<LoginNotice reason="deleted" />)
    expect(screen.getByText('Dein Konto ist gelöscht. Alles Gute!')).toBeInTheDocument()
  })

  it('zeigt ohne Grund nichts an', () => {
    const { container } = render(<LoginNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('zeigt bei einem unbekannten Grund nichts an — auch nicht bei erfundenen Werten', () => {
    const { container } = render(<LoginNotice reason="irgendwas-erfundenes" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('meldet das Abmelden als Toast, nicht als Zeile über dem Formular (AC-14)', () => {
    const { container } = render(<LoginNotice reason="signed-out" />)
    expect(container).toBeEmptyDOMElement()
    expect(toastSuccess).toHaveBeenCalledWith('Du bist abgemeldet.')
  })

  it('meldet nichts, wenn gar kein Grund vorliegt', () => {
    render(<LoginNotice />)
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('ist für Screenreader als Statusmeldung ausgezeichnet', () => {
    render(<LoginNotice reason="session-expired" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
