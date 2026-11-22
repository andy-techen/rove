import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from '.'

describe('Tooltip', () => {
  it('explains a control on hover and goes away when the pointer leaves', async () => {
    render(
      <Tooltip text="Redo (⇧⌘Z)">
        <button type="button">Redo</button>
      </Tooltip>
    )
    await userEvent.hover(screen.getByRole('button', { name: 'Redo' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Redo (⇧⌘Z)')
    await userEvent.unhover(screen.getByRole('button', { name: 'Redo' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows straight away when the control is reached with the keyboard', async () => {
    render(
      <Tooltip text="Mute Vocal 1">
        <button type="button">M</button>
      </Tooltip>
    )
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Mute Vocal 1')
  })

  it('shows inside an open dialog, so it sits above the dialog, not behind it', async () => {
    render(
      <dialog open>
        <Tooltip text="Loudness help">
          <button type="button">?</button>
        </Tooltip>
      </dialog>
    )
    await userEvent.tab()
    expect((await screen.findByRole('tooltip')).closest('dialog')).not.toBeNull()
  })
})
