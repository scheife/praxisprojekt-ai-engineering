import { defineConfig, devices } from '@playwright/test'

/**
 * Ein **eigener Port** für die Tests, nicht der Standard 3000.
 *
 * Grund, derselbe wie bei Supabase (55321 statt 54321, siehe `docs/PRD.md`): Auf dieser
 * Maschine hält ein anderes Projekt die 3000 besetzt. Weicht `next dev` dann auf 3001 aus,
 * während `baseURL` weiter auf 3000 zeigt und `reuseExistingServer` den fremden Server als
 * „läuft schon" akzeptiert, prüft die ganze Suite **stillschweigend die falsche Anwendung** —
 * und meldet trotzdem grün oder rot. Genau das ist beim Bau von PROJ-2 passiert.
 *
 * Über `E2E_PORT` überschreibbar, falls auch 3200 einmal belegt ist.
 */
const E2E_PORT = process.env.E2E_PORT ?? '3200'
const E2E_URL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './tests',
  // Räumt vor dem Lauf die Testkonten früherer Läufe weg und leert die Drosselungs-Zähler.
  // Dauerhaft nötig: Die Registrierungs-Drosselung zählt ohne erklärten Proxy alle Versuche
  // gemeinsam — bewusst so (AC-17, TD-23). Siehe clearThrottle in tests/helpers.ts.
  globalSetup: './tests/global-setup.ts',
  /**
   * **Die Ausfall-Zusicherung läuft nicht im Alltag mit** (PROJ-2, T28).
   *
   * Sie hält einen Container an, um die Gesamtgrenze aus EC-4 zu messen. Bei zwei Arbeitern
   * risse das jeden gleichzeitig laufenden Test mit — und ein Test, der grundlos rot wird, wird
   * abgeschaltet; dann ist er gar nicht da. Deshalb ist er hier ausgeschlossen und wird über
   * `npm run test:outage` gezielt gestartet, das `E2E_OUTAGE` setzt.
   *
   * **Der Preis ist benannt:** Wer `npm run test:e2e` grün sieht, hat die 5-Sekunden-Grenze
   * **nicht** geprüft. Das tut erst `/qa`.
   */
  grepInvert: process.env.E2E_OUTAGE ? undefined : /@outage/,
  fullyParallel: true,
  // Acht Tests gleichzeitig gegen `next dev` überlasten den Entwicklungsserver: jede
  // Registrierung lässt Supabase Auth ein Passwort hashen, und die Server Actions liefen
  // dann in Zeitüberschreitungen, ohne dass am Produkt etwas falsch war (seriell grün).
  // Zwei Arbeiter halten die Suite verlässlich und immer noch zügig.
  workers: 2,
  // Eine Journey durchläuft mehrere Seiten und mehrere Server Actions gegen `next dev`,
  // wo jede Route beim ersten Aufruf noch übersetzt wird. Die voreingestellten 30 Sekunden
  // je Test sind dafür zu knapp — und sie waren zugleich das Budget, in dem die einzelnen
  // Zusicherungen liegen mussten.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI,
  },
})
