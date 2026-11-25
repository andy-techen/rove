import { CSSProperties, useMemo } from 'react'
import { t } from '@shared/copy'
import { VOICE_UNLOCK_SEC } from '@shared/voice'
import { useVoiceProfile } from '../../state/voice/useVoiceProfile'
import { singingTime } from '../../state/voice/voiceText'
import { voiceView } from '../../state/voice/voiceView'
import type { Entry } from '../../audio/voice'
import { GrowthChart } from './GrowthChart'
import { LandingChart } from './LandingChart'
import { RangeCard } from './RangeCard'
import { ToneScales } from './ToneScales'
import { TotalsCards } from './TotalsCards'
import './VoiceProfile.css'

const SEC_PER_MIN = 60

/** Before there's enough singing to say anything: how far along the singer is. */
function Locked({ sungSec }: { sungSec: number }): React.JSX.Element {
  const sung = Math.min(sungSec, VOICE_UNLOCK_SEC)
  return (
    <div className="voice-locked">
      <p>{t('voice.locked', { minutes: VOICE_UNLOCK_SEC / SEC_PER_MIN })}</p>
      <div
        className="voice-progress"
        role="progressbar"
        aria-label={t('voice.lockedLabel')}
        aria-valuemin={0}
        aria-valuemax={VOICE_UNLOCK_SEC}
        aria-valuenow={Math.floor(sung)}
        aria-valuetext={singingTime(sung)}
        style={{ '--progress': sung / VOICE_UNLOCK_SEC } as CSSProperties}
      />
      <p className="voice-caption">
        {t('voice.lockedProgress', {
          sung: singingTime(sung),
          total: singingTime(VOICE_UNLOCK_SEC)
        })}
      </p>
    </div>
  )
}

function Profile({ entries }: { entries: Entry[] }): React.JSX.Element {
  const view = useMemo(() => voiceView(entries), [entries])
  if (view.locked) {
    return (
      <div className="voice-profile">
        <TotalsCards totals={view.totals} />
        <Locked sungSec={view.sungSec} />
      </div>
    )
  }
  return (
    <div className="voice-profile">
      <TotalsCards totals={view.totals} />
      <RangeCard profile={view.overall} songs={view.songs} keys={view.keys} />
      <section className="voice-card">
        <h3>{t('voice.growth')}</h3>
        <p className="voice-subtitle">{t('voice.growthSubtitle')}</p>
        <GrowthChart months={view.months} keys={view.keys} />
      </section>
      <div className="voice-pair">
        {view.overall.tone && <ToneScales tone={view.overall.tone} />}
        <LandingChart landing={view.overall.landing} landedShare={view.overall.landedShare} />
      </div>
    </div>
  )
}

/** The singer's voice across every song: range, how it's grown, tone and landing notes. */
export function VoiceProfile(): React.JSX.Element {
  const state = useVoiceProfile()
  switch (state.status) {
    case 'loading':
      return <p className="voice-caption">{t('voice.loading')}</p>
    case 'listening':
      return (
        <p className="voice-caption" role="status">
          {t('voice.listening', { done: state.done, total: state.total })}
        </p>
      )
    case 'failed':
      return <p className="voice-caption">{t('voice.failed')}</p>
    case 'ready':
      return <Profile entries={state.entries} />
  }
}
