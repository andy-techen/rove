import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Welcome } from '.'

const entry = (name: string, modifiedAt = 0) => ({ folder: name, name, modifiedAt })

function renderWelcome() {
  const props = {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onImport: vi.fn(),
    onSongbook: vi.fn(),
    onOpenSong: vi.fn()
  }
  render(<Welcome {...props} />)
  return props
}

describe('Welcome', () => {
  it.each([
    { name: t('welcome.newSong'), prop: 'onNew' },
    { name: t('welcome.open'), prop: 'onOpen' },
    { name: t('welcome.import'), prop: 'onImport' },
    { name: t('welcome.songbook'), prop: 'onSongbook' }
  ] as const)('$prop runs from its button', async ({ name, prop }) => {
    const props = renderWelcome()
    await userEvent.click(screen.getByRole('button', { name }))
    expect(props[prop]).toHaveBeenCalledOnce()
  })

  it('opens a recent song by its folder', async () => {
    vi.mocked(window.api.listSongs).mockResolvedValueOnce([entry('Sunset'), entry('Rain')])
    const props = renderWelcome()
    await userEvent.click(
      await screen.findByRole('button', { name: t('welcome.openSong', { name: 'Rain' }) })
    )
    expect(props.onOpenSong).toHaveBeenCalledWith('Rain')
  })

  it('lists only the most recent few songs', async () => {
    const songs = Array.from({ length: 12 }, (_, i) => entry(`Song ${i}`))
    vi.mocked(window.api.listSongs).mockResolvedValueOnce(songs)
    renderWelcome()
    const list = await screen.findByRole('list', { name: t('welcome.recent') })
    expect(within(list).getAllByRole('listitem').length).toBeLessThan(songs.length)
  })
})
