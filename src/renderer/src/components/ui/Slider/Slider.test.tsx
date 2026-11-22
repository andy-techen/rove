import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from '.'

function renderSlider(props: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onChange = vi.fn()
  render(<Slider label="Position" min={-100} max={100} value={0} onChange={onChange} {...props} />)
  return { onChange, slider: screen.getByRole('slider', { name: 'Position' }) }
}

describe('Slider', () => {
  it('reports where it was moved to', () => {
    const { onChange, slider } = renderSlider({ min: 0, max: 100, value: 50 })
    fireEvent.change(slider, { target: { value: '70' } })
    expect(onChange).toHaveBeenCalledWith(70)
  })

  it('clicks onto its centre when moved close to it', () => {
    const { onChange, slider } = renderSlider({ centre: 0, value: -40 })
    fireEvent.change(slider, { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('moves freely away from the centre', () => {
    const { onChange, slider } = renderSlider({ centre: 0 })
    fireEvent.change(slider, { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith(30)
  })
})
