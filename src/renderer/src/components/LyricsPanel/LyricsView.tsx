import { useEffect, useRef } from 'react'
import { t } from '@shared/copy'
import { SongLyrics, activeLineIndex, lineStart } from '../../state/lyrics'
import { cx } from '../ui/cx'
import { scrollWithin } from '../ui/scrollWithin'

interface Props {
  lyrics: SongLyrics
  position: number
  onSeek(sec: number): void
}

/** The lines, with the one being sung lit and kept in view. Timed lines are clickable. */
export function LyricsView({ lyrics, position, onSeek }: Props): React.JSX.Element {
  const active = activeLineIndex(lyrics.lines, position, lyrics.offsetSec)
  const activeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => scrollWithin(listRef.current, activeRef.current), [active])

  return (
    <ol className="lyrics-lines" ref={listRef}>
      {lyrics.lines.map((line, i) => {
        const start = lineStart(line, lyrics.offsetSec)
        const state = cx('lyric', i === active && 'lyric-active', i < active && 'lyric-past')
        // Keys include the index: the same line (a chorus) can repeat.
        const key = `${i}:${line.time}`
        if (!line.text) {
          return (
            <li key={key} className="lyric-break" aria-hidden="true">
              {start !== null && t('lyrics.instrumental')}
            </li>
          )
        }
        return (
          <li key={key}>
            {start === null ? (
              <p className={state}>{line.text}</p>
            ) : (
              <button
                type="button"
                ref={i === active ? activeRef : undefined}
                className={state}
                aria-current={i === active ? 'true' : undefined}
                title={t('lyrics.goToLine', { line: line.text })}
                onClick={() => onSeek(start)}
              >
                {line.text}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
