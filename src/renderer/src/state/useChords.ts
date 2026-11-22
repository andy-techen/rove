import { useEffect, useState } from 'react'
import { ChordSegment, chordsOf } from '../audio/chords'
import { chordTimeline } from './chords'
import { Project, tracksOf } from './project'

export interface SongChords {
  /** The chords on the timeline; null while Rove is still listening. */
  chords: ChordSegment[] | null
  /** There's music to listen to at all. */
  hasMusic: boolean
}

/** The music's chords, heard from its first loaded recording and placed on the timeline. */
export function useChords(
  project: Project | undefined,
  audio: Record<string, AudioBuffer>
): SongChords {
  const file = project
    ? (tracksOf(project, 'backing')
        .flatMap((t) => t.clips)
        .find((c) => audio[c.file])?.file ?? null)
    : null
  const buffer = file ? audio[file] : undefined
  const [heard, setHeard] = useState<{ buffer: AudioBuffer; chords: ChordSegment[] } | null>(null)
  useEffect(() => {
    if (!buffer) return
    let cancelled = false
    void chordsOf(buffer).then((chords) => !cancelled && setHeard({ buffer, chords }))
    return () => {
      cancelled = true
    }
  }, [buffer])
  const ready = heard && heard.buffer === buffer && project && file
  return {
    chords: ready ? chordTimeline(project, file, heard.chords) : null,
    hasMusic: !!buffer
  }
}
