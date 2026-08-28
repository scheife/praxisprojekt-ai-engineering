import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Nur die mitliegenden Unit-/Integrationstests aus `src/`. Die End-to-End-Tests in
    // `tests/` gehören Playwright und haben einen eigenen Läufer (`npm run test:e2e`) —
    // sammelt Vitest sie mit ein, bricht die Datei mit „Playwright Test did not expect
    // test.beforeEach() to be called here" ab.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // A fresh scaffold ships no tests yet — `npm test` must not fail before
    // /build and /qa have written the first ones.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
