import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { SongbookDialog } from '.'
import { relativeTime } from './relativeTime'

const NOW = new Date('2026-11-22T12:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000
const dreams = { id: 'w1', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: NOW }

function renderDialog(openFolders: string[] = []) {
  const props = {
    openFolders,
    onOpen: vi.fn(),
    onNew: vi.fn(),
    onImport: vi.fn(),
    onStart: vi.fn(),
    onClose: vi.fn()
  }
  render(<SongbookDialog {...props} />)
  return props
}

const songButton = (name: string) =>
  screen.findByRole('button', { name: t('songbook.item', { name }) })
const showWishlist = () =>
  userEvent.click(screen.getByRole('button', { name: t('songbook.views.wishlist') }))

describe('SongbookDialog', () => {
  beforeEach(() => {
    vi.mocked(window.api.listSongs).mockResolvedValue([
      { folder: 'Fly-Away', name: 'Fly Away', artist: 'Sam', modifiedAt: NOW - DAY },
      { folder: 'Sunset', name: 'Sunset', modifiedAt: NOW - 10 * DAY }
    ])
    vi.mocked(window.api.listWishlist).mockResolvedValue([dreams])
  })
  afterEach(() => vi.clearAllMocks())

  it('lists songs with their artist and opens one when clicked', async () => {
    const { onOpen } = renderDialog()
    await userEvent.click(await songButton('Fly Away'))
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(onOpen).toHaveBeenCalledWith('Fly-Away')
  })

  it('imports a project file from the songs view', async () => {
    const { onImport } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: t('songFile.import') }))
    expect(onImport).toHaveBeenCalled()
  })

  it('moves a song to the Trash after confirming', async () => {
    renderDialog()
    await songButton('Sunset')
    await userEvent.click(
      screen.getByRole('button', { name: t('songbook.removeLabel', { name: 'Sunset' }) })
    )
    expect(screen.getByText(t('songbook.removeWarning'))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('songbook.remove') }))
    expect(window.api.removeSongbookSong).toHaveBeenCalledWith('Sunset')
    expect(screen.queryByText('Sunset')).not.toBeInTheDocument()
  })

  it('changes a song name and artist, and shows the new details', async () => {
    renderDialog()
    await songButton('Sunset')
    await userEvent.click(
      screen.getByRole('button', { name: t('songbook.editLabel', { name: 'Sunset' }) })
    )
    const artist = screen.getByRole('textbox', { name: t('newSong.artistLabel') })
    await userEvent.type(artist, 'Mira Ko{Enter}')
    expect(window.api.updateSongbookSong).toHaveBeenCalledWith(
      'Sunset',
      'Sunset',
      'Mira Ko',
      undefined
    )
    expect(await screen.findByText('Mira Ko')).toBeInTheDocument()
  })

  it("won't remove a song that's open in a tab", async () => {
    renderDialog(['Fly-Away'])
    await screen.findByRole('button', { name: t('songbook.itemOpen', { name: 'Fly Away' }) })
    const remove = screen.getByRole('button', {
      name: t('songbook.removeLabel', { name: 'Fly Away' })
    })
    expect(remove).toBeDisabled()
  })

  it('adds a song to the wishlist with an optional artist', async () => {
    vi.mocked(window.api.addToWishlist).mockResolvedValue([dreams])
    renderDialog()
    await showWishlist()
    await userEvent.click(screen.getByRole('button', { name: t('songbook.addToWishlistButton') }))
    await userEvent.type(screen.getByRole('textbox', { name: t('newSong.nameLabel') }), 'Dreams')
    await userEvent.type(
      screen.getByRole('textbox', { name: t('newSong.artistLabel') }),
      'Fleetwood Mac{Enter}'
    )
    expect(window.api.addToWishlist).toHaveBeenCalledWith('Dreams', 'Fleetwood Mac', undefined)
  })

  it('starts a real song from a wishlist item and takes it off the list', async () => {
    vi.mocked(window.api.listWishlist).mockResolvedValue([{ ...dreams, note: 'Lower key' }])
    const { onStart } = renderDialog()
    await showWishlist()
    await userEvent.click(
      await screen.findByRole('button', { name: t('songbook.startLabel', { name: 'Dreams' }) })
    )
    expect(window.api.removeFromWishlist).toHaveBeenCalledWith('w1')
    expect(onStart).toHaveBeenCalledWith('Dreams', 'Fleetwood Mac', 'Lower key')
  })

  it('adds a note to a wishlist song from its edit dialog and shows it', async () => {
    vi.mocked(window.api.updateWishlistItem).mockResolvedValue([{ ...dreams, note: 'Lower key' }])
    renderDialog()
    await showWishlist()
    await userEvent.click(
      await screen.findByRole('button', { name: t('songbook.editLabel', { name: 'Dreams' }) })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: t('newSong.noteLabel') }),
      'Lower key{Enter}'
    )
    expect(window.api.updateWishlistItem).toHaveBeenCalledWith(
      'w1',
      'Dreams',
      'Fleetwood Mac',
      'Lower key'
    )
    expect(await screen.findByText('Lower key')).toBeInTheDocument()
  })

  it('adds a note to one of your songs from its edit dialog', async () => {
    vi.mocked(window.api.updateSongbookSong).mockResolvedValue({
      folder: 'Sunset',
      name: 'Sunset',
      note: 'For Mum',
      modifiedAt: NOW
    })
    renderDialog()
    await songButton('Sunset')
    await userEvent.click(
      screen.getByRole('button', { name: t('songbook.editLabel', { name: 'Sunset' }) })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: t('newSong.noteLabel') }),
      'For Mum{Enter}'
    )
    expect(window.api.updateSongbookSong).toHaveBeenCalledWith(
      'Sunset',
      'Sunset',
      undefined,
      'For Mum'
    )
    expect(await screen.findByText('For Mum')).toBeInTheDocument()
  })
})

describe('Songbook search', () => {
  it('narrows the list to songs whose name or artist matches', async () => {
    renderDialog()
    await songButton('Sunset')
    await userEvent.type(screen.getByRole('searchbox', { name: t('songbook.searchLabel') }), 'sam')
    expect(screen.getByText('Fly Away')).toBeInTheDocument()
    expect(screen.queryByText('Sunset')).not.toBeInTheDocument()
  })
})

describe('relativeTime', () => {
  it('labels the last few days in words', () => {
    expect(relativeTime(NOW - 30 * 60 * 1000, NOW)).toBe(t('songbook.justNow'))
    expect(relativeTime(NOW - 5 * 60 * 60 * 1000, NOW)).toBe(t('songbook.today'))
    expect(relativeTime(NOW - 1.5 * DAY, NOW)).toBe(t('songbook.yesterday'))
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe(t('songbook.daysAgo', { days: 3 }))
  })

  it('falls back to a date beyond a week', () => {
    expect(relativeTime(NOW - 30 * DAY, NOW)).toBe(new Date(NOW - 30 * DAY).toLocaleDateString())
  })
})
