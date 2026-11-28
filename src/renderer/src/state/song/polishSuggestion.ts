import { heardOfClips } from '@shared/polishTaste'
import { PolishSuggestion } from '../../audio/polish/autoPolish'
import { HeardWindow } from '../../audio/polish/polishReading'
import { Project, Track, polishOf } from './project'

/** Names the clip windows a track plays, so a suggestion knows what it listened to. */
export const heardOf = (track: Track): string => heardOfClips(track.clips)

/** The played part of each of a track's takes whose audio is loaded. */
export function heardWindows(track: Track, audio: Record<string, AudioBuffer>): HeardWindow[] {
  return track.clips.flatMap((c) =>
    audio[c.file] ? [{ audio: audio[c.file], offsetSec: c.offset, durationSec: c.duration }] : []
  )
}

/** The takes changed since Rove last listened. */
export function suggestionIsStale(track: Track): boolean {
  return !!track.polishSuggestion && track.polishSuggestion.heard !== heardOf(track)
}

/**
 * Stores what Rove suggested and sets the knobs to it. The compare switch, Tuning and
 * Advanced overrides stay as the singer left them.
 */
export function withPolishSuggestion(
  project: Project,
  trackId: string,
  suggestion: PolishSuggestion
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            polishSuggestion: suggestion,
            polish: { ...polishOf(t), ...suggestion.amounts }
          }
        : t
    )
  }
}
