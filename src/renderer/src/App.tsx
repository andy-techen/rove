import { useCallback, useEffect, useRef, useState } from 'react'
import { closeInput, getAudioContext, listInputs, openInput } from './audio/engine'
import { loadSavedDeviceId, pickInputDevice, saveDeviceId } from './audio/devices'
import { useMicInput } from './audio/useMicInput'
import { DevicePicker } from './components/DevicePicker'
import { InputMeter } from './components/InputMeter'

type MicAccess = 'requesting' | 'granted' | 'denied'
type Screen = 'micCheck' | 'record'

function App(): React.JSX.Element {
  const [access, setAccess] = useState<MicAccess>('requesting')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [checkedDeviceId, setCheckedDeviceId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('micCheck')
  const { source, error: inputError } = useMicInput(access === 'granted' ? deviceId : null)
  const levelChecked = deviceId !== null && checkedDeviceId === deviceId
  const deviceLabel = devices.find((d) => d.deviceId === deviceId)?.label || 'Microphone'

  const refreshDevices = useCallback(async (preferredId: string | null) => {
    const inputs = await listInputs()
    setDevices(inputs)
    setDeviceId(pickInputDevice(inputs, preferredId))
  }, [])

  const enableMic = useCallback(async () => {
    setAccess('requesting')
    await getAudioContext().resume()
    if (!(await window.api.requestMicAccess())) return setAccess('denied')
    try {
      // Device labels stay blank until a stream has been opened once.
      closeInput(await openInput())
    } catch {
      return setAccess('denied')
    }
    await refreshDevices(loadSavedDeviceId())
    setAccess('granted')
  }, [refreshDevices])

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    enableMic()
  }, [enableMic])

  useEffect(() => {
    if (access !== 'granted') return
    const onChange = (): void => void refreshDevices(deviceId)
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [access, deviceId, refreshDevices])

  const chooseDevice = (id: string): void => {
    saveDeviceId(id)
    setDeviceId(id)
  }

  const markChecked = useCallback(() => setCheckedDeviceId(deviceId), [deviceId])

  if (screen === 'record' && access === 'granted') {
    return (
      <main className="app">
        <header>
          <h1>Ready to record</h1>
          <p className="subtitle">{deviceLabel}</p>
        </header>
        <section className="card stack">
          {inputError && <p className="error">{inputError}</p>}
          {source && <InputMeter source={source} />}
          <div className="row">
            <button className="secondary" onClick={() => setScreen('micCheck')}>
              Back to mic check
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header>
        <h1>Rove</h1>
        <p className="subtitle">Let&apos;s get your mic ready.</p>
      </header>

      <section className="card">
        {access === 'requesting' && <p className="muted">Asking for microphone access…</p>}

        {access === 'denied' && (
          <div className="stack">
            <p>
              Rove can&apos;t hear your microphone. Turn on access for Rove in System Settings, then
              try again.
            </p>
            <div className="row">
              <button onClick={() => window.api.openMicSettings()}>Open System Settings</button>
              <button className="secondary" onClick={enableMic}>
                Try again
              </button>
            </div>
          </div>
        )}

        {access === 'granted' && (
          <div className="stack">
            {devices.length === 0 ? (
              <p>No microphone found. Plug one in and it will show up here.</p>
            ) : (
              <DevicePicker devices={devices} deviceId={deviceId} onChange={chooseDevice} />
            )}
            {inputError && <p className="error">{inputError}</p>}
            {source && <InputMeter source={source} onInRange={markChecked} />}
            <div className="row continue-row">
              <button disabled={!levelChecked} onClick={() => setScreen('record')}>
                Continue
              </button>
              {!levelChecked && source && (
                <span className="muted">Sing in the green for a moment to continue.</span>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
