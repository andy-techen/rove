import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { TopBar } from '.'

const tabs = [
  { id: 'a', name: 'Summer Demo' },
  { id: 'b', name: 'Untitled Song' }
]

function renderBar(overrides: Partial<Parameters<typeof TopBar>[0]> = {}) {
  const props = {
    tabs,
    activeId: 'a',
    disabled: false,
    saveState: { status: 'saved' as const, at: Date.now() },
    onRename: vi.fn(),
    onSwitch: vi.fn(),
    onMove: vi.fn(),
    onClose: vi.fn(),
    onNew: vi.fn(),
    onSongbook: vi.fn(),
    onSave: vi.fn(),
    canExport: true,
    onExport: vi.fn(),
    ...overrides
  }
  render(<TopBar {...props} />)
  return props
}

describe('TopBar', () => {
  it('switches to another song when its tab is clicked', async () => {
    const props = renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Untitled Song' }))
    expect(props.onSwitch).toHaveBeenCalledWith('b')
  })

  it('renames the active song on Enter, and cancels on Escape', async () => {
    const props = renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Summer Demo' }))
    await userEvent.clear(screen.getByRole('textbox', { name: t('topBar.songName') }))
    await userEvent.keyboard('Night Drive{Enter}')
    expect(props.onRename).toHaveBeenCalledOnce()
    expect(props.onRename).toHaveBeenCalledWith('Night Drive')

    await userEvent.click(screen.getByRole('button', { name: 'Summer Demo' }))
    await userEvent.keyboard('Nope{Escape}')
    expect(props.onRename).toHaveBeenCalledOnce()
  })

  it('closes a song and opens a new one from the tab bar', async () => {
    const props = renderBar()
    await userEvent.click(
      screen.getByRole('button', { name: t('topBar.close', { name: 'Untitled Song' }) })
    )
    await userEvent.click(screen.getByRole('button', { name: t('topBar.newSong') }))
    expect(props.onClose).toHaveBeenCalledWith('b')
    expect(props.onNew).toHaveBeenCalled()
  })

  it('shows the logo before the song tabs', () => {
    renderBar()
    expect(screen.getByRole('img', { name: t('app.name') })).toBeInTheDocument()
  })

  it('shows that the song is saved, and when', async () => {
    renderBar()
    expect(screen.getByRole('status')).toHaveTextContent(t('save.justNow'))
  })

  it('saves on demand from the button beside the save status', async () => {
    const props = renderBar()
    await userEvent.click(screen.getByRole('button', { name: t('keymap.save') }))
    expect(props.onSave).toHaveBeenCalled()
  })

  it('warns when the latest changes could not be saved', () => {
    renderBar({ saveState: { status: 'failed' } })
    expect(screen.getByRole('status')).toHaveTextContent(t('save.failed'))
  })

  it('moves a song by dragging its tab onto another', () => {
    const props = renderBar()
    const [first, second] = screen.getAllByRole('tab')
    fireEvent.dragStart(second)
    fireEvent.dragOver(first, { clientX: 0 })
    fireEvent.drop(first)
    expect(props.onMove).toHaveBeenCalledWith('b', 0)
  })

  it('hides the close button when only one song is open', () => {
    renderBar({ tabs: [tabs[0]] })
    expect(screen.queryByRole('button', { name: /^Close/ })).not.toBeInTheDocument()
  })

  it('names the theme in use and switches to the next one on click', async () => {
    vi.mocked(window.api.onTheme).mockImplementation((listener) => {
      listener('dark')
      return () => {}
    })
    renderBar()
    const button = screen.getByRole('button', {
      name: t('appearance.label', { theme: t('menu.themes.dark') })
    })
    await userEvent.click(button)
    expect(window.api.setTheme).toHaveBeenCalledWith('system')
  })
})
