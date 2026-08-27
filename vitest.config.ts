import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
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
