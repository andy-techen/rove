import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogGenre, CatalogLanguage, CatalogSong } from '@shared/catalog'
import { t } from '@shared/copy'
import type { WishlistItem } from '@shared/wishlist'
import { Icon } from '../ui/Icon'
import { useOutsideClose } from '../ui/useOutsideClose'
import { IconButton } from '../ui/IconButton'
import { SearchField } from '../ui/SearchField'
import { cx } from '../ui/cx'

type State =
  { kind: 'loading' } | { kind: 'ready'; items: CatalogSong[]; total: number } | { kind: 'error' }

// Filter groups, defined as data so adding another group (year, duration, tempo…)
// means one more entry here plus its copy keys. Each group holds a set of selected
// values; an empty set means "don't narrow by this group".
type CopyKey = Parameters<typeof t>[0]
type GroupId = 'language' | 'genre' | 'tag'
interface FilterOption {
  value: string
  labelKey: CopyKey
}
interface FilterGroup {
  id: GroupId
  labelKey: CopyKey
  options: FilterOption[]
}

// A small starter set of tags. A real catalog ships with its own facet API; this list
// mirrors what the seed uses so each option matches a few songs.
const TAG_OPTIONS: FilterOption[] = [
  { value: 'love', labelKey: 'songbook.explore.tags.love' },
  { value: 'classic', labelKey: 'songbook.explore.tags.classic' },
  { value: 'movie', labelKey: 'songbook.explore.tags.movie' },
  { value: 'karaoke-classic', labelKey: 'songbook.explore.tags.karaoke-classic' }
]

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'language',
    labelKey: 'songbook.explore.languageLabel',
    options: [
      { value: 'en', labelKey: 'songbook.explore.languages.en' },
      { value: 'zh-Hant', labelKey: 'songbook.explore.languages.zh-Hant' }
    ]
  },
  {
    id: 'genre',
    labelKey: 'songbook.explore.genreLabel',
    options: [
      { value: 'pop', labelKey: 'songbook.explore.genres.pop' },
      { value: 'rock', labelKey: 'songbook.explore.genres.rock' },
      { value: 'ballad', labelKey: 'songbook.explore.genres.ballad' },
      { value: 'folk', labelKey: 'songbook.explore.genres.folk' }
    ]
  },
  { id: 'tag', labelKey: 'songbook.explore.tagLabel', options: TAG_OPTIONS }
]

type Filters = Record<GroupId, string[]>
const EMPTY_FILTERS: Filters = { language: [], genre: [], tag: [] }

/**
 * A curated catalog to browse. The singer searches by song or artist, and the funnel
 * icon beside the search reveals a row of filter dropdowns (language, genre, tag).
 * Each filter is a multi-select; "Add" copies the chosen song to the wishlist.
 */
