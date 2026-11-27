import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { trackNumberOf, useTrackNumberKeys } from './trackKeys'

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...mods
  }) as KeyboardEvent

describe('trackNumberOf', () => {
  it('picks a track with ⌘ and its number on a Mac', () => {
    expect(trackNumberOf(key('Digit3', { metaKey: true }), 'darwin')).toBe(3)
  })

  it('uses Ctrl elsewhere', () => {
    expect(trackNumberOf(key('Digit1', { ctrlKey: true }), 'win32')).toBe(1)
    expect(trackNumberOf(key('Digit1', { metaKey: true }), 'win32')).toBeNull()
  })

  it('ignores a number typed on its own, with other keys held, or 0', () => {
    expect(trackNumberOf(key('Digit2'), 'darwin')).toBeNull()
    expect(trackNumberOf(key('Digit2', { metaKey: true, shiftKey: true }), 'darwin')).toBeNull()
    expect(trackNumberOf(key('Digit0', { metaKey: true }), 'darwin')).toBeNull()
  })
})

describe('useTrackNumberKeys', () => {
  it('picks the track for the number pressed with ⌘', () => {
    const onPick = vi.fn()
    renderHook(() => useTrackNumberKeys(onPick))
    // The test window is a Mac (test/fakeApi.ts).
    fireEvent.keyDown(window, { code: 'Digit2', metaKey: true })
    expect(onPick).toHaveBeenCalledWith(2)
  })
})
