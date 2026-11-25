import { t } from '@shared/copy'
import { singingTime } from '../../state/voice/voiceText'
import type { VoiceTotals } from '../../state/voice/voiceView'

/** How much the profile is built from: songs, time recorded and takes listened to. */
export function TotalsCards({ totals }: { totals: VoiceTotals }): React.JSX.Element {
  const cards = [
    { label: t('voice.songs'), value: String(totals.songs) },
    { label: t('voice.recorded'), value: singingTime(totals.recordedSec) },
    { label: t('voice.takes'), value: String(totals.takes) }
  ]
  return (
    <dl className="voice-totals" aria-label={t('voice.totals')}>
      {cards.map(({ label, value }) => (
        <div key={label} className="voice-total">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
