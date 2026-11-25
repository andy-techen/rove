import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import type { MenuAction } from '@shared/menu'
import { createFakeApi } from '../../test/fakeApi'
import { AppDialog, Section, useAppDialog } from '.'

/** The dialog as App wires it: closed until a command opens it. */
function Harness() {
  const dialog = useAppDialog()
  return dialog.section ? (
    <AppDialog section={dialog.section} onSection={dialog.show} onClose={dialog.close} />
  ) : null
}

const fireMenu = (action: MenuAction) =>
  act(() => (window.api as ReturnType<typeof createFakeApi>).fireMenu(action))

const openAt = (section: Section) => {
  render(<AppDialog section={section} onSection={vi.fn()} onClose={vi.fn()} />)
  return userEvent.setup()
}

const tab = (section: Section) => screen.getByRole('tab', { name: t(`appDialog.${section}`) })

const changeButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`shortcut for ${label} `) })

describe('AppDialog', () => {
  it('opens at Settings from the Settings command', () => {
    render(<Harness />)
    fireMenu('settings')
    expect(screen.getByRole('dialog', { name: t('appDialog.settings') })).toBeInTheDocument()
    expect(tab('settings')).toHaveAttribute('aria-selected', 'true')
  })

  it('lists the sections in order: your voice, settings, shortcuts', () => {
    openAt('settings')
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(
      ['voice', 'settings', 'shortcuts'].map((s) => t(`appDialog.${s as Section}`))
    )
  })

  it('switches section when a sidebar item is clicked', async () => {
    render(<Harness />)
    fireMenu('settings')
    await userEvent.click(tab('shortcuts'))
    expect(screen.getByRole('tabpanel', { name: t('appDialog.shortcuts') })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('moves between sections with the arrow keys, wrapping round', async () => {
    render(<Harness />)
    fireMenu('settings')
    tab('settings').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(tab('shortcuts')).toHaveFocus()
    expect(tab('shortcuts')).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(tab('voice')).toHaveAttribute('aria-selected', 'true')
  })

  it('closes from the close button', async () => {
    render(<Harness />)
    fireMenu('settings')
    await userEvent.click(screen.getByRole('button', { name: t('appDialog.close') }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Esc', () => {
    render(<Harness />)
    fireMenu('settings')
    // jsdom doesn't close a modal on Esc; the browser does, and fires close.
    fireEvent(screen.getByRole('dialog'), new Event('close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('AppDialog size', () => {
  it('opens at the size it was last dragged to', () => {
    localStorage.setItem('rove.appDialog.width', '700')
    localStorage.setItem('rove.appDialog.height', '500')
    openAt('settings')
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.getPropertyValue('--app-dialog-width')).toBe('700px')
    expect(dialog.style.getPropertyValue('--app-dialog-height')).toBe('500px')
    localStorage.clear()
  })
})

describe('AppDialog settings', () => {
  it('shows where new songs are saved and changes it', async () => {
    vi.mocked(window.api.getSongsFolder).mockResolvedValue('/Users/sam/Music/Rove')
    vi.mocked(window.api.chooseSongsFolder).mockResolvedValue('/Users/sam/Songs')
    const user = openAt('settings')
    expect(await screen.findByText('/Users/sam/Music/Rove')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('settings.changeFolder') }))
    expect(await screen.findByText('/Users/sam/Songs')).toBeInTheDocument()
  })

  it('keeps the folder when choosing is cancelled', async () => {
    vi.mocked(window.api.getSongsFolder).mockResolvedValue('/Users/sam/Music/Rove')
    vi.mocked(window.api.chooseSongsFolder).mockResolvedValue(null)
    const user = openAt('settings')
    await user.click(await screen.findByRole('button', { name: t('settings.changeFolder') }))
    expect(screen.getByText('/Users/sam/Music/Rove')).toBeInTheDocument()
  })
})

describe('AppDialog shortcuts', () => {
  it('says how to change a shortcut above the shortcuts', () => {
    openAt('shortcuts')
    expect(screen.getByText(t('keymap.hint'))).toBeInTheDocument()
  })

  it('lists every shortcut with its keys, in two tables side by side', () => {
    openAt('shortcuts')
    const row = screen.getByRole('row', { name: new RegExp(t('keymap.redo')) })
    expect(row).toHaveTextContent('⇧⌘Z')
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('rebinds a shortcut to the keys pressed next', async () => {
    const user = openAt('shortcuts')
    await user.click(changeButton('Split Clip'))
    expect(changeButton('Split Clip')).toHaveTextContent(t('keymap.pressKeys'))
    await user.keyboard('{Alt>}k{/Alt}')
    expect(window.api.setKeymap).toHaveBeenCalledWith({ split: 'Alt+K' })
    expect(await screen.findByText('⌥K')).toBeInTheDocument()
  })

  it('refuses keys another shortcut already uses', async () => {
    const user = openAt('shortcuts')
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Meta>}s{/Meta}')
    expect(screen.getByRole('alert')).toHaveTextContent(
      t('keymap.taken', { keys: '⌘S', label: t('keymap.save') })
    )
    expect(window.api.setKeymap).not.toHaveBeenCalled()
  })

  it('cancels with Esc and puts changed shortcuts back on reset', async () => {
    const user = openAt('shortcuts')
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Escape}')
    expect(changeButton('Split Clip')).toHaveTextContent('⌘T')
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Alt>}k{/Alt}')
    await user.click(await screen.findByRole('button', { name: /original shortcut for Split/ }))
    expect(window.api.setKeymap).toHaveBeenLastCalledWith({})
  })

  it('puts every shortcut back from the reset icon in the header', async () => {
    const user = openAt('shortcuts')
    await user.click(changeButton('Split Clip'))
    await user.keyboard('{Alt>}k{/Alt}')
    await screen.findByText('⌥K')
    await user.click(screen.getByRole('button', { name: t('keymap.resetAll') }))
    expect(window.api.setKeymap).toHaveBeenLastCalledWith({})
  })
})
