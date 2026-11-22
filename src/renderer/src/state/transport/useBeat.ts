import { useEffect, useState } from 'react'
import { Beat, beatOf } from '../../audio/music/stretch'
import { Project, tracksOf } from '../song/project'

/**
 * The music's beat, heard from its first loaded recording (as recorded, before any speed
 * change), and which recording it came from. Beat is null until heard, or without one.
 */
export function useBeat(
  project: Project | undefined,
  audio: Record<string, AudioBuffer>
): { beat: Beat | null; file: string | null } {
  const file = project
    ? (tracksOf(project, 'backing')
        .flatMap((t) => t.clips)
        .find((c) => audio[c.file])?.file ?? null)
    : null
  const buffer = file ? audio[file] : undefined
  const [heard, setHeard] = useState<{ buffer: AudioBuffer; beat: Beat | null } | null>(null)
  useEffect(() => {
    if (!buffer) return
    let cancelled = false
    void beatOf(buffer).then((beat) => !cancelled && setHeard({ buffer, beat }))
    return () => {
      cancelled = true
    }
  }, [buffer])
  return { beat: heard && heard.buffer === buffer ? heard.beat : null, file }
}
