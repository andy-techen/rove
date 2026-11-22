import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      // AudioWorklet modules must load from a real file: the CSP blocks data: scripts.
      assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined)
    }
  }
})
