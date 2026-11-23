import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogSong } from '@shared/catalog'
import { t } from '@shared/copy'
import { Explore } from './Explore'

const dreams: CatalogSong = {
  id: 'USAT29900609',
  name: 'Dreams',
  artist: 'Fleetwood Mac',
  language: 'en',
  songType: 'band',
  genre: 'rock'
}
const yueliang: CatalogSong = {
  id: 'TWA011600101',
  name: '月亮代表我的心',
  artist: '鄧麗君',
  language: 'zh-Hant',
  songType: 'solo',
  genre: 'ballad'
}

const openFilters = (): Promise<void> =>
  userEvent.click(screen.getByRole('button', { name: t('songbook.explore.filters') }))

describe('Explore', () => {
  beforeEach(() => {
    vi.mocked(window.api.searchCatalog).mockResolvedValue({
      items: [dreams, yueliang],
      total: 2
    })
    vi.mocked(window.api.listWishlist).mockResolvedValue([])
  })
  afterEach(() => vi.clearAllMocks())

  it('shows catalog songs with their language tag', async () => {
    render(<Explore />)
    expect(await screen.findByText('Dreams')).toBeInTheDocument()
    expect(screen.getByText('Fleetwood Mac')).toBeInTheDocument()
    expect(screen.getAllByText(t('songbook.explore.languages.en')).length).toBeGreaterThan(0)
  })

  it('passes the search query to the catalog as the singer types', async () => {
    render(<Explore />)
    await userEvent.type(
      screen.getByRole('searchbox', { name: t('songbook.explore.searchLabel') }),
      'moon'
    )
    await screen.findByText('Dreams')
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({ query: 'moon' })
  })

  it('reveals a row of filters when the funnel icon is pressed', async () => {
    render(<Explore />)
    await screen.findByText('Dreams')
    expect(
      screen.queryByRole('button', { name: /songbook.explore.languageLabel/i })
    ).not.toBeInTheDocument()
    await openFilters()
    // Each filter group appears as its own expandable button in the row.
    expect(
      screen.getByRole('button', { name: new RegExp(t('songbook.explore.languageLabel')) })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: new RegExp(t('songbook.explore.genreLabel')) })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: new RegExp(t('songbook.explore.tagLabel')) })
    ).toBeInTheDocument()
  })

  it('narrows to a genre chosen from its dropdown', async () => {
    render(<Explore />)
    await screen.findByText('Dreams')
    await openFilters()
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(t('songbook.explore.genreLabel')) })
    )
    await userEvent.click(
      screen.getByRole('checkbox', { name: t('songbook.explore.genres.ballad') })
    )
    await userEvent.click(screen.getByRole('checkbox', { name: t('songbook.explore.genres.rock') }))
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({
      query: '',
      genres: ['ballad', 'rock']
    })
  })

  it('narrows to any song with one of the ticked tags', async () => {
    render(<Explore />)
    await screen.findByText('Dreams')
    await openFilters()
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(t('songbook.explore.tagLabel')) })
    )
    await userEvent.click(screen.getByRole('checkbox', { name: t('songbook.explore.tags.love') }))
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({ query: '', tags: ['love'] })
  })

  it('shows the filter icon as pressed while the row is open', async () => {
    render(<Explore />)
    const toggle = screen.getByRole('button', { name: t('songbook.explore.filters') })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds a song to the wishlist and marks it as added', async () => {
    vi.mocked(window.api.addToWishlist).mockResolvedValue([
      { id: 'w1', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: 0 }
    ])
    render(<Explore />)
    await userEvent.click(
      await screen.findByRole('button', {
        name: t('songbook.explore.addLabel', { name: 'Dreams' })
      })
    )
    expect(window.api.addToWishlist).toHaveBeenCalledWith('Dreams', 'Fleetwood Mac')
    expect(
      await screen.findByRole('button', {
        name: t('songbook.explore.addedLabel', { name: 'Dreams' })
      })
    ).toBeDisabled()
  })

  it('marks songs already on the wishlist as added from the start', async () => {
    vi.mocked(window.api.listWishlist).mockResolvedValue([
      { id: 'w1', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: 0 }
    ])
    render(<Explore />)
    expect(
      await screen.findByRole('button', {
        name: t('songbook.explore.addedLabel', { name: 'Dreams' })
      })
    ).toBeDisabled()
  })
})
