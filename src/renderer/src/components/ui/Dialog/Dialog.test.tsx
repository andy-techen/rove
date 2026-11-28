import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from '.'

const open = (onClose = vi.fn()) => {
  render(
    <Dialog title="Export song" closeLabel="Close" sizeKey="test" onClose={onClose}>
      <button type="button">Export</button>
    </Dialog>
  )
  return onClose
}

describe('Dialog', () => {
  it('opens without focusing the close button, so no tooltip pops up', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Export song' })).toHaveFocus()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('still reaches its controls with Tab', async () => {
    open()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('opens at the size the singer last dragged it to', () => {
    localStorage.setItem('rove.test.width', '640')
    localStorage.setItem('rove.test.height', '480')
    open()
    const dialog = screen.getByRole('dialog', { name: 'Export song' })
    expect(dialog.style.getPropertyValue('--dialog-width')).toBe('640px')
    expect(dialog.style.getPropertyValue('--dialog-height')).toBe('480px')
    localStorage.clear()
  })

  it('closes from the close button', async () => {
    const onClose = open()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Esc', () => {
    const onClose = open()
    // jsdom doesn't close a modal on Esc; the browser does, and fires close.
    fireEvent(screen.getByRole('dialog'), new Event('close'))
    expect(onClose).toHaveBeenCalled()
  })
})
