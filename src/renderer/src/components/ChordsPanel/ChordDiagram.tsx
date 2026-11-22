import { t } from '@shared/copy'
import { Chord } from '../../audio/chords'
import { gripOf } from '../../state/guitarShapes'
import { chordName } from '../../state/noteNames'

// The chord box, in its own units: six strings across, four frets down, with room
// above for open and muted marks and to the left for the starting fret.
const STRINGS = 6
const FRETS = 4
const LEFT = 16
const TOP = 14
const STRING_GAP = 10
const FRET_GAP = 13
const WIDTH = LEFT + STRING_GAP * (STRINGS - 1) + 6
const HEIGHT = TOP + FRET_GAP * FRETS + 4
const DOT_R = 3.6
const MARK_R = 2.6
const MARK_Y = TOP - 7

const x = (string: number): number => LEFT + string * STRING_GAP
const fretMid = (fret: number): number => TOP + (fret - 0.5) * FRET_GAP

/** How to hold a chord on the guitar, as a chord box. */
export function ChordDiagram({ chord }: { chord: Chord }): React.JSX.Element {
  const grip = gripOf(chord)
  return (
    <svg
      className="grip"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('chords.grip', { chord: chordName(chord) })}
    >
      {Array.from({ length: FRETS + 1 }, (_, f) => (
        <line
          key={`f${f}`}
          className={f === 0 && grip.baseFret === 1 ? 'grip-nut' : 'grip-line'}
          x1={x(0)}
          x2={x(STRINGS - 1)}
          y1={TOP + f * FRET_GAP}
          y2={TOP + f * FRET_GAP}
        />
      ))}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line
          key={`s${s}`}
          className="grip-line"
          x1={x(s)}
          x2={x(s)}
          y1={TOP}
          y2={TOP + FRETS * FRET_GAP}
        />
      ))}
      {grip.baseFret > 1 && (
        <text className="grip-fret" x={LEFT - 5} y={fretMid(1)} textAnchor="end">
          {t('chords.fret', { n: grip.baseFret })}
        </text>
      )}
      {grip.open.map((s) => (
        <circle key={`o${s}`} className="grip-open" cx={x(s)} cy={MARK_Y} r={MARK_R} />
      ))}
      {grip.muted.map((s) => (
        <path
          key={`m${s}`}
          className="grip-muted"
          d={`M${x(s) - MARK_R} ${MARK_Y - MARK_R}l${MARK_R * 2} ${MARK_R * 2}m0 ${-MARK_R * 2}l${-MARK_R * 2} ${MARK_R * 2}`}
        />
      ))}
      {grip.barre && (
        <rect
          className="grip-dot"
          x={x(grip.barre.from) - DOT_R}
          y={fretMid(grip.barre.fret) - DOT_R}
          width={x(grip.barre.to) - x(grip.barre.from) + DOT_R * 2}
          height={DOT_R * 2}
          rx={DOT_R}
        />
      )}
      {grip.dots.map((d) => (
        <circle
          key={`d${d.string}`}
          className="grip-dot"
          cx={x(d.string)}
          cy={fretMid(d.fret)}
          r={DOT_R}
        />
      ))}
    </svg>
  )
}
