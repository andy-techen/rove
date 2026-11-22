import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Knob } from '.'

function renderKnob(props: Partial<Parameters<typeof Knob>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <Knob
      label="Speed"
      min={70}
      max={130}
      value={100}
      centre={100}
      onChange={onChange}
      {...props}
    />
  )
  return { onChange, knob: screen.getByRole('slider', { name: 'Speed' }) }
}

describe('Knob', () => {
  it('turns up when dragged upward', () => {
    const { onChange, knob } = renderKnob()
    const face = knob.parentElement!
    fireEvent.pointerDown(face, { button: 0, clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(face, { clientY: 120, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(130)
  })

  it('turns from the keyboard, through its slider', () => {
    // jsdom doesn't step range inputs on arrow keys; the browser does, firing this.
    const { onChange, knob } = renderKnob()
    fireEvent.change(knob, { target: { value: '101' } })
    expect(onChange).toHaveBeenCalledWith(101)
  })

  it('goes back to its centre on double-click', async () => {
    const { onChange, knob } = renderKnob({ value: 120 })
    await userEvent.dblClick(knob.parentElement!)
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('stays put while disabled', () => {
    const { onChange, knob } = renderKnob({ disabled: true })
    fireEvent.pointerDown(knob.parentElement!, { button: 0, clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(knob.parentElement!, { clientY: 100, pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
