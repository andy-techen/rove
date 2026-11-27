import { useCallback, useState } from 'react'
import { t } from '@shared/copy'
import { Microphone } from '../../state/transport/useMicrophone'
import { AutoLevelStatus, useAutoLevel } from '../../state/transport/useAutoLevel'
import { isSystemInput } from '../../audio/engine/devices'
import { DevicePicker } from '../DevicePicker'
import { InputMeter } from '../InputMeter'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { Switch } from '../ui/Switch'
import { Logo } from '../ui/Logo'
import './MicCheck.css'

const LEVEL_MESSAGE: Partial<Record<AutoLevelStatus, string>> = {
  listening: t('micCheck.level.listening'),
  set: t('micCheck.level.done'),
  alreadyRight: t('micCheck.level.alreadyRight'),
  notHeard: t('micCheck.level.notHeard')
}

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
  const level = useAutoLevel(source, isSystemInput(devices, deviceId))
  // With a mic Rove can set, setting it is the way on; otherwise singing in the green is.
  const autoLevel = !!source && level.available
  const levelSet = level.status === 'set' || level.status === 'alreadyRight'
  const ready = !onboarding || levelChecked || levelSet
  const finish = onboarding ? t('micCheck.continue') : t('micCheck.done')
  const message =
    LEVEL_MESSAGE[level.status] ??
    (!ready && source && !autoLevel ? t('micCheck.continueHint') : null)

  return (
    <main className="mic-check">
      <header>
        <h1 className="mic-check-title">
          <Logo size="lg" />
        </h1>
        {onboarding && <p className="muted">{t('micCheck.subtitleOnboarding')}</p>}
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
            {!mic.outLoud && (
              <div className="row mic-check-hear-self">
                <Switch
                  checked={mic.hearSelf}
                  onChange={mic.setHearSelf}
                  label={t('micCheck.hearSelf')}
                />
                <HelpTip
                  text={
                    mic.ownMonitoring ? t('micCheck.hearSelfOwnHint') : t('micCheck.hearSelfHint')
                  }
                />
              </div>
            )}
            <div className="row mic-check-actions">
              {autoLevel && !levelSet ? (
                <>
                  <Button
                    icon="mic"
                    title={t('micCheck.level.setTitle')}
                    disabled={level.status === 'listening'}
                    onClick={level.start}
                  >
                    {t('micCheck.level.set')}
                  </Button>
                  {ready && (
                    <Button variant="secondary" onClick={onDone}>
                      {finish}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button disabled={!ready} onClick={onDone}>
                    {finish}
                  </Button>
                  {autoLevel && (
                    <Button variant="quiet" onClick={level.start}>
                      {t('micCheck.level.again')}
                    </Button>
                  )}
                </>
              )}
            </div>
            {message && (
              <p className="muted mic-check-message" aria-live="polite">
                {message}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
