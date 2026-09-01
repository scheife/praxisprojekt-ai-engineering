import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'

import { PASSWORD, clearThrottle, uniqueEmail } from './helpers'

/**
 * Die Zusicherung für die **Gesamtgrenze** aus EC-4 (PROJ-2, T28).
 *
 * `spec.md` nennt zwei Zahlen: höchstens **2 Sekunden je Aufruf** an Datenbank oder Auth-Server —
 * das prüfen die Unit-Tests in `src/lib/supabase/deadline.test.ts` — und höchstens **5 Sekunden je
 * Anfrage**, also das, was die Person tatsächlich wartet. Nur die zweite Zahl lässt sich an der
 * laufenden Anwendung messen, und nur mit einer Gegenstelle, die wirklich nicht antwortet.
 *
 * **Warum dieser Test nicht im Alltagslauf steckt:** Er hält einen Container an. Bei zwei Arbeitern
 * risse das jeden gleichzeitig laufenden Test mit. Er trägt deshalb `@outage` und wird über
 * `npm run test:outage` gezielt gestartet (`playwright.config.ts`, `grepInvert`).
 *
 * **Warum nur PostgREST und nicht die Datenbank:** So bleibt die Anmeldung prüfbar. Das ist zugleich
 * der schwierigere Fall — er hat BUG-4 zutage gefördert — und der kleinere Eingriff in den lokalen
 * Stack.
 */
const REST = process.env.SUPABASE_REST_CONTAINER ?? 'supabase_rest_praxisprojekt-ai-engineering'
const DB = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_praxisprojekt-ai-engineering'

/**
 * Die Zusage aus EC-4: so lange darf es höchstens dauern, **bis die Person die Meldung sieht**.
 *
 * Das ist bewusst nicht dasselbe wie die Dauer der HTTP-Antwort. `design.md` führt für den
 * POST-Weg 4,07 s — das ist die **vollständige** Antwort, inklusive des Neuaufbaus der Seite, der
 * danach noch streamt. Die Meldung selbst steht rund 2,4 s nach dem Klick auf dem Bildschirm.
 * Beide Zahlen stimmen; EC-4 spricht von der Meldung, also misst dieser Test sie.
 */
const GRENZE_MS = 5000

/**
 * Die beiden Meldungen, die ein gescheiterter Schreibversuch zeigen darf.
 *
 * EC-4 schreibt keinen Wortlaut vor — es verlangt „eine verständliche Meldung". Zulässig sind
 * deshalb beide: die des gescheiterten Speicherns und die des Nicht-erreichbar-Zustands.
 */
const MELDUNG = /Das Speichern hat gerade nicht geklappt|Wir erreichen deine Daten gerade nicht/

function docker(befehl: 'pause' | 'unpause', container: string): void {
  execFileSync('docker', [befehl, container], { encoding: 'utf8' })
}

/** Füllt die Erfassungszeile, solange die Gegenstelle noch antwortet. */
async function fuelleErfassungszeile(page: Page): Promise<void> {
  await page.getByLabel('Betrag').fill('12,50')
  await page.getByLabel('Kategorie').click()
  await page.getByRole('option', { name: 'Software & Abos', exact: true }).click()
}

