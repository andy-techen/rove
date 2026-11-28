import { useEffect, useRef } from 'react'
import { t } from '@shared/copy'
import { ChordSegment } from '../../audio/music/chords'
import { activeChordIndex } from '../../state/chords/heard/chords'
import { chordName } from '../../state/chords/theory/noteNames'
import { formatDuration } from '../../state/ui/format'
import { HelpTip } from '../ui/HelpTip'
import { useShortcuts } from '../../state/commands/shortcuts'
import { IconButton } from '../ui/IconButton'
import { cx } from '../ui/cx'
import { scrollWithin } from '../ui/scrollWithin'
import { ChordDiagram } from './ChordDiagram'
import './ChordsPanel.css'

interface Props {
  /** The chords on the timeline; null while Rove is still listening. */
  chords: ChordSegment[] | null
  hasMusic: boolean
  /** The chords shown are the ones the singer wrote, not heard in the music. */
  fromChart?: boolean
  /** Playhead position in seconds. */
  position: number
  onSeek(sec: number): void
  onClose(): void
}

const nameOf = (segment: ChordSegment | undefined): string =>
  segment?.chord ? chordName(segment.chord) : t('chords.noChord')

/** The music's chords beside the timeline, following the playhead. */
export function ChordsPanel({
  chords,
  hasMusic,
  fromChart = false,
  position,
  onSeek,
  onClose
}: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const active = chords ? activeChordIndex(chords, position) : -1
  const current = chords?.[active]
  const upcoming = chords?.find((c, i) => i > active && c.start > position && c.chord)
  const activeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => scrollWithin(listRef.current, activeRef.current), [active])

  const message = fromChart
    ? null
    : !hasMusic
      ? t('chords.noMusic')
      : chords === null
        ? t('chords.listening')
        : chords.every((c) => !c.chord)
          ? t('chords.none')
          : null

  return (
    <section className="chords-panel" aria-label={t('chords.label')}>
      <header className="chords-header">
        <h2>
          {t('chords.title')}
          <HelpTip text={fromChart ? t('chords.yours') : t('chords.detected')} />
        </h2>
        <IconButton
          icon="hidePanel"
          label={t('chords.hide')}
          title={shortcuts.label(t('chords.hide'), 'toggleChords')}
          onClick={onClose}
        />
      </header>

      {message ? (
        <p className="chords-message">{message}</p>
      ) : (
        <>
          <div className="chords-now">
            <div className="chords-now-names" role="status">
              <span className="chords-now-label">{t('chords.now')}</span>
              <span className="chords-now-name">{nameOf(current)}</span>
              <span className="chords-now-label">{t('chords.next')}</span>
              <span className="chords-next-name">{nameOf(upcoming)}</span>
            </div>
            {current?.chord && <ChordDiagram chord={current.chord} />}
          </div>
          <ol className="chords-list" ref={listRef}>
            {chords
              ?.map((segment, i) => ({ segment, i }))
              .filter(({ segment }) => segment.chord)
              .map(({ segment, i }) => (
                <li key={`${i}:${segment.start}`}>
                  <button
                    type="button"
                    ref={i === active ? activeRef : undefined}
                    className={cx(
                      'chord',
                      i === active && 'chord-active',
                      i < active && 'chord-past'
                    )}
                    aria-current={i === active ? 'true' : undefined}
                    onClick={() => onSeek(segment.start)}
                  >
                    <span className="chord-name">{nameOf(segment)}</span>
                    <span className="chord-time">{formatDuration(segment.start)}</span>
                  </button>
                </li>
              ))}
          </ol>
        </>
      )}
    </section>
  )
}
