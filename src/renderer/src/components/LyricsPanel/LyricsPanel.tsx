import { useState } from 'react'
import { t } from '@shared/copy'
import { SongLyrics, formatOffset, isTimed } from '../../state/lyrics/lyrics'
import { HelpTip } from '../ui/HelpTip'
import { useShortcuts } from '../../state/commands/shortcuts'
import { IconButton } from '../ui/IconButton'
import { LyricsSearch } from './LyricsSearch'
import { LyricsView } from './LyricsView'
import { NUDGE_SEC } from './constants'
import './LyricsPanel.css'

interface Props {
  songName: string
  lyrics: SongLyrics | null | undefined
  /** Playhead position in seconds. */
  position: number
  /** Lyrics can't be changed (while recording or saving). */
  locked: boolean
  onSeek(sec: number): void
  onChange(lyrics: SongLyrics): void
  /** Moves every line by this many seconds (an undoable edit). */
  onNudge(bySec: number): void
  onClose(): void
}

/** The song’s words beside the timeline, found online and following the playhead. */
export function LyricsPanel({
  songName,
  lyrics,
  position,
  locked,
  onSeek,
  onChange,
  onNudge,
  onClose
}: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const [searching, setSearching] = useState(false)
  const shown = searching ? null : lyrics
  const showSearch = !shown

  return (
    <aside className="lyrics-panel" aria-label={t('lyrics.label')}>
      <header className="lyrics-header">
        <div className="lyrics-heading">
          <h2>{t('lyrics.title')}</h2>
          {shown && (
            <span className="lyrics-song">
              {shown.artist
                ? t('lyrics.byArtist', { title: shown.title, artist: shown.artist })
                : shown.title}
            </span>
          )}
        </div>
        {lyrics && (
          <IconButton
            icon={showSearch ? 'back' : 'search'}
            label={showSearch ? t('lyrics.backToLyrics') : t('lyrics.change')}
            disabled={locked}
            onClick={() => setSearching(!showSearch)}
          />
        )}
        <IconButton
          icon="hidePanel"
          label={t('lyrics.hide')}
          title={shortcuts.label(t('lyrics.hide'), 'toggleLyrics')}
          onClick={onClose}
        />
      </header>

      {!shown ? (
        <LyricsSearch
          songName={songName}
          disabled={locked}
          onPick={(picked) => {
            onChange(picked)
            setSearching(false)
          }}
        />
      ) : (
        <>
          {isTimed(shown) ? (
            <div className="lyrics-timing">
              <IconButton
                icon="minus"
                iconSize="secondary"
                label={t('lyrics.earlier')}
                disabled={locked}
                onClick={() => onNudge(-NUDGE_SEC)}
              />
              <span className="lyrics-offset">{formatOffset(shown.offsetSec)}</span>
              <IconButton
                icon="plus"
                iconSize="secondary"
                label={t('lyrics.later')}
                disabled={locked}
                onClick={() => onNudge(NUDGE_SEC)}
              />
              <HelpTip text={t('lyrics.timingHint')} />
            </div>
          ) : (
            <p className="lyrics-note">{t('lyrics.untimed')}</p>
          )}
          <LyricsView lyrics={shown} position={position} onSeek={onSeek} />
        </>
      )}
    </aside>
  )
}
