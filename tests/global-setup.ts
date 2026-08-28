import { clearThrottle, deleteTestAccounts, TEST_DOMAIN } from './helpers'

/**
 * Läuft einmal vor der gesamten Suite.
 *
 * Zwei Dinge, beide aus demselben Grund: Die **Registrierungs**-Drosselung von PROJ-1 zählt
 * ohne erklärten Proxy alle Versuche in einen gemeinsamen Eimer — bewusst so (AC-17, TD-23),
 * weil es dort keine Rückfallregel je Konto gibt. Ohne einen sauberen Start würde ein zweiter
 * Suite-Lauf innerhalb derselben Stunde an der Grenze von 10 Registrierungen scheitern, und
 * alte Testkonten würden sich ansammeln. Siehe `clearThrottle` in `helpers.ts`.
 */
export default function globalSetup(): void {
  const removed = deleteTestAccounts()
  clearThrottle()
  console.log(
    `[global-setup] ${removed} Testkonto/-konten (@${TEST_DOMAIN}) entfernt, Drosselungs-Zähler geleert.`,
  )
}
