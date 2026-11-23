import { useState } from 'react'
import { t } from '@shared/copy'
import { SongLyrics, lyricsFromResult, searchFromName } from '../../state/lyrics/lyrics'
import { formatDuration } from '../../state/song/project'
import { useLyricsSearch } from '../../state/lyrics/useLyricsSearch'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { SearchField } from '../ui/SearchField'

interface Props {
  /** The song's name, to search for to begin with. */
  songName: string
  disabled: boolean
  onPick(lyrics: SongLyrics): void
}

/** Find lyrics online by song and artist. */
export function LyricsSearch({ songName, disabled, onPick }: Props): React.JSX.Element {
  const { state, search } = useLyricsSearch()
  const [query, setQuery] = useState(() => searchFromName(songName))

  return (
    <div className="lyrics-body">
      <form
        className="lyrics-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) void search(query.trim())
        }}
      >
        <SearchField
          label={t('lyrics.searchLabel')}
          placeholder={t('lyrics.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button size="sm" type="submit" disabled={!query.trim() || state.status === 'searching'}>
          {t('lyrics.search')}
        </Button>
        <HelpTip text={t('lyrics.searchHint')} />
      </form>

      <div aria-live="polite" className="lyrics-status">
        {state.status === 'searching' && t('lyrics.searching')}
        {state.status === 'failed' && t('lyrics.searchFailed')}
        {state.status === 'done' && state.results.length === 0 && t('lyrics.noResults')}
      </div>

      {state.status === 'done' && state.results.length > 0 && (
        <ul className="lyrics-results">
          {state.results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="lyrics-result"
                disabled={disabled}
                onClick={() => onPick(lyricsFromResult(r))}
              >
                <span className="lyrics-result-title">{r.title}</span>
                <span className="lyrics-result-detail">
                  {t('lyrics.resultDetail', {
                    artist: r.artist,
                    duration: formatDuration(r.durationSec)
                  })}
                </span>
                {!r.synced && <span className="lyrics-badge">{t('lyrics.notSynced')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
