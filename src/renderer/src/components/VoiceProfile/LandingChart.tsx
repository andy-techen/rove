import { t } from '@shared/copy'
import { LANDING_BIN_CENTS, LANDING_RANGE_CENTS } from '@shared/voice'
import { LABEL_DESCENT } from './keyboardGeometry'
import { Measured } from './Measured'

const BIN_GAP = 2
const HEIGHT = 110
const LABEL_GAP = 16
// Room above the tallest bar for the band's label, so the band shows over every bar
// as the comfort zone does on the range chart.
const BAND_LABEL_Y = 12
const HEADROOM = 18
// The soft band in the middle: as close as most listeners hear as on the note.
const ON_NOTE_CENTS = 20
const TENTHS = 10

interface Props {
  landing: number[]
  /** Share of held notes within ON_NOTE_CENTS; null with none held. */
  landedShare: number | null
}

/** The held notes binned from flat to sharp, with the on-the-note band behind. */
function Bins({ landing, width }: { landing: number[]; width: number }): React.JSX.Element {
  const binWidth = width / landing.length
  const most = Math.max(1, ...landing)
  const binAt = (cents: number): number => (cents + LANDING_RANGE_CENTS) / LANDING_BIN_CENTS
  return (
    <svg
      className="voice-chart"
      width={width}
      height={HEIGHT + LABEL_GAP + LABEL_DESCENT}
      viewBox={`0 0 ${width} ${HEIGHT + LABEL_GAP + LABEL_DESCENT}`}
      role="img"
      aria-label={t('voice.pitch.chart')}
    >
      <rect
        className="voice-comfort"
        x={binAt(-ON_NOTE_CENTS) * binWidth}
        width={(binAt(ON_NOTE_CENTS) - binAt(-ON_NOTE_CENTS)) * binWidth}
        height={HEIGHT}
      />
      <text
        className="voice-chart-label"
        x={binAt(0) * binWidth}
        y={BAND_LABEL_Y}
        textAnchor="middle"
      >
        {t('voice.onNoteBand')}
      </text>
      {landing.map((count, i) => {
        const height = (count / most) * (HEIGHT - HEADROOM)
        return (
          <rect
            key={i}
            className="voice-bar"
            x={i * binWidth + BIN_GAP / 2}
            y={HEIGHT - height}
            width={binWidth - BIN_GAP}
            height={height}
          />
        )
      })}
      <text className="voice-chart-label" x={0} y={HEIGHT + LABEL_GAP}>
        {t('voice.flat')}
      </text>
      <text className="voice-chart-label" x={width} y={HEIGHT + LABEL_GAP} textAnchor="end">
        {t('voice.sharp')}
      </text>
    </svg>
  )
}

/** How far held notes land from the note, flat to sharp. No score, just where they fall. */
export function LandingChart({ landing, landedShare }: Props): React.JSX.Element {
  return (
    <section className="voice-card">
      <h3>{t('voice.pitch.title')}</h3>
      <p className="voice-subtitle">{t('voice.pitch.subtitle')}</p>
      {landedShare !== null && (
        <p className="voice-headline">
          <strong>{t('voice.landedShare', { count: Math.round(landedShare * TENTHS) })}</strong>{' '}
          {t('voice.pitch.landed')}
        </p>
      )}
      <Measured>{(width) => <Bins landing={landing} width={width} />}</Measured>
    </section>
  )
}
