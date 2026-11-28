import { describe, expect, it } from 'vitest'
import { WINDOW } from './constants'
import { restoreBounds } from './windowBounds'

const laptop = { x: 0, y: 0, width: 1440, height: 875 }
const external = { x: 1440, y: 0, width: 2560, height: 1415 }
const opening = { width: WINDOW.width, height: WINDOW.height, maximized: false }

describe('restoreBounds', () => {
  it('reopens where the window was left', () => {
    const saved = { x: 1600, y: 100, width: 1400, height: 900, maximized: true }
    expect(restoreBounds(saved, [laptop, external])).toEqual(saved)
  })

  it.each([
    ['nothing was saved', undefined],
    ['the file is not bounds', { width: 'wide' }]
  ])('opens at the default size when %s', (_, saved) => {
    expect(restoreBounds(saved, [laptop])).toEqual(opening)
  })

  it('keeps the size but lets the system place it when its display is gone', () => {
    const saved = { x: 1600, y: 100, width: 1400, height: 900, maximized: false }
    expect(restoreBounds(saved, [laptop])).toEqual({ width: 1400, height: 900, maximized: false })
  })

  it('never opens smaller than the smallest window', () => {
    const saved = { x: 10, y: 10, width: 50, height: 50, maximized: false }
    expect(restoreBounds(saved, [laptop])).toMatchObject({
      width: WINDOW.minWidth,
      height: WINDOW.minHeight
    })
  })
})
