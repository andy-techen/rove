import { useEffect, useState } from 'react'
import { Entry } from '../../audio/voice'
import { loadVoiceEntries } from './voiceEntries'

export type VoiceProfileState =
  | { status: 'loading' }
  | { status: 'listening'; done: number; total: number }
  | { status: 'ready'; entries: Entry[] }
  | { status: 'failed' }

/** Every vocal clip on every Songbook song, summarised, with progress while listening. */
export function useVoiceProfile(): VoiceProfileState {
  const [state, setState] = useState<VoiceProfileState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadVoiceEntries({
      onListening: (done, total) => setState({ status: 'listening', done, total }),
      stopped: () => cancelled
    }).then(
      (entries) => !cancelled && setState({ status: 'ready', entries }),
      () => !cancelled && setState({ status: 'failed' })
    )
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
