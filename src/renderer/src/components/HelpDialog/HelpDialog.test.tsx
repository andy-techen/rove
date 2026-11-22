import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { HelpDialog } from './HelpDialog'

const changeButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`shortcut for ${label} `) })

const renderHelp = () => {
  render(<HelpDialog onClose={vi.fn()} />)
  return userEvent.setup()
}

describe('HelpDialog shortcuts', () => {
  it('lists every shortcut with its keys, in two tables side by side', () => {
    renderHelp()
    const row = screen.getByRole('row', { name: new RegExp(t('keymap.redo')) })
    expect(row).toHaveTextContent('⇧⌘Z')
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('rebinds a shortcut to the keys pressed next', async () => {
    const user = renderHelp()
    await user.click(changeButton('Split Clip'))
    expect(changeButton('Split Clip')).toHaveTextContent(t('keymap.pressKeys'))
    await user.keyboard('{Alt>}k{/Alt}')
    expect(window.api.setKeymap).toHaveBeenCalledWith({ split: 'Alt+K' })
    expect(await screen.findByText('⌥K')).toBeInTheDocument()
  })

  it('refuses keys another shortcut already uses', async () => {
    const user = renderHelp()
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Meta>}s{/Meta}')
    expect(screen.getByRole('alert')).toHaveTextContent(
      t('keymap.taken', { keys: '⌘S', label: t('keymap.save') })
    )
    expect(window.api.setKeymap).not.toHaveBeenCalled()
  })

  it('cancels with Esc and puts changed shortcuts back on reset', async () => {
    const user = renderHelp()
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Escape}')
    expect(changeButton('Split Clip')).toHaveTextContent('⌘T')
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Alt>}k{/Alt}')
    await user.click(await screen.findByRole('button', { name: /original shortcut for Split/ }))
    expect(window.api.setKeymap).toHaveBeenLastCalledWith({})
  })

  it('puts every shortcut back from the reset icon in the header', async () => {
    const user = renderHelp()
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Alt>}k{/Alt}')
    await screen.findByText('⌥K')
    await user.click(screen.getByRole('button', { name: t('keymap.resetAll') }))
    expect(window.api.setKeymap).toHaveBeenLastCalledWith({})
  })
})
