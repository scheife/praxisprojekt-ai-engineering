import { clearThrottle, deleteTestAccounts, TEST_DOMAIN } from './helpers'

/**
 * Läuft einmal vor der gesamten Suite.
 *
 * Zwei Dinge, beide aus demselben Grund: Die Drosselung von PROJ-1 zählt derzeit alle
 * Anfragen in einen gemeinsamen Eimer (QA-Bericht, BUG-1). Ohne einen sauberen Start würde
 * ein zweiter Suite-Lauf innerhalb derselben Stunde an der Registrierungs-Grenze scheitern,
 * und alte Testkonten würden sich ansammeln.
 */
export default function globalSetup(): void {
  const removed = deleteTestAccounts()
  clearThrottle()
  console.log(
    `[global-setup] ${removed} Testkonto/-konten (@${TEST_DOMAIN}) entfernt, Drosselungs-Zähler geleert.`,
  )
}
