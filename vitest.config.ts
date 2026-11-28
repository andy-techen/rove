import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // Component tests run in a simulated DOM. Pure modules pay for it too (about half of
    // the audio tests' time); setup.ts needs `window`, so they can't opt out yet.
    environment: 'jsdom',
    // Vitest marks tests slower than this in its output; docs/testing.md asks new tests
    // to stay under it.
    slowTestThreshold: 300,
    setupFiles: ['src/renderer/src/test/setup.ts'],
    // Each test starts with fresh call counts on the fake window.api.
    clearMocks: true,
    // Agent worktrees live in .claude/ and carry their own copy of the tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
    css: false
  }
})
