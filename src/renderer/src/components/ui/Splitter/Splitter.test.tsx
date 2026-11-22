import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Splitter } from '.'

function renderSplitter(props: Partial<Parameters<typeof Splitter>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <Splitter
      label="Side panel width"
      orientation="vertical"
      value={320}
      min={240}
      max={560}
      perPixel={-1}
      onChange={onChange}
      {...props}
    />
  )
  return { onChange, handle: screen.getByRole('separator', { name: 'Side panel width' }) }
}

describe('Splitter', () => {
  it('resizes as it is dragged', () => {
    const { onChange, handle } = renderSplitter()
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 460, pointerId: 1 })
    // Dragging the left edge 40 px left makes the panel 40 px wider.
    expect(onChange).toHaveBeenLastCalledWith(360)
  })

  it('stays within its limits', () => {
    const { onChange, handle } = renderSplitter()
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 0, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(560)
  })

  it('resizes with the arrow keys', () => {
    const { onChange, handle } = renderSplitter()
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(336)
  })
})
