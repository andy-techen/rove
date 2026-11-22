import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { closeInput, getAudioContext, listInputs, openInput } from '../audio/engine'
import { loadSavedDeviceId, pickInputDevice, saveDeviceId } from '../audio/devices'
import { estimatedLatency } from '../audio/latency'
import { useMicInput } from '../audio/useMicInput'

export type MicAccess = 'requesting' | 'granted' | 'denied'

export interface Microphone {
  access: MicAccess
  devices: MediaDeviceInfo[]
  deviceId: string | null
  deviceLabel: string
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  /** The delay to remove from new takes, as the system reports it. */
  latencySec: number
  chooseDevice(deviceId: string): void
  retryAccess(): Promise<void>
}

/** Microphone permission, device choice, the live input, and its delay. */
export function useMicrophone(): Microphone {
  const [access, setAccess] = useState<MicAccess>('requesting')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
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

  return {
    access,
    devices,
    deviceId,
    deviceLabel: devices.find((d) => d.deviceId === deviceId)?.label || t('micCheck.microphone'),
    source,
    inputError,
    latencySec: estimatedLatency(getAudioContext()),
    chooseDevice: (id) => {
      saveDeviceId(id)
      setDeviceId(id)
    },
    retryAccess: enable
  }
}
