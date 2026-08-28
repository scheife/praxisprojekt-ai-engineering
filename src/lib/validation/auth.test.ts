import { describe, expect, it } from 'vitest'

import { loginSchema, signupSchema } from './auth'

describe('E-Mail-Prüfung', () => {
  it('nimmt eine gültige Adresse an und normalisiert sie', () => {
    const result = signupSchema.safeParse({
      email: '  Alex@Example.COM  ',
      password: 'einsehrlangespw',
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.email).toBe('alex@example.com')
  })

  it('lehnt eine Zeichenkette ohne E-Mail-Format ab (AC-4)', () => {
    const result = signupSchema.safeParse({
      email: 'keine-adresse',
      password: 'einsehrlangespw',
    })
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0].message).toBe(
      'Bitte gib eine gültige E-Mail-Adresse ein.',
    )
  })

  it('lehnt eine leere Adresse ab', () => {
    expect(
      signupSchema.safeParse({ email: '   ', password: 'einsehrlangespw' }).success,
    ).toBe(false)
  })

  it('lehnt eine Adresse über 254 Zeichen ab', () => {
    const zuLang = `${'a'.repeat(250)}@example.com`
    expect(signupSchema.safeParse({ email: zuLang, password: 'einsehrlangespw' }).success).toBe(
      false,
    )
  })
})

describe('Passwort-Prüfung', () => {
  it('lehnt neun Zeichen ab und nimmt zehn an (AC-3)', () => {
    const neun = signupSchema.safeParse({ email: 'a@example.com', password: '123456789' })
    expect(neun.success).toBe(false)
    expect(neun.success === false && neun.error.issues[0].message).toBe(
      'Dein Passwort braucht mindestens 10 Zeichen.',
    )

    expect(
      signupSchema.safeParse({ email: 'a@example.com', password: '1234567890' }).success,
    ).toBe(true)
  })

  it('lehnt mehr als 72 Zeichen ab, statt still zu kürzen (TD-10)', () => {
    const result = signupSchema.safeParse({
      email: 'a@example.com',
      password: 'x'.repeat(73),
    })
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0].message).toBe(
      'Dein Passwort darf höchstens 72 Zeichen haben.',
    )
  })

  it('prüft beim Anmelden KEINE Mindestlänge — sonst liefe ein kurzer Rateversuch an der Drosselung vorbei (AC-8)', () => {
    const kurz = loginSchema.safeParse({ email: 'a@example.com', password: 'kurz' })
    expect(kurz.success).toBe(true)

    // und das Anmeldeformular plaudert die Regel nicht aus (AC-7)
    const leer = loginSchema.safeParse({ email: 'a@example.com', password: '' })
    expect(leer.success === false && leer.error.issues[0].message).not.toContain('mindestens 10')
  })

  it('begrenzt die Eingabelänge beim Anmelden trotzdem', () => {
    expect(
      loginSchema.safeParse({ email: 'a@example.com', password: 'x'.repeat(201) }).success,
    ).toBe(false)
  })

  it('lässt Randleerzeichen im Passwort unangetastet — bei Anmeldung wie Registrierung (EC-6)', () => {
    const mitLeerzeichen = '  geheimespasswort  '

    const signup = signupSchema.safeParse({ email: 'a@example.com', password: mitLeerzeichen })
    const login = loginSchema.safeParse({ email: 'a@example.com', password: mitLeerzeichen })

    expect(signup.success && signup.data.password).toBe(mitLeerzeichen)
    expect(login.success && login.data.password).toBe(mitLeerzeichen)
  })

  it('zählt ein Passwort aus lauter Leerzeichen nach Länge, nicht nach Inhalt (EC-6)', () => {
    // Würde das Passwort randbereinigt, käme hier eine leere Zeichenkette an und die
    // Prüfung schlüge fehl. Genau das darf nicht passieren.
    expect(
      signupSchema.safeParse({ email: 'a@example.com', password: ' '.repeat(12) }).success,
    ).toBe(true)
  })
})
