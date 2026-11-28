import { useEffect, useRef, useState } from 'react'
import { createMeter } from '../../audio/engine/engine'
import { nextInputVolume } from '../../audio/engine/inputLevel'
import { gainToDb } from '../../audio/dsp/units'
import { LISTEN_MS, READ_EVERY_MS } from './constants'

export type AutoLevelStatus = 'idle' | 'listening' | 'set' | 'alreadyRight' | 'notHeard'

export interface AutoLevel {
  /** False when Rove can't set this mic's level (not the Mac's current input, or no volume). */
  available: boolean
  status: AutoLevelStatus
  /** Listens to the singer's loudest line, then sets the Mac's input volume to suit it. */
  start(): void
}

/**
 * Sets the mic's level for the singer: the Mac's input volume, so they don't have to
 * find it in System Settings. Only the system's current input has one Rove can set.
 */
export function useAutoLevel(
  source: MediaStreamAudioSourceNode | null,
  systemInput: boolean
): AutoLevel {
  // Both belong to the mic they were read from; another mic starts fresh.
  const [read, setRead] = useState<{ from: MediaStreamAudioSourceNode; volume: number | null }>()
  const [result, setResult] = useState<{
    from: MediaStreamAudioSourceNode
    status: AutoLevelStatus
  }>()
  const volume = source && systemInput && read?.from === source ? read.volume : null
  const status = source && result?.from === source ? result.status : 'idle'
  const listening = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!source || !systemInput) return
    let alive = true
    void window.api.getInputVolume().then((v) => alive && setRead({ from: source, volume: v }))
    return () => {
      alive = false
      listening.current?.()
    }
  }, [source, systemInput])

  const start = (): void => {
    if (!source || volume === null || status === 'listening') return
    const report = (next: AutoLevelStatus): void => setResult({ from: source, status: next })
    report('listening')
    const meter = createMeter(source)
    let loudest = -Infinity
    const read = setInterval(() => {
      loudest = Math.max(loudest, gainToDb(meter.readPeak()))
    }, READ_EVERY_MS)
    const stop = (): void => {
      clearInterval(read)
      clearTimeout(done)
      meter.dispose()
      listening.current = null
    }
    const done = setTimeout(() => {
      stop()
      const next = nextInputVolume(volume, loudest)
      if (next === null) return report('notHeard')
      if (next === volume) return report('alreadyRight')
      window.api
        .setInputVolume(next)
        .then((set) => {
          setRead({ from: source, volume: set })
          report('set')
        })
        // The Mac refused: the singer can still set it by hand, as before.
        .catch(() => report('idle'))
    }, LISTEN_MS)
    listening.current = stop
  }

  return { available: volume !== null, status, start }
}