test('@outage Keine Anfrage wartet länger als 5 Sekunden, wenn der Datenzugriff steht (EC-4)', async ({
  page,
}) => {
  clearThrottle()

  const email = uniqueEmail('outage')
  await page.goto('/signup')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto anlegen' }).click()
  await expect(page).toHaveURL('/', { timeout: 30_000 })

  // Die Route einmal warm laufen lassen: Die Erstübersetzung durch den Entwicklungsserver ist
  // keine Wartezeit auf eine Gegenstelle und hat frühere Messungen um Sekunden verfälscht.
  await page.goto('/?monat=2026-08')

  /**
   * **Erst ausfüllen, dann ausfallen lassen** — und zwar in dieser Reihenfolge, weil sie die
   * wirkliche ist: Die Person hat die Seite offen, tippt eine Ausgabe, und *dann* antwortet die
   * Gegenstelle nicht mehr. Andersherum ginge es gar nicht: Steht der Datenzugriff schon beim
   * Laden, zeigt die Seite den Nicht-erreichbar-Zustand — dann gibt es keine Erfassungszeile,
   * die man ausfüllen könnte.
   */

  // ---------------------------------------------------------------------------------------------
  // Fall 1 — nur der Datenzugriff steht, die Anmeldung bleibt prüfbar.
  // Das ist der Weg, auf dem BUG-4 gefunden wurde.
  // ---------------------------------------------------------------------------------------------
  await fuelleErfassungszeile(page)
  let schreibenOhneDaten = 0
  let lesenOhneDaten = 0
  try {
    docker('pause', REST)

    await expect(page.getByText(MELDUNG)).toHaveCount(0)
    const t1 = Date.now()
    await page.getByRole('button', { name: 'Erfassen' }).click()
    await expect(page.getByText(MELDUNG)).toBeVisible({ timeout: GRENZE_MS + 3000 })
    schreibenOhneDaten = Date.now() - t1

    const t2 = Date.now()
    await page.goto('/?monat=2026-08')
    await expect(page.getByText(/Wir erreichen deine Daten gerade nicht/)).toBeVisible({
      timeout: GRENZE_MS + 3000,
    })
    lesenOhneDaten = Date.now() - t2
  } finally {
    // **Immer freigeben** — auch wenn eine Zusicherung gescheitert ist. Ein Test, der den Stack
    // der Nutzerin angehalten zurücklässt, ist teurer als der Fehler, den er findet.
    docker('unpause', REST)
  }

  // ---------------------------------------------------------------------------------------------
  // Fall 2 — Datenbank **und** Auth-Server stehen (die Anmeldung hängt an derselben Datenbank).
  // **Das ist der teuerste Weg:** `design.md` führt ihn mit 4,07 s, also nur knapp unter der
  // Grenze — weil ein POST die Sitzung zweimal prüft (TD-32). Genau deshalb steht er hier.
  // ---------------------------------------------------------------------------------------------
  await page.goto('/?monat=2026-08')
  await fuelleErfassungszeile(page)
  let schreibenOhneAlles = 0
  try {
    docker('pause', DB)

    await expect(page.getByText(MELDUNG)).toHaveCount(0)
    const t3 = Date.now()
    await page.getByRole('button', { name: 'Erfassen' }).click()
    await expect(page.getByText(MELDUNG)).toBeVisible({ timeout: GRENZE_MS + 3000 })
    schreibenOhneAlles = Date.now() - t3
  } finally {
    docker('unpause', DB)
  }

  console.log(
    `\n  Nur Datenzugriff aus — schreiben: ${schreibenOhneDaten} ms` +
      `\n  Nur Datenzugriff aus — lesen:     ${lesenOhneDaten} ms` +
      `\n  Alles aus — schreiben:            ${schreibenOhneAlles} ms  (der teuerste Weg)` +
      `\n  Grenze:                           ${GRENZE_MS} ms\n`,
  )

  expect(schreibenOhneDaten, 'Erfassen ohne Datenzugriff riss die Zusage aus EC-4').toBeLessThan(GRENZE_MS)
  expect(lesenOhneDaten, 'Das Laden ohne Datenzugriff riss die Zusage aus EC-4').toBeLessThan(GRENZE_MS)
  expect(schreibenOhneAlles, 'Erfassen ohne Datenbank und Auth riss die Zusage aus EC-4').toBeLessThan(GRENZE_MS)

  // Gegenprobe: Nach dem Freigeben trägt die Seite wieder Daten.
  await page.goto('/?monat=2026-08')
  await expect(page.getByText(/Wir erreichen deine Daten gerade nicht/)).toBeHidden()
})
