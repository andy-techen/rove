import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { closeInput, getAudioContext, listInputs, openInput } from '../audio/engine'
import { loadSavedDeviceId, pickInputDevice, saveDeviceId } from '../audio/devices'
import { estimatedLatency, loadLatency, saveLatency } from '../audio/latency'
import { useMicInput } from '../audio/useMicInput'

export type MicAccess = 'requesting' | 'granted' | 'denied'

export interface Microphone {
  access: MicAccess
  devices: MediaDeviceInfo[]
  deviceId: string | null
  deviceLabel: string
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  /** Measured round-trip delay for this mic, or null when only estimated. */
  measuredLatency: number | null
  estimatedLatency: number
  /** The delay to remove from new takes: measured if known, otherwise estimated. */
  latencySec: number
  chooseDevice(deviceId: string): void
  retryAccess(): Promise<void>
  setMeasuredLatency(seconds: number | null): void
}

/** Microphone permission, device choice, the live input, and its measured delay. */
export function useMicrophone(): Microphone {
  const [access, setAccess] = useState<MicAccess>('requesting')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  // Measured delays this session, layered over what was saved for each mic.
  const [measuredByDevice, setMeasuredByDevice] = useState<Record<string, number | null>>({})
  const { source, error: inputError } = useMicInput(access === 'granted' ? deviceId : null)

  const refreshDevices = useCallback(async (preferredId: string | null) => {
    const inputs = await listInputs()
    setDevices(inputs)
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

  const measuredLatency =
    deviceId === null
      ? null
      : deviceId in measuredByDevice
        ? measuredByDevice[deviceId]
        : loadLatency(deviceId)
  const estimate = estimatedLatency(getAudioContext())

  return {
    access,
    devices,
    deviceId,
    deviceLabel: devices.find((d) => d.deviceId === deviceId)?.label || t('micCheck.microphone'),
    source,
    inputError,
    measuredLatency,
    estimatedLatency: estimate,
    latencySec: measuredLatency ?? estimate,
    chooseDevice: (id) => {
      saveDeviceId(id)
      setDeviceId(id)
    },
    retryAccess: enable,
    setMeasuredLatency: (seconds) => {
      if (!deviceId) return
      saveLatency(deviceId, seconds)
      setMeasuredByDevice((prev) => ({ ...prev, [deviceId]: seconds }))
    }
  }
}
