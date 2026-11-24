import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  BOTTOM_HEIGHT,
  SIDE_WIDTH,
  clampBottom,
  clampWidth,
  useBottomPanelHeight,
  useSidePanelSize
} from './sidePanels'

describe('side panel size', () => {
  it('keeps the width between a usable minimum and a sensible maximum', () => {
    expect(clampWidth(50)).toBe(SIDE_WIDTH.min)
    expect(clampWidth(5000)).toBe(SIDE_WIDTH.max)
  })

  it('remembers the width for next time', () => {
    const first = renderHook(() => useSidePanelSize())
    act(() => first.result.current.setWidth(400))
    first.unmount()
    expect(renderHook(() => useSidePanelSize()).result.current.width).toBe(400)
  })
})

describe('bottom panel height', () => {
  it('stays within a usable range', () => {
    expect(clampBottom(10)).toBe(BOTTOM_HEIGHT.min)
    expect(clampBottom(5000)).toBe(BOTTOM_HEIGHT.max)
  })

  it('remembers the height for next time', () => {
    const first = renderHook(() => useBottomPanelHeight())
    act(() => first.result.current.setHeight(420))
    first.unmount()
    expect(renderHook(() => useBottomPanelHeight()).result.current.height).toBe(420)
  })
})
