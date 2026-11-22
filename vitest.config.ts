import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // Component tests run in a simulated DOM; pure modules don't need one but it's cheap.
    environment: 'jsdom',
    setupFiles: ['src/renderer/src/test/setup.ts'],
    // Each test starts with fresh call counts on the fake window.api.
    clearMocks: true,
    css: false
  }
})
