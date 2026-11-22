import { useState } from 'react'
import { t } from '@shared/copy'
import { getAudioContext } from '../../audio/engine'
import { measureLatency } from '../../audio/latency'
import { Button } from '../ui/Button'
import './LatencyPanel.css'

const MS_PER_SEC = 1000

interface Props {
  source: MediaStreamAudioSourceNode | null
  /** Measured delay for this mic, or null when only the estimate is known. */
  measured: number | null
  estimate: number
  onMeasured(seconds: number | null): void
}

const ms = (seconds: number): number => Math.round(seconds * MS_PER_SEC)

export function LatencyPanel({ source, measured, estimate, onMeasured }: Props): React.JSX.Element {
  const [state, setState] = useState<'idle' | 'measuring' | 'failed'>('idle')

  const measure = async (): Promise<void> => {
    if (!source) return
    setState('measuring')
    const result = await measureLatency(getAudioContext(), source).catch(() => null)
    if (result === null) return setState('failed')
    onMeasured(result)
    setState('idle')
  }

  return (
    <div className="latency-panel">
      <div>
        <span className="latency-title">{t('latency.title')}</span>
        <p className="muted">
          {measured !== null
            ? t('latency.measured', { ms: ms(measured) })
            : t('latency.estimated', { ms: ms(estimate) })}
        </p>
      </div>
      {state === 'measuring' && <p>{t('latency.measuring')}</p>}
      {state === 'failed' && <p className="error">{t('latency.failed')}</p>}
      <div className="row">
        <Button variant="secondary" disabled={!source || state === 'measuring'} onClick={measure}>
          {measured !== null ? t('latency.measureAgain') : t('latency.measure')}
        </Button>
        {measured !== null && (
          <Button variant="quiet" disabled={state === 'measuring'} onClick={() => onMeasured(null)}>
            {t('latency.useEstimate')}
          </Button>
        )}
      </div>
      {state !== 'failed' && <p className="latency-explainer muted">{t('latency.explainer')}</p>}
    </div>
  )
}
