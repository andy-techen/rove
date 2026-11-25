import { useState } from 'react'
import { t } from '@shared/copy'
import type { VoiceProfile } from '../../audio/voice'
import { noteWithOctave } from '../../state/chords/noteNames'
import type { KeyRange, SongView } from '../../state/voice/voiceView'
import { Button } from '../ui/Button'
import { Keyboard } from './Keyboard'
import { KEYBOARD_HEIGHT, KeyScale, keyScale } from './keyboardGeometry'
import { Measured } from './Measured'
import { NoteButton } from './NoteButton'

const BARS_HEIGHT = 90
const BAR_GAP = 2
const LABEL_INSET = 4
const LABEL_Y = 12
const ROW_HEIGHT = 18
const ROW_BAR = 10
const KEYBOARD_GAP = 6

const note = (n: number | null): string => (n === null ? '–' : noteWithOctave(n))

/** Time on each note over the keyboard, with the comfort zone shaded behind. */
function NoteTime({
  profile,
  scale
}: {
  profile: VoiceProfile
  scale: KeyScale
}): React.JSX.Element {
  const { keys, keyWidth, x } = scale
  const width = (keys.high - keys.low + 1) * keyWidth
  const height = BARS_HEIGHT + KEYBOARD_GAP + KEYBOARD_HEIGHT
  const most = Math.max(...profile.noteTime.map((n) => n.sec))
  const { comfortLow: low, comfortHigh: high } = profile
  return (
    <svg
      className="voice-chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t('voice.rangeChart', { low: note(low), high: note(high) })}
    >
      {low !== null && high !== null && (
        <g>
          <rect
            className="voice-comfort"
            x={x(low)}
            width={(high - low + 1) * keyWidth}
            height={BARS_HEIGHT}
          />
          <text className="voice-chart-label" x={x(low) + LABEL_INSET} y={LABEL_Y}>
            {t('voice.comfortBand')}
          </text>
        </g>
      )}
      {profile.noteTime.map(({ note: n, sec }) => {
        const barHeight = (sec / most) * (BARS_HEIGHT - LABEL_Y - LABEL_INSET)
        return (
          <rect
            key={n}
            className="voice-bar"
            x={x(n) + BAR_GAP}
            y={BARS_HEIGHT - barHeight}
            width={keyWidth - 2 * BAR_GAP}
            height={barHeight}
          />
        )
      })}
      <Keyboard scale={scale} y={BARS_HEIGHT + KEYBOARD_GAP} />
    </svg>
  )
}

/** One song's comfort zone (thick) and lowest to highest notes (thin). */
function SongRow({
  profile: p,
  scale
}: {
  profile: VoiceProfile
  scale: KeyScale
}): React.JSX.Element {
  const { keyWidth, x } = scale
  const width = (scale.keys.high - scale.keys.low + 1) * keyWidth
  const mid = ROW_HEIGHT / 2
  return (
    <svg
      className="voice-chart"
      width={width}
      height={ROW_HEIGHT}
      viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
      aria-hidden="true"
    >
      {p.lowestNote !== null && p.highestNote !== null && (
        <line
          className="voice-extent"
          x1={x(p.lowestNote) + keyWidth / 2}
          x2={x(p.highestNote) + keyWidth / 2}
          y1={mid}
          y2={mid}
        />
      )}
      {p.comfortLow !== null && p.comfortHigh !== null && (
        <rect
          className="voice-bar"
          x={x(p.comfortLow)}
          y={mid - ROW_BAR / 2}
          width={(p.comfortHigh - p.comfortLow + 1) * keyWidth}
          height={ROW_BAR}
        />
      )}
    </svg>
  )
}

/** One row per song on a shared keyboard, each named above its range. */
function SongRanges({ songs, keys }: { songs: SongView[]; keys: KeyRange }): React.JSX.Element {
  return (
    <div className="voice-songs" role="list" aria-label={t('voice.songsChart')}>
      <Measured>
        {(width) => {
          const scale = keyScale(keys, width)
          return (
            <>
              {songs.map(({ folder, songName, profile }) => (
                <div
                  key={folder}
                  className="voice-song"
                  role="listitem"
                  aria-label={t('voice.songRange', {
                    song: songName,
                    low: note(profile.comfortLow),
                    high: note(profile.comfortHigh)
                  })}
                >
                  <span className="voice-song-name" aria-hidden="true">
                    {songName}
                  </span>
                  <SongRow profile={profile} scale={scale} />
                </div>
              ))}
              <svg
                className="voice-chart"
                width={width}
                height={KEYBOARD_HEIGHT}
                viewBox={`0 0 ${width} ${KEYBOARD_HEIGHT}`}
              >
                <Keyboard scale={scale} y={0} />
              </svg>
            </>
          )
        }}
      </Measured>
    </div>
  )
}

interface Props {
  profile: VoiceProfile
  songs: SongView[]
  keys: KeyRange
}

/** Your range: the headline notes, and time on each note overall or a range per song. */
export function RangeCard({ profile, songs, keys }: Props): React.JSX.Element {
  const [bySong, setBySong] = useState(false)
  return (
    <section className="voice-card">
      <div className="voice-card-head">
        <h3>{t('voice.range')}</h3>
        <Button variant="quiet" size="sm" aria-pressed={bySong} onClick={() => setBySong(!bySong)}>
          {t(bySong ? 'voice.allSongs' : 'voice.bySong')}
        </Button>
      </div>
      <dl className="voice-stats">
        <div>
          <dt>{t('voice.lowest')}</dt>
          <dd>
            <NoteButton note={profile.lowestNote} />
          </dd>
        </div>
        <div>
          <dt>{t('voice.comfort')}</dt>
          <dd>
            <NoteButton note={profile.comfortLow} /> – <NoteButton note={profile.comfortHigh} />
          </dd>
        </div>
        <div>
          <dt>{t('voice.highest')}</dt>
          <dd>
            <NoteButton note={profile.highestNote} />
          </dd>
        </div>
        <div>
          <dt>{t('voice.mostUsed')}</dt>
          <dd>
            <NoteButton note={profile.mostUsedNote} />
          </dd>
        </div>
      </dl>
      {bySong ? (
        <SongRanges songs={songs} keys={keys} />
      ) : (
        <Measured>
          {(width) => <NoteTime profile={profile} scale={keyScale(keys, width)} />}
        </Measured>
      )}
    </section>
  )
}
