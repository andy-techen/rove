import { CSSProperties, MouseEvent } from 'react'
import { t } from '@shared/copy'
import { BeatsPerBar, MyBeat, PAD_DRUMS, PadDrum, PadHit } from '../../state/song/project'
import { SNAP_BEATS, tidyBeat, withHit } from '../../state/chords/beats'
import { cx } from '../ui/cx'
import { PAD_KEY_CODES, keyLabel } from './padKeys'

interface Props {
  beat: MyBeat
  beatsPerBar: BeatsPerBar
  locked: boolean
  /** Clicks land on the sixteenth under the pointer, rather than exactly there. */
  snap: boolean
  /** Roomier, when the pad has the panel to itself. */
  large?: boolean
  /** The sixteenth being heard as the beat plays, lit down every lane. */
  playingColumn?: number | null
  onHits(hits: PadHit[]): void
  /** Lets the singer hear a drum as it's placed. */
  onPreview(drum: PadDrum): void
}

const SIXTEENTHS_PER_BEAT = 1 / SNAP_BEATS
// Beats shown to a hundredth: a sixteenth reads "beat 1.75", and a loose tap no finer.
const BEAT_SHOWN = 100

/**
 * A lane for each drum across one bar, with its hits where they play. Click a lane to
 * add a hit, or a hit to take it away; recording fills it from the keys.
 */
export function BeatPad({
  beat,
  beatsPerBar,
  locked,
  snap,
  large = false,
  playingColumn = null,
  onHits,
  onPreview
}: Props): React.JSX.Element {
  const ticks = beatsPerBar * SIXTEENTHS_PER_BEAT

  const add = (drum: PadDrum, e: MouseEvent<HTMLDivElement>): void => {
    if (locked) return
    const box = e.currentTarget.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    // Snapped, a click fills the sixteenth it's in; free, it lands right where it is.
    const at = snap ? Math.floor(share * ticks) * SNAP_BEATS : share * beatsPerBar
    const hits = withHit(beat.hits, { drum, at: tidyBeat(at) })
    if (hits === beat.hits) return
    onHits(hits)
    onPreview(drum)
  }

  return (
    <div
      className={cx('beat-pad', large && 'beat-pad-large')}
      role="group"
      aria-label={t('beats.pad')}
      // Runtime geometry: the bar's sixteenths, for the lanes' lines and hits' widths.
      style={{ '--pad-ticks': ticks } as CSSProperties}
    >
      {PAD_DRUMS.map((drum) => (
        <div key={drum} className="beat-pad-row">
          <span className="beat-pad-drum">
            {t(`beats.${drum}`)}
            {/* The keys play only a pad that can change. */}
            {!locked && <kbd className="beat-pad-key">{keyLabel(PAD_KEY_CODES[drum])}</kbd>}
          </span>
          <div
            className={cx('beat-pad-lane', !locked && 'editable')}
            aria-label={t('beats.lane', {
              drum: t(`beats.${drum}`),
              key: keyLabel(PAD_KEY_CODES[drum])
            })}
            onClick={(e) => add(drum, e)}
          >
            {Array.from({ length: ticks }, (_, k) => (
              <span
                key={k}
                className={cx(
                  'beat-pad-tick',
                  k % SIXTEENTHS_PER_BEAT === 0 && 'beat-pad-beat',
                  k === playingColumn && 'beat-pad-now'
                )}
              />
            ))}
            {beat.hits.map((hit, i) =>
              hit.drum !== drum || hit.at >= beatsPerBar ? null : (
                <button
                  key={`${hit.at}-${i}`}
                  type="button"
                  className="beat-pad-hit"
                  aria-label={t('beats.hitLabel', {
                    drum: t(`beats.${drum}`),
                    beat: Math.round((hit.at + 1) * BEAT_SHOWN) / BEAT_SHOWN
                  })}
                  disabled={locked}
                  // Runtime geometry: where in the bar it plays.
                  style={{ '--at': hit.at / beatsPerBar } as CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation()
                    onHits(beat.hits.filter((h) => h !== hit))
                  }}
                />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
