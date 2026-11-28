import { useRef } from 'react'
import { playBeat } from '../../state/chords/instruments/preview'
import type { BarBeat, BeatChart, Project } from '../../state/song/project'

export type HearBeat = (
  project: Project,
  beats: BeatChart,
  part: BarBeat | null,
  onEnded?: () => void
) => void

/**
 * Plays one beat at a time in the Instrumental panel: hearing another (or none) stops
 * the one playing. It lives with the screen, so a beat still playing when the panel
 * closes is stopped by the next one.
 */
export function useBeatPlayer(): HearBeat {
  const playing = useRef<(() => void) | null>(null)
  return (project, beats, part, onEnded) => {
    playing.current?.()
    playing.current = null
    if (!part) return
    const stop = playBeat(project, beats, part, () => {
      // A beat stopped to play another ends late: only the latest counts.
      if (playing.current !== stop) return
      playing.current = null
      onEnded?.()
    })
    playing.current = stop
  }
}
