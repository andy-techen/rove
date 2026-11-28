import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogSong } from '@shared/online/catalog'
import { t } from '@shared/copy'
import { scrollIntoView } from '../../test/intersection'
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
  genre: 'ballad',
  hasSyncedLyrics: true
}

const filtersButton = () => screen.getByRole('button', { name: t('songbook.explore.filters') })
const openFilters = (): Promise<void> => userEvent.click(filtersButton())
const filter = (label: 'languageLabel' | 'genreLabel' | 'tagLabel') =>
  screen.queryByRole('button', { name: new RegExp(t(`songbook.explore.${label}`)) })

/** Explore with the first page of the catalog shown. */
async function renderExplore() {
  render(<Explore />)
  await screen.findByText('Dreams')
}

describe('Explore', () => {
  beforeEach(() => {
    vi.mocked(window.api.searchCatalog).mockResolvedValue({
      items: [dreams, yueliang],
      total: 2
    })
    vi.mocked(window.api.catalogFacets).mockResolvedValue({
      languages: ['en', 'zh-Hant'],
      genres: ['rock', 'ballad'],
      tags: ['love'],
      syncedLyrics: true
    })
    vi.mocked(window.api.listWishlist).mockResolvedValue([])
  })
  afterEach(() => vi.clearAllMocks())

  it('shows catalog songs with their language tag', async () => {
    await renderExplore()
    expect(screen.getByText('Fleetwood Mac')).toBeInTheDocument()
    expect(screen.getAllByText(t('songbook.explore.languages.en')).length).toBeGreaterThan(0)
  })

  it('marks songs that have synced lyrics', async () => {
    await renderExplore()
    expect(screen.getAllByText(t('songbook.explore.syncedLyrics'))).toHaveLength(1)
  })

  it('only offers filters that some catalog song has', async () => {
    vi.mocked(window.api.catalogFacets).mockResolvedValue({
      languages: ['en'],
      genres: ['rock'],
      tags: [],
      syncedLyrics: false
    })
    await renderExplore()
    await openFilters()
    expect(filter('tagLabel')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: t('songbook.explore.syncedLyrics') })
    ).not.toBeInTheDocument()
    await userEvent.click(filter('genreLabel')!)
    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('value'))).toEqual([
      'rock'
    ])
  })

  it('loads the next page when the end of the list scrolls into view', async () => {
    vi.mocked(window.api.searchCatalog).mockImplementation(async ({ offset }) =>
      offset ? { items: [yueliang], total: 2 } : { items: [dreams], total: 2 }
    )
    const { container } = render(<Explore />)
    await screen.findByText('Dreams')
    scrollIntoView(container.querySelector('.explore-list-end')!)
    expect(await screen.findByText(yueliang.name)).toBeInTheDocument()
    expect(screen.getByText('Dreams')).toBeInTheDocument()
    expect(container.querySelector('.explore-list-end')).not.toBeInTheDocument()
  })

  it('passes the search query to the catalog as the singer types', async () => {
    await renderExplore()
    await userEvent.type(
      screen.getByRole('searchbox', { name: t('songbook.explore.searchLabel') }),
      'moon'
    )
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({ query: 'moon' })
  })

  it('reveals a row of filters, shown as pressed, when the funnel icon is pressed', async () => {
    await renderExplore()
    expect(filter('languageLabel')).not.toBeInTheDocument()
    expect(filtersButton()).toHaveAttribute('aria-pressed', 'false')
    await openFilters()
    expect(filtersButton()).toHaveAttribute('aria-pressed', 'true')
    // Each filter group appears as its own expandable button in the row.
    expect(filter('languageLabel')).toBeInTheDocument()
    expect(filter('genreLabel')).toBeInTheDocument()
    expect(filter('tagLabel')).toBeInTheDocument()
  })

  it('narrows to a genre chosen from its dropdown', async () => {
    await renderExplore()
    await openFilters()
    await userEvent.click(filter('genreLabel')!)
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
    await renderExplore()
    await openFilters()
    await userEvent.click(filter('tagLabel')!)
    await userEvent.click(screen.getByRole('checkbox', { name: t('songbook.explore.tags.love') }))
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({ query: '', tags: ['love'] })
  })

  it('narrows to songs with synced lyrics when that filter is on', async () => {
    await renderExplore()
    await openFilters()
    const synced = screen.getByRole('button', { name: t('songbook.explore.syncedLyrics') })
    await userEvent.click(synced)
    expect(synced).toHaveAttribute('aria-pressed', 'true')
    expect(window.api.searchCatalog).toHaveBeenLastCalledWith({ query: '', syncedLyrics: true })
  })

  it('adds a song to the wishlist and marks it as added', async () => {
    vi.mocked(window.api.addToWishlist).mockResolvedValue([
      { id: 'w1', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: 0 }
    ])
    await renderExplore()
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
    await renderExplore()
    expect(
      await screen.findByRole('button', {
        name: t('songbook.explore.addedLabel', { name: 'Dreams' })
      })
    ).toBeDisabled()
  })
})
