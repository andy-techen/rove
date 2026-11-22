import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: { resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: [
        { find: '@renderer', replacement: resolve('src/renderer/src') },
        ...Object.entries(shared).map(([find, replacement]) => ({ find, replacement })),
        // Vocal removal runs onnxruntime-web's CPU build only. @audio/neural-runtime can
        // also load the WebGPU and WebGL builds, which would ship another 29 MB of
        // WebAssembly the app never uses; both resolve to the CPU build instead.
        { find: /^onnxruntime-web\/(webgpu|webgl)$/, replacement: 'onnxruntime-web/wasm' }
      ]
    },
    plugins: [
      react(),
      // The packaged app sends these from its app:// protocol (src/main/appProtocol.ts);
      // the dev server sends them too, so onnxruntime-web gets its threads in both.
      {
        name: 'cross-origin-isolation',
        configureServer(server) {
          server.middlewares.use((_req, res, next) => {
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
            next()
          })
        }
      }
    ],
    build: {
      // AudioWorklet modules must load from a real file: the CSP blocks data: scripts.
      assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined)
    }
  }
})
