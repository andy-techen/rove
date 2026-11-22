import { useEffect, useState } from 'react'
import { closeInput, getAudioContext, openInput } from './engine'
import { describeInputError } from './devices'

interface MicInput {
  source: MediaStreamAudioSourceNode | null
  error: string | null
}

export function useMicInput(deviceId: string | null): MicInput {
  const [input, setInput] = useState<MicInput>({ source: null, error: null })

  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    let stream: MediaStream | null = null

    openInput(deviceId)
      .then((s) => {
        if (cancelled) return closeInput(s)
        stream = s
        setInput({ source: getAudioContext().createMediaStreamSource(s), error: null })
      })
      .catch((err) => {
        if (!cancelled) setInput({ source: null, error: describeInputError(err) })
      })

    // Consumers of the source (meter, recorder) each disconnect their own
    // connections; a blanket disconnect() here would make theirs throw.
    return () => {
      cancelled = true
      if (stream) closeInput(stream)
      setInput({ source: null, error: null })
    }
  }, [deviceId])

  return input
}
