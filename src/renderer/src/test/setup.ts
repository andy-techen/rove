import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { applyOverrides } from '../state/commands/keymap'
import { createFakeApi } from './fakeApi'

afterEach(() => {
  cleanup()
  applyOverrides({})
})

// jsdom has no layout engine; components that measure themselves get a fixed width.
class FixedResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.callback(
      [{ target, contentRect: { width: 800, height: 100 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver
    )
  }
  unobserve(): void {
    // Nothing is tracked, so nothing to stop.
  }
  disconnect(): void {
    // Nothing is tracked, so nothing to stop.
  }
}
globalThis.ResizeObserver ??= FixedResizeObserver as unknown as typeof ResizeObserver

// The preload bridge; tests that care about calls replace it with their own fake.
window.api = createFakeApi()

// jsdom can't draw; waveforms just skip drawing when there's no 2D context.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext

// jsdom has <dialog> but can't open one; opening it is enough for tests.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
