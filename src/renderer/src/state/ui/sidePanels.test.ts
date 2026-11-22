import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SIDE_WIDTH, clampWidth, useSidePanelSize } from './sidePanels'

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
