import { test, expect, type Page } from '@playwright/test'

import { PASSWORD, clearThrottle, countAccounts, countProfiles, uniqueEmail } from './helpers'

/**
 * Zeitbudget für die Server Actions.
 *
 * Die Suite fährt acht Tests parallel (vier Journeys × zwei Projekte) gegen `next dev`, und
 * jede Registrierung lässt Supabase Auth ein Passwort hashen. Unter dieser Last dauert eine
 * Action deutlich länger als die 5 Sekunden, die Playwright voreingestellt zulässt — das ist
 * Testumgebung, nicht Produktverhalten. Die Antwortzeiten selbst prüft `/qa` gegen den
 * Produktions-Build (AC-18), nicht diese Suite.
 */
const AKTION = { timeout: 30_000 }

/**
 * PROJ-1 — die kritischen Wege durch Konto & Anmeldung.
 *
 * Bewusst vier Journeys statt eines Tests je Acceptance Criterion: E2E-Tests sind langsam
 * und teuer in der Pflege, die Masse der AC-Abdeckung tragen die Unit- und Integrationstests
 * aus `/build` und `/qa`. Hier steht nur, was niemals stillschweigend brechen darf.
 *
 * **Nicht abgedeckt, mit Absicht:** die Drosselung (AC-8, AC-9, AC-17). Dort liegt ein
 * offener High-Befund (QA-Bericht, BUG-1), und ein Test, der fünf Fehlanmeldungen auslöst,
 * würde derzeit alle parallel laufenden Anmelde-Tests mit aussperren.
 */

test.beforeEach(() => {
  // Siehe helpers.ts: solange alle Anfragen einen Zähler-Eimer teilen, sperrt die Suite
  // sich sonst selbst aus. Keine der Journeys hier prüft die Drosselung.
  clearThrottle()
})

/** Registriert ein frisches Konto über das Formular und landet angemeldet auf `/`. */
async function registriere(page: Page, email: string): Promise<void> {
  await page.goto('/signup')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto anlegen' }).click()
  await expect(page).toHaveURL('/', AKTION)
}

test('Journey 1: Registrieren führt aus dem gesperrten Bereich direkt hinein (AC-11, AC-1, AC-2, EC-1)', async ({
  page,
}) => {
  const email = uniqueEmail('journey1')

  // AC-11 — abgemeldet ist der Ausgabenbereich zu.
  await page.goto('/')
  await expect(page).toHaveURL('/login')

  await page.getByRole('link', { name: 'Konto anlegen' }).click()
  await expect(page).toHaveURL('/signup')

  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)

  // EC-1 — zweimal schnell klicken. Der zweite Klick darf kein zweites Konto erzeugen und
  // keinen Fehler zeigen; der Absende-Button ist während der Übertragung gesperrt.
  const absenden = page.getByRole('button', { name: 'Konto anlegen' })
  await absenden.click({ noWaitAfter: true })
  await absenden.click({ force: true, noWaitAfter: true, timeout: 2000 }).catch(() => {
    // Erwartet: der Button ist bereits gesperrt. Genau das ist der Schutz.
  })

  // AC-1 — angelegt, sofort angemeldet, auf der Startseite.
  await expect(page).toHaveURL('/', AKTION)
  await expect(page.getByRole('heading', { name: 'Hier entstehen deine Ausgaben.' })).toBeVisible()

  // EC-1 — und zwar genau EIN Konto, nicht zwei.
  expect(countAccounts(email)).toBe(1)

  // AC-2 — die Profilzeile ist da, ohne dass ein weiterer Schritt nötig war.
  expect(countProfiles(email)).toBe(1)
})

test('Journey 2: Anmelden bringt die eigene Adresse auf die Kontoseite (AC-6, AC-12)', async ({
  page,
  context,
}) => {
  const email = uniqueEmail('journey2')
  await registriere(page, email)

  // Sitzung wegwerfen, ohne ein zweites Konto anzulegen — wie ein neuer Besuch.
  await context.clearCookies()
  await page.goto('/')
  await expect(page).toHaveURL('/login')

  // AC-6 — mit richtigen Daten hinein.
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL('/', AKTION)

  // Die Kontoseite zeigt die eigene Adresse — und nur die eigene.
  await page.goto('/konto')
  await expect(page.getByText(email)).toBeVisible()

  // AC-12 — angemeldet führen /login und /signup zurück in den Bereich.
  await page.goto('/login')
  await expect(page).toHaveURL('/')
  await page.goto('/signup')
  await expect(page).toHaveURL('/')
})

test('Journey 3: Abmelden schließt den geschützten Bereich wieder (AC-14, AC-11)', async ({
  page,
}) => {
  const email = uniqueEmail('journey3')
  await registriere(page, email)

  await page.goto('/konto')
  await page.getByRole('button', { name: 'Abmelden' }).click()

  // AC-14 — Sitzung beendet, zurück auf der Anmeldeseite.
  await expect(page).toHaveURL(/\/login/, AKTION)

  // AC-11 — und der Bereich ist wirklich zu, nicht nur die Ansicht gewechselt.
  await page.goto('/')
  await expect(page).toHaveURL('/login')
  await page.goto('/konto')
  await expect(page).toHaveURL('/login')

  // Der Zurück-Button darf die Kontoseite nicht aus dem Verlauf zurückholen.
  await page.goBack()
  await expect(page.getByText(email)).toHaveCount(0)
})

test('Journey 4: Konto löschen über den Bestätigungsdialog entfernt es endgültig (AC-15)', async ({
  page,
}) => {
  const email = uniqueEmail('journey4')
  await registriere(page, email)

  await page.goto('/konto')
  await page.getByRole('button', { name: 'Konto löschen' }).click()

  // Der Dialog ist der Punkt, den `/qa` ohne Browser nicht prüfen konnte.
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByText('Konto endgültig löschen?')).toBeVisible()

  // Abbrechen lässt das Konto in Ruhe.
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).toBeHidden()
  expect(countAccounts(email)).toBe(1)

  // Und jetzt wirklich.
  await page.getByRole('button', { name: 'Konto löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()

  // AC-15 — abgemeldet, mit Bestätigung, und das Konto ist weg.
  await expect(page).toHaveURL(/\/login/, AKTION)
  await expect(page.getByText('Dein Konto ist gelöscht. Alles Gute!')).toBeVisible()
  expect(countAccounts(email)).toBe(0)
  expect(countProfiles(email)).toBe(0)

  // Erneute Anmeldung mit denselben Zugangsdaten schlägt fehl.
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText('E-Mail-Adresse oder Passwort stimmt nicht.')).toBeVisible(AKTION)
})
