import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { closeInput, getAudioContext, listDevices, openInput } from '../../audio/engine/engine'
import {
  loadLearnedLatency,
  loadSavedDeviceId,
  pickInputDevice,
  playsOutLoud,
  saveDeviceId,
  saveLearnedLatency,
  setupKey
} from '../../audio/engine/devices'
import { estimatedLatency, learnLatency } from '../../audio/engine/latency'
import { useMicInput } from '../../audio/engine/useMicInput'

export type MicAccess = 'requesting' | 'granted' | 'denied'

export interface Microphone {
  access: MicAccess
  devices: MediaDeviceInfo[]
  deviceId: string | null
  deviceLabel: string
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  /**
   * The delay to remove from new takes: what the system reports, plus what lined-up
   * takes taught Rove about this mic and output.
   */
  latencySec: number
  /**
   * True when sound plays into the room (speakers), so hearing the mic back would
   * feed back; false with headphones.
   */
  outLoud: boolean
  /** True when the singer has paused listening; the mic stream is released until resumed. */
  paused: boolean
  chooseDevice(deviceId: string): void
  retryAccess(): Promise<void>
  setPaused(paused: boolean): void
  /** A take on this setup was lined up by `bySec`; later takes are shifted by it too. */
  learnLatency(bySec: number): void
}

/** Microphone permission, device choice, the live input, and its delay. */
export function useMicrophone(): Microphone {
  const [access, setAccess] = useState<MicAccess>('requesting')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [outLoud, setOutLoud] = useState(false)
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  // Passing null closes the input: that's how "pause" releases the mic stream
  // without changing the chosen device or asking for access again.
  const activeDeviceId = access === 'granted' && !paused ? deviceId : null
  const { source, error: inputError, latencySec: inputLatencySec } = useMicInput(activeDeviceId)
  const setup = deviceId === null ? null : setupKey(deviceId, outputs)
  const [learned, setLearned] = useState<{ setup: string | null; sec: number }>({
    setup: null,
    sec: 0
  })
  // Read again whenever the mic or the output changes, so each setup keeps its own.
  const stored = useMemo(() => (setup ? loadLearnedLatency(setup) : 0), [setup])
  const learnedSec = learned.setup === setup ? learned.sec : stored

  const refreshDevices = useCallback(async (preferredId: string | null) => {
    const { inputs, outputs } = await listDevices()
    setDevices(inputs)
    setOutputs(outputs)
    setOutLoud(playsOutLoud(outputs))
    setDeviceId(pickInputDevice(inputs, preferredId))
  }, [])

  const enable = useCallback(async () => {
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
    void enable()
  }, [enable])

  useEffect(() => {
    if (access !== 'granted') return
    const onChange = (): void => void refreshDevices(deviceId)
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [access, deviceId, refreshDevices])

  return {
    access,
    devices,
    deviceId,
    deviceLabel: devices.find((d) => d.deviceId === deviceId)?.label || t('micCheck.microphone'),
    source,
    inputError,
    latencySec: estimatedLatency(getAudioContext(), inputLatencySec) + learnedSec,
    outLoud,
    paused,
    chooseDevice: (id) => {
      saveDeviceId(id)
      setDeviceId(id)
    },
    retryAccess: enable,
    setPaused,
    learnLatency: (bySec) => {
      if (!setup) return
      const sec = learnLatency(learnedSec, bySec)
      saveLearnedLatency(setup, sec)
      setLearned({ setup, sec })
    }
  }
}
