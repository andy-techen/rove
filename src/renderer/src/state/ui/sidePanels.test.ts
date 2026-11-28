import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { grownBy, useBottomPanelHeight, useSidePanelSize } from './sidePanels'
import { BOTTOM_HEIGHT } from './constants'

describe('panel sizes', () => {
  it('remembers the side width and bottom height for next time', () => {
    const side = renderHook(() => useSidePanelSize())
    const bottom = renderHook(() => useBottomPanelHeight())
    act(() => side.result.current.setWidth(400))
    act(() => bottom.result.current.setHeight(420))
    side.unmount()
    bottom.unmount()
    expect(renderHook(() => useSidePanelSize()).result.current.width).toBe(400)
    expect(renderHook(() => useBottomPanelHeight()).result.current.height).toBe(420)
  })
})

describe('grownBy', () => {
  it('grows a panel by what it was short, never shrinking it or passing the limits', () => {
    expect(grownBy(240, 190)).toBe(430)
    expect(grownBy(500, -40)).toBe(500)
    expect(grownBy(240, 2000)).toBe(BOTTOM_HEIGHT.max)
  })
})
