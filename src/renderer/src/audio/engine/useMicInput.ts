import { useEffect, useState } from 'react'
import { closeInput, getAudioContext, inputLatencyOf, openInput } from './engine'
import { describeInputError } from './devices'

interface MicInput {
  source: MediaStreamAudioSourceNode | null
  error: string | null
  /** The mic's own delay, as the system reports it. */
  latencySec: number
}

const CLOSED: MicInput = { source: null, error: null, latencySec: 0 }

export function useMicInput(deviceId: string | null): MicInput {
  const [input, setInput] = useState<MicInput>(CLOSED)

  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    let stream: MediaStream | null = null

    openInput(deviceId)
      .then((s) => {
        if (cancelled) return closeInput(s)
        stream = s
        setInput({
          source: getAudioContext().createMediaStreamSource(s),
          error: null,
          latencySec: inputLatencyOf(s)
        })
      })
      .catch((err) => {
        if (!cancelled) setInput({ ...CLOSED, error: describeInputError(err) })
      })

    // Consumers of the source (meter, recorder) each disconnect their own
    // connections; a blanket disconnect() here would make theirs throw.
    return () => {
      cancelled = true
      if (stream) closeInput(stream)
      setInput(CLOSED)
    }
  }, [deviceId])

  return input
}
