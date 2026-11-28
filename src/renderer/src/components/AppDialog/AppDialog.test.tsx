import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { fireMenu } from '../../test/fakeApi'
import { AppDialog, Section, useAppDialog } from '.'

/** The dialog as App wires it: closed until a command opens it. */
function Harness() {
  const dialog = useAppDialog()
  return dialog.section ? (
    <AppDialog
      section={dialog.section}
      onSection={dialog.show}
      onClose={dialog.close}
      onMicCheck={vi.fn()}
    />
  ) : null
}

const openAt = (section: Section, onMicCheck = vi.fn()) => {
  render(
    <AppDialog section={section} onSection={vi.fn()} onClose={vi.fn()} onMicCheck={onMicCheck} />
  )
  return userEvent.setup()
}

const tab = (section: Section) => screen.getByRole('tab', { name: t(`appDialog.${section}`) })

const changeButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`shortcut for ${label} `) })

describe('AppDialog', () => {
  it.each(['voice', 'settings', 'premium', 'shortcuts'] as const)(
    'opens at %s from its menu item',
    (section) => {
      render(<Harness />)
      fireMenu(section)
      expect(screen.getByRole('dialog', { name: t(`appDialog.${section}`) })).toBeInTheDocument()
      expect(tab(section)).toHaveAttribute('aria-selected', 'true')
    }
  )

  it('lists the sections in order: your voice, settings, premium, shortcuts', () => {
    openAt('settings')
    expect(screen.getAllByRole('tab').map((el) => el.textContent)).toEqual(
      ['voice', 'settings', 'premium', 'shortcuts'].map((s) => t(`appDialog.${s as Section}`))
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
    fireMenu('premium')
    tab('premium').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(tab('shortcuts')).toHaveFocus()
    expect(tab('shortcuts')).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(tab('voice')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('AppDialog settings', () => {
  const folders = [
    ['songs', 'getSongsFolder', 'chooseSongsFolder', 'settings.changeSongsFolder'],
    ['exports', 'getExportsFolder', 'chooseExportsFolder', 'settings.changeExportsFolder']
  ] as const

  it.each(folders)('shows where %s are saved and changes it', async (kind, get, choose, change) => {
    vi.mocked(window.api[get]).mockResolvedValueOnce(`/Users/sam/${kind}`)
    vi.mocked(window.api[choose]).mockResolvedValueOnce(`/Users/sam/new ${kind}`)
    const user = openAt('settings')
    expect(await screen.findByText(`/Users/sam/${kind}`)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t(change) }))
    expect(await screen.findByText(`/Users/sam/new ${kind}`)).toBeInTheDocument()
  })

  it('keeps the folder when choosing is cancelled', async () => {
    vi.mocked(window.api.getSongsFolder).mockResolvedValueOnce('/Users/sam/Music/Rove')
    const user = openAt('settings')
    await user.click(await screen.findByRole('button', { name: t('settings.changeSongsFolder') }))
    expect(screen.getByText('/Users/sam/Music/Rove')).toBeInTheDocument()
  })

  it('switches the theme', async () => {
    const user = openAt('settings')
    await user.click(screen.getByRole('button', { name: t('menu.themes.dark') }))
    expect(window.api.setTheme).toHaveBeenCalledWith('dark')
  })

  it('opens the mic check', async () => {
    const onMicCheck = vi.fn()
    const user = openAt('settings', onMicCheck)
    await user.click(screen.getByRole('button', { name: t('settings.checkMicrophone') }))
    expect(onMicCheck).toHaveBeenCalled()
  })
})

describe('AppDialog shortcuts', () => {
  it('says how to change a shortcut above the shortcuts', () => {
    openAt('shortcuts')
    expect(screen.getByText(t('keymap.hint'))).toBeInTheDocument()
  })

  it('lists every shortcut with its keys, in two tables side by side', () => {
    openAt('shortcuts')
    // Its keys follow the name directly, so the pattern matches Redo alone.
    const redo = new RegExp(`shortcut for ${t('keymap.redo')} \\(`)
    expect(screen.getByRole('button', { name: redo })).toHaveTextContent('⇧⌘Z')
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
