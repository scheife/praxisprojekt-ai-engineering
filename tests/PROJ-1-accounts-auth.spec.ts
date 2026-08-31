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
 * **Nicht abgedeckt, mit Absicht:** die Drosselung (AC-8, AC-9, AC-17). Sie hängt an Zählern,
 * die sich über eine ganze Suite hinweg gegenseitig beeinflussen; geprüft wird sie gezielt
 * gegen die Datenbankfunktionen — in den Unit-Tests und in `/qa`, wo eine IP frei übergeben
 * werden kann. Ein E2E-Test, der fünf Fehlanmeldungen auslöst, wäre hier nur ein Zufallsgeber
 * für die anderen Journeys.
 */

test.beforeEach(() => {
  // Siehe helpers.ts: Die Registrierungs-Drosselung zählt ohne erklärten Proxy alle Versuche
  // gemeinsam (AC-17, TD-23) — ohne diesen Reset sperrt sich die Suite selbst aus. Keine der
  // Journeys hier prüft die Drosselung.
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
  //
  // Geprüft wird der Leerzustand der Monatsübersicht. Bis PROJ-2 gebaut war, stand hier die
  // Platzhalterüberschrift „Hier entstehen deine Ausgaben." — `docs/app-shell.md` hat die
  // Seite immer als vorläufig geführt, PROJ-2 hat sie planmäßig ersetzt. Was PROJ-1 hier
  // zusichert, ist unverändert: **angemeldet und drin**, nicht ein bestimmter Satz.
  await expect(page).toHaveURL('/', AKTION)
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible()

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
  // Auf die Karte eingegrenzt: Seit PROJ-2 den gemeinsamen Header ergänzt hat, gibt es auf
  // `/konto` **zwei** gleich benannte Abmelde-Schaltflächen (QA-Bericht von PROJ-2, BUG-3).
  // AC-14 gehört zu der in der Konto-Karte — die im Header ist die Zugabe von PROJ-2.
  await page.getByRole('main').getByRole('button', { name: 'Abmelden' }).click()

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