export function Explore(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [wishlist, setWishlist] = useState<WishlistItem[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Keep the previous list visible while the next search resolves, so typing in the
    // search box doesn't flash "loading" between every keystroke.
    let cancelled = false
    window.api.searchCatalog(toSearchOptions(query, filters)).then(
      (result) => !cancelled && setState({ kind: 'ready', ...result }),
      () => !cancelled && setState({ kind: 'error' })
    )
    return () => {
      cancelled = true
    }
  }, [query, filters])

  useEffect(() => {
    let cancelled = false
    window.api.listWishlist().then(
      (items) => !cancelled && setWishlist(items),
      () => !cancelled && setWishlist([])
    )
    return () => {
      cancelled = true
    }
  }, [])

  const inWishlist = useMemo(() => {
    const set = new Set<string>()
    for (const item of wishlist ?? []) set.add(wishlistKey(item.name, item.artist))
    return set
  }, [wishlist])

  const activeCount = FILTER_GROUPS.reduce((n, group) => n + filters[group.id].length, 0)

  const add = async (song: CatalogSong): Promise<void> => {
    setAdding(song.id)
    setError(null)
    try {
      const next = await window.api.addToWishlist(song.name, song.artist)
      setWishlist(next)
    } catch {
      setError(t('songbook.explore.addFailed'))
    } finally {
      setAdding(null)
    }
  }

  const toggleValue = (id: GroupId, value: string): void => {
    setFilters((prev) => {
      const cur = prev[id]
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
      return { ...prev, [id]: next }
    })
  }

  return (
    <>
      <div className="explore-search-row">
        <SearchField
          className="songbook-search explore-search"
          label={t('songbook.explore.searchLabel')}
          placeholder={t('songbook.explore.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <IconButton
          icon="tune"
          label={
            activeCount > 0
              ? t('songbook.explore.filtersActive', { count: activeCount })
              : t('songbook.explore.filters')
          }
          aria-expanded={filtersOpen}
          aria-pressed={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        />
      </div>

      {filtersOpen && (
        <div className="explore-filter-row" role="group" aria-label={t('songbook.explore.filters')}>
          {FILTER_GROUPS.map((group) => (
            <FilterDropdown
              key={group.id}
              group={group}
              selected={filters[group.id]}
              onToggle={(value) => toggleValue(group.id, value)}
              onClear={() => setFilters((prev) => ({ ...prev, [group.id]: [] }))}
            />
          ))}
          {FILTER_GROUPS.flatMap((group) =>
            filters[group.id].map((value) => {
              const option = group.options.find((o) => o.value === value)
              const valueLabel = option ? t(option.labelKey) : value
              return (
                <button
                  key={`${group.id}:${value}`}
                  type="button"
                  className="explore-active-chip"
                  aria-label={t('songbook.explore.removeFilter', {
                    name: t(group.labelKey),
                    value: valueLabel
                  })}
                  onClick={() => toggleValue(group.id, value)}
                >
                  <span>
                    {t(group.labelKey)}: {valueLabel}
                  </span>
                  <Icon name="close" size="secondary" />
                </button>
              )
            })
          )}
          {activeCount > 0 && (
            <button
              type="button"
              className="explore-active-clear"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              {t('songbook.explore.clearAll')}
            </button>
          )}
        </div>
      )}

      <div className="explore-results">
        {state.kind === 'loading' && <p className="songbook-note">{t('songbook.loading')}</p>}
        {state.kind === 'error' && (
          <p className="songbook-note songbook-error">{t('songbook.explore.error')}</p>
        )}
        {state.kind === 'ready' && state.items.length === 0 && (
          <p className="songbook-note">{t('songbook.explore.noMatches')}</p>
        )}

        {state.kind === 'ready' && state.items.length > 0 && (
          <ul className="songbook-list">
            {state.items.map((song) => {
              const already = inWishlist.has(wishlistKey(song.name, song.artist))
              const busy = adding === song.id
              return (
                <li key={song.id} className="songbook-item explore-item">
                  <span className="songbook-title">
                    <span className="songbook-name">{song.name}</span>
                    <span className="songbook-artist">{song.artist}</span>
                  </span>
                  <span className="explore-tags">
                    <span className="explore-tag">
                      {t(`songbook.explore.languages.${song.language}`)}
                    </span>
                    {song.songType !== 'solo' && (
                      <span className="explore-tag">
                        {t(`songbook.explore.songTypes.${song.songType}`)}
                      </span>
                    )}
                  </span>
                  <IconButton
                    icon={already ? 'check' : 'plus'}
                    iconSize="secondary"
                    className="songbook-row-action"
                    disabled={already || busy}
                    label={
                      already
                        ? t('songbook.explore.addedLabel', { name: song.name })
                        : t('songbook.explore.addLabel', { name: song.name })
                    }
                    onClick={() => void add(song)}
                  />
                </li>
              )
            })}
          </ul>
        )}
        {error && <p className="songbook-note songbook-error">{error}</p>}
      </div>
    </>
  )
}

interface FilterDropdownProps {
  group: FilterGroup
  selected: string[]
  onToggle(value: string): void
  onClear(): void
}

/** One filter as a button that opens a checkbox list. */
function FilterDropdown({
  group,
  selected,
  onToggle,
  onClear
}: FilterDropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  useOutsideClose(wrapper, open, () => setOpen(false))

  const label = selected.length
    ? t('songbook.explore.filterSummary', {
        name: t(group.labelKey),
        count: selected.length
      })
    : t(group.labelKey)

  return (
    <div ref={wrapper} className={cx('explore-filter', selected.length > 0 && 'active')}>
      <button
        type="button"
        className="explore-filter-toggle"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <Icon name="chevronDown" size="secondary" />
      </button>
      {open && (
        <div className="explore-filter-popover" role="group" aria-label={t(group.labelKey)}>
          {group.options.map((option) => (
            <label key={option.value} className="explore-filter-option">
              <input
                type="checkbox"
                name={group.id}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className="explore-filter-clear" onClick={onClear}>
              {t('songbook.explore.clearGroup')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function toSearchOptions(
  query: string,
  filters: Filters
): Parameters<typeof window.api.searchCatalog>[0] {
  return {
    query,
    ...(filters.language.length && { languages: filters.language as CatalogLanguage[] }),
    ...(filters.genre.length && { genres: filters.genre as CatalogGenre[] }),
    ...(filters.tag.length && { tags: filters.tag })
  }
}

// Treat two wishlist entries as the same song when the name and artist match; a name
// alone collides on common titles ("Dreams"), so the artist belongs in the key too.
function wishlistKey(name: string, artist?: string): string {
  return `${name.toLocaleLowerCase()}::${(artist ?? '').toLocaleLowerCase()}`
}
