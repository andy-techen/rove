import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { appFilePath, contentType } from './appProtocol'

const root = path.resolve('/Applications/Rove.app/Contents/Resources/app.asar/out/renderer')

describe('appFilePath', () => {
  it('maps an app:// URL to a file inside the renderer folder', () => {
    expect(appFilePath(root, 'app://rove/index.html')).toBe(path.join(root, 'index.html'))
    expect(appFilePath(root, 'app://rove/assets/ort%20x.wasm')).toBe(
      path.join(root, 'assets/ort x.wasm')
    )
  })

  it('serves the page for the bare origin', () => {
    expect(appFilePath(root, 'app://rove/')).toBe(path.join(root, 'index.html'))
  })

  it('refuses paths that climb out of the renderer folder', () => {
    expect(appFilePath(root, 'app://rove/..%2F..%2Fsecrets.txt')).toBeNull()
  })
})

describe('contentType', () => {
  it('names the types the page loads, WebAssembly included', () => {
    expect(contentType('a/index.html')).toBe('text/html')
    expect(contentType('a/x.wasm')).toBe('application/wasm')
    expect(contentType('a/x.js')).toBe('text/javascript')
  })
})
