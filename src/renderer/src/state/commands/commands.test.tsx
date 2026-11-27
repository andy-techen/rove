import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { onCommand, useShortcutKeys } from './commands'
import { applyOverrides } from './keymap'

const listen = () => {
  renderHook(() => useShortcutKeys())
  const heard = vi.fn()
  onCommand(heard)
  return heard
}

describe('shortcut keys', () => {
  it('runs a rebound shortcut from its new keys, not its old ones', () => {
    applyOverrides({ skipBack: 'Home' })
    const heard = listen()
    fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Home', code: 'Home' })
    expect(heard.mock.calls).toEqual([['skipBack']])
  })

  it('leaves Space to a focused text field', () => {
    const heard = listen()
    render(<input aria-label="Name" />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: ' ', code: 'Space' })
    expect(heard).not.toHaveBeenCalled()
  })

  it('lets Space press a button reached with Tab instead of playing', async () => {
    const heard = listen()
    const pressed = vi.fn()
    render(
      <button type="button" onClick={pressed}>
        Mute
      </button>
    )
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(pressed).toHaveBeenCalled()
    expect(heard).not.toHaveBeenCalled()
  })
})
