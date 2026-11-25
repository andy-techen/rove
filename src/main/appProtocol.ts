import { net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The packaged app loads from app://rove/ rather than file://. A custom protocol can send
 * the cross-origin isolation headers that onnxruntime-web needs to use more than one CPU
 * thread (vocal removal is about three times faster); file:// can't send headers at all.
 * Electron's security guide also prefers a custom protocol to file://.
 */
export const APP_SCHEME = 'app'
export const APP_ORIGIN = `${APP_SCHEME}://rove`

const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4'
}

export const contentType = (file: string): string =>
  CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'

/** The file an app:// URL names inside the renderer folder, or null if it would leave it. */
export function appFilePath(root: string, url: string): string | null {
  const { pathname } = new URL(url)
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
  const file = path.resolve(root, relative)
  return file.startsWith(root + path.sep) ? file : null
}

/** Must run before the app is ready: lets app:// pages fetch, stream and count as secure. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

/** Serves the built renderer from `root`, with isolation headers on every file. */
export function serveApp(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = appFilePath(root, request.url)
    if (!file) return new Response(null, { status: 404 })
    const response = await net.fetch(pathToFileURL(file).toString())
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': contentType(file), ...ISOLATION_HEADERS }
    })
  })
}
