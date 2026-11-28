import { useEffect, useMemo, useState } from 'react'
import { songFolderName } from '@shared/songs/project'
import type { Entry } from '../../audio/voice'
import { type OpenSong } from '../song/useSong'
import { musicOf } from '../song/project'
import { type KeySuggestion, keySuggestion } from './keyFit'
import { loadVoiceEntries } from './voiceEntries'

/** This song's lead takes, as a string that changes when one is added, trimmed or removed. */
const leadTakesOf = (open: OpenSong | null): string =>
  JSON.stringify(
    open?.data.tracks
      .filter((track) => track.role === 'vocal' && track.part !== 'harmony')
      .flatMap((track) => track.clips.map((c) => [c.file, c.offset, c.duration])) ?? []
  )

/**
 * A key that suits the singer better for the open song, from their own takes. Listens
 * only while `enabled` (the Music panel shows), and again when this song's lead takes
 * change, so a new take counts.
 */
export function useKeySuggestion(open: OpenSong | null, enabled: boolean): KeySuggestion | null {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const takes = leadTakesOf(open)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadVoiceEntries({ stopped: () => cancelled }).then(
      (loaded) => {
        if (!cancelled) setEntries(loaded)
      },
      // No suggestion is the quiet fallback; the voice profile reports its own failures.
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [enabled, takes])

  const dir = open?.dir
  const semitones = open ? musicOf(open.data).semitones : 0
  return useMemo(
    () => (entries && dir ? keySuggestion(entries, songFolderName(dir), semitones) : null),
    [entries, dir, semitones]
  )
}
