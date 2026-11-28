import { type TakeRef, type TakeSummary, type VoiceCacheEntry } from '@shared/songs/voice'
import { VOICE_ANALYSIS_VERSION } from '@shared/songs/constants'
import { Entry, summariseInWorker } from '../../audio/voice'

type Window = Pick<TakeRef, 'folder' | 'file' | 'offsetSec' | 'durationSec'>
const keyOf = (w: Window): string => JSON.stringify([w.folder, w.file, w.offsetSec, w.durationSec])

interface Options {
  /** Called before each take that has to be listened to. */
  onListening?(done: number, total: number): void
  /** Checked between takes: true stops listening, keeping what's been heard. */
  stopped?(): boolean
}

async function load({ onListening, stopped }: Options): Promise<Entry[]> {
  const { voice } = window.api
  const [refs, cache] = await Promise.all([voice.listTakes(), voice.loadCache()])
  const summaries = new Map<string, TakeSummary>(cache.map((e) => [keyOf(e), e.summary]))
  const missing = [...new Map(refs.map((r) => [keyOf(r), r])).values()].filter(
    (r) => !summaries.has(keyOf(r))
  )
  for (const [done, ref] of missing.entries()) {
    if (stopped?.()) break
    onListening?.(done, missing.length)
    try {
      const bytes = await voice.readTake(ref.folder, ref.file)
      summaries.set(keyOf(ref), await summariseInWorker(bytes, ref))
    } catch {
      // A take that can't be read or listened to is left out, and tried again next
      // time; the rest of the profile still shows.
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
  return entries
}

// One load at a time: the voice profile and the key suggestion both save the cache, and
// a later load then reuses what an earlier one listened to.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Every vocal clip on every Songbook song, summarised. Clips already in the cache are
 * read from it; the rest are listened to one at a time, then the cache is saved with
 * just the clips that still exist, so trimmed or deleted clips drop out of it.
 */
export function loadVoiceEntries(options: Options = {}): Promise<Entry[]> {
  const run = queue.then(
    () => load(options),
    () => load(options)
  )
  queue = run.catch(() => {})
  return run
}
