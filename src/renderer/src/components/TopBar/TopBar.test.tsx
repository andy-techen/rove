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
  it.each<{
    does: string
    name: string
    prop: 'onSwitch' | 'onClose' | 'onNew' | 'onSave'
    args?: unknown[]
  }>([
    {
      does: 'switches to another song when its tab is clicked',
      name: 'Untitled Song',
      prop: 'onSwitch',
      args: ['b']
    },
    {
      does: 'closes a song from its tab',
      name: t('topBar.close', { name: 'Untitled Song' }),
      prop: 'onClose',
      args: ['b']
    },
    { does: 'opens a new song from the tab bar', name: t('topBar.newSong'), prop: 'onNew' },
    {
      does: 'saves on demand from the button beside the save status',
      name: t('keymap.save'),
      prop: 'onSave'
    }
  ])('$does', async ({ name, prop, args }) => {
    const props = renderBar()
    await userEvent.click(screen.getByRole('button', { name }))
    expect(props[prop]).toHaveBeenCalled()
    if (args) expect(props[prop]).toHaveBeenCalledWith(...args)
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

  it('shows that the song is saved, and when', async () => {
    renderBar()
    expect(screen.getByRole('status')).toHaveTextContent(t('save.justNow'))
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
