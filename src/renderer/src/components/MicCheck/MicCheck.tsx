import { useCallback, useState } from 'react'
import { t } from '@shared/copy'
import { Microphone } from '../../state/transport/useMicrophone'
import { DevicePicker } from '../DevicePicker'
import { InputMeter } from '../InputMeter'
import { Button } from '../ui/Button'
import './MicCheck.css'

interface Props {
  mic: Microphone
  /** First run: the singer must reach a good level before continuing. */
  onboarding: boolean
  onDone(): void
}

export function MicCheck({ mic, onboarding, onDone }: Props): React.JSX.Element {
  const { access, devices, deviceId, source, inputError } = mic
  // The level check is per mic: switching mics asks for a fresh check.
  const [checkedDeviceId, setCheckedDeviceId] = useState<string | null>(null)
  const levelChecked = deviceId !== null && checkedDeviceId === deviceId
  const markChecked = useCallback(() => setCheckedDeviceId(deviceId), [deviceId])

  return (
    <main className="mic-check">
      <header>
        <h1 className="mic-check-title">{t('app.name')}</h1>
        <p className="muted">
          {onboarding ? t('micCheck.subtitleOnboarding') : t('micCheck.subtitleRevisit')}
        </p>
      </header>

      <section className="mic-check-card">
        {access === 'requesting' && <p className="muted">{t('micCheck.requesting')}</p>}

        {access === 'denied' && (
          <div className="stack">
            <p>{t('micCheck.denied')}</p>
            <div className="row">
              <Button onClick={() => window.api.openMicSettings()}>
                {t('micCheck.openSettings')}
              </Button>
              <Button variant="secondary" onClick={mic.retryAccess}>
                {t('micCheck.tryAgain')}
              </Button>
            </div>
          </div>
        )}

        {access === 'granted' && (
          <div className="stack">
            {devices.length === 0 ? (
              <p>{t('micCheck.noMicrophone')}</p>
            ) : (
              <DevicePicker devices={devices} deviceId={deviceId} onChange={mic.chooseDevice} />
            )}
            {inputError && <p className="error">{inputError}</p>}
            {source && <InputMeter source={source} onInRange={markChecked} />}
            <div className="row mic-check-actions">
              {onboarding ? (
                <>
                  <Button disabled={!levelChecked} onClick={onDone}>
                    {t('micCheck.continue')}
                  </Button>
                  {!levelChecked && source && (
                    <span className="muted">{t('micCheck.continueHint')}</span>
                  )}
                </>
              ) : (
                <Button onClick={onDone}>{t('micCheck.done')}</Button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
