import { t } from '@shared/copy'
import { noteWithOctave } from '../../state/chords/noteNames'
import { monthLabel } from '../../state/voice/voiceText'
import type { KeyRange, MonthView } from '../../state/voice/voiceView'
import { LABEL_DESCENT } from './keyboardGeometry'
import { Measured } from './Measured'

// A year at a glance; older months scroll off the left.
const MAX_MONTHS = 12
const AXIS_WIDTH = 36
const PLOT_TOP = 16
const PLOT_HEIGHT = 170
const MONTH_LABEL_GAP = 18
const BAR_WIDTH = 16
const DOT_RADIUS = 4
const DOT_LABEL_GAP = 8
const C = 0
const AXIS_LABEL_NUDGE = 4

interface Props {
  months: MonthView[]
  keys: KeyRange
}

function Chart({ months, keys, width }: Props & { width: number }): React.JSX.Element {
  const shown = months.slice(-MAX_MONTHS)
  const column = (width - AXIS_WIDTH) / shown.length
  const x = (i: number): number => AXIS_WIDTH + column * (i + 0.5)
  const perNote = PLOT_HEIGHT / (keys.high - keys.low + 1)
  // A note's centre, higher notes higher up.
  const y = (note: number): number => PLOT_TOP + (keys.high - note + 0.5) * perNote
  const octaves = Array.from({ length: keys.high - keys.low + 1 }, (_, i) => keys.low + i).filter(
    (n) => n % 12 === C
  )
  const labels = shown.map((m, i) => monthLabel(m.year, m.month, i === 0))
  const height = PLOT_TOP + PLOT_HEIGHT + MONTH_LABEL_GAP + LABEL_DESCENT
  return (
    <svg
      className="voice-chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t('voice.growthChart')}
    >
      {octaves.map((n) => (
        <g key={n}>
          <line className="voice-grid" x1={AXIS_WIDTH} x2={width} y1={y(n)} y2={y(n)} />
          <text className="voice-chart-label" x={0} y={y(n) + AXIS_LABEL_NUDGE}>
            {noteWithOctave(n)}
          </text>
        </g>
      ))}
      {shown.map((m, i) => {
        const p = m.profile
        return (
          <g key={`${m.year}-${m.month}`}>
            <text
              className="voice-chart-label"
              x={x(i)}
              y={PLOT_TOP + PLOT_HEIGHT + MONTH_LABEL_GAP}
              textAnchor="middle"
            >
              {labels[i]}
            </text>
            {!p ? (
              <text
                className="voice-chart-label"
                x={x(i)}
                y={PLOT_TOP + PLOT_HEIGHT / 2}
                textAnchor="middle"
              >
                {t('voice.noSinging')}
              </text>
            ) : (
              <>
                {p.lowestNote !== null && p.highestNote !== null && (
                  <line
                    className="voice-extent"
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(p.highestNote)}
                    y2={y(p.lowestNote)}
                  />
                )}
                {p.comfortLow !== null && p.comfortHigh !== null && (
                  <rect
                    className="voice-bar"
                    x={x(i) - BAR_WIDTH / 2}
                    y={y(p.comfortHigh) - perNote / 2}
                    width={BAR_WIDTH}
                    height={(p.comfortHigh - p.comfortLow + 1) * perNote}
                  />
                )}
                {m.newHigh && p.highestNote !== null && (
                  <Milestone
                    x={x(i)}
                    y={y(p.highestNote)}
                    labelY={y(p.highestNote) - DOT_LABEL_GAP}
                    text={t('voice.newHigh', { note: noteWithOctave(p.highestNote) })}
                  />
                )}
                {m.newLow && p.lowestNote !== null && (
                  <Milestone
                    x={x(i)}
                    y={y(p.lowestNote)}
                    labelY={y(p.lowestNote) + DOT_LABEL_GAP + AXIS_LABEL_NUDGE * 2}
                    text={t('voice.newLow', { note: noteWithOctave(p.lowestNote) })}
                  />
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Each month's comfort zone (thick) and lowest to highest notes (thin), oldest first. */
export function GrowthChart(props: Props): React.JSX.Element {
  return <Measured>{(width) => <Chart {...props} width={width} />}</Measured>
}

function Milestone(props: {
  x: number
  y: number
  labelY: number
  text: string
}): React.JSX.Element {
  return (
    <g>
      <circle className="voice-dot" cx={props.x} cy={props.y} r={DOT_RADIUS} />
      <text className="voice-chart-label" x={props.x} y={props.labelY} textAnchor="middle">
        {props.text}
      </text>
    </g>
  )
}
