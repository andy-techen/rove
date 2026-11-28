import { useEffect, useState } from 'react'
import { type TakeRef, type TakeSummary, type VoiceCacheEntry } from '@shared/songs/voice'
import { VOICE_ANALYSIS_VERSION } from '@shared/songs/constants'
import { Entry, summariseInWorker } from '../../audio/voice'

export type VoiceProfileState =
  | { status: 'loading' }
  | { status: 'listening'; done: number; total: number }
  | { status: 'ready'; entries: Entry[] }
  | { status: 'failed' }

type Window = Pick<TakeRef, 'folder' | 'file' | 'offsetSec' | 'durationSec'>
const keyOf = (w: Window): string => JSON.stringify([w.folder, w.file, w.offsetSec, w.durationSec])

/**
 * Every vocal clip on every Songbook song, summarised. Clips already in the cache are
 * read from it; the rest are listened to one at a time, then the cache is saved with
 * just the clips that still exist, so trimmed or deleted clips drop out of it.
 */
export function useVoiceProfile(): VoiceProfileState {
  const [state, setState] = useState<VoiceProfileState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { voice } = window.api
        const [refs, cache] = await Promise.all([voice.listTakes(), voice.loadCache()])
        const summaries = new Map<string, TakeSummary>(cache.map((e) => [keyOf(e), e.summary]))
        const missing = [...new Map(refs.map((r) => [keyOf(r), r])).values()].filter(
          (r) => !summaries.has(keyOf(r))
        )
        for (const [done, ref] of missing.entries()) {
          if (cancelled) break
          setState({ status: 'listening', done, total: missing.length })
          try {
            const bytes = await voice.readTake(ref.folder, ref.file)
            summaries.set(keyOf(ref), await summariseInWorker(bytes, ref))
          } catch {
            // A take that can't be read or listened to is left out, and tried again
            // next time; the rest of the profile still shows.
          }
        }
        const entries = refs.flatMap((ref) => {
          const summary = summaries.get(keyOf(ref))
          return summary ? [{ ref, summary }] : []
        })
        const kept = new Map<string, VoiceCacheEntry>()
        for (const { ref, summary } of entries) {
          const { folder, file, offsetSec, durationSec } = ref
          kept.set(keyOf(ref), {
            folder,
            file,
            offsetSec,
            durationSec,
            version: VOICE_ANALYSIS_VERSION,
            summary
          })
        }
        await voice.saveCache([...kept.values()])
        if (!cancelled) setState({ status: 'ready', entries })
      } catch {
        if (!cancelled) setState({ status: 'failed' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
