import { useEffect, useRef, useState } from 'react'
import { AUTO_POLISH_VERSION, suggestPolish } from '../../audio/polish/autoPolish'
import { PolishReading, analyseVoice } from '../../audio/polish/polishReading'
import { Project } from '../song/project'
import {
  heardOf,
  heardWindows,
  suggestionIsStale,
  withPolishSuggestion
} from '../song/polishSuggestion'

/** What the auto-polish button can do right now. */
export type AutoPolishStatus = 'ready' | 'stale' | 'noTakes' | 'listening'
/** How the last listen went, for the panel's status line. */
export type AutoPolishMessage = 'done' | 'tooShort' | 'tryAgain'

export interface AutoPolishState {
  status: AutoPolishStatus
  message: AutoPolishMessage | null
  /** The last listen found a take too loud to fix. */
  clipped: boolean
  listen(): void
}

interface Outcome {
  trackId: string
  /** The takes it's about: once they change, the message no longer applies. */
  heard: string
  message: AutoPolishMessage
  clipped: boolean
}

/**
 * Auto polish for one vocal track: only when the singer clicks, Rove listens to the
 * track's takes and sets its Polish (one undo step). Nothing here runs on its own.
 */
export function useAutoPolish(
  project: Project | undefined,
  audio: Record<string, AudioBuffer>,
  trackId: string | undefined,
  edit: (next: Project) => void
): AutoPolishState {
  const [listeningTo, setListeningTo] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // The listen ends after later renders; it applies to the song as it is by then.
  const latest = useRef(project)
  useEffect(() => {
    latest.current = project
  }, [project])
  // Profiles by what was heard, so a second click on unchanged takes is instant.
  const profiles = useRef(new Map<string, PolishReading | null>())

  const track = project?.tracks.find((t) => t.id === trackId)
  const windows = track ? heardWindows(track, audio) : []

  const listen = async (): Promise<void> => {
    if (!track || listeningTo || windows.length === 0) return
    const heard = heardOf(track)
    setListeningTo(track.id)
    setOutcome(null)
    let profile: PolishReading | null
    try {
      if (!profiles.current.has(heard)) profiles.current.set(heard, await analyseVoice(windows))
      profile = profiles.current.get(heard) ?? null
    } finally {
      setListeningTo(null)
    }
    const song = latest.current
    const now = song?.tracks.find((t) => t.id === track.id)
    const report = (message: AutoPolishMessage, clipped = false): void =>
      setOutcome({ trackId: track.id, heard: now ? heardOf(now) : heard, message, clipped })
    if (!song || !now || heardOf(now) !== heard) return report('tryAgain')
    if (!profile) return report('tooShort')
    edit(
      withPolishSuggestion(song, now.id, {
        ...suggestPolish(profile, now.part ?? 'lead'),
        heard,
        version: AUTO_POLISH_VERSION
      })
    )
    report('done', profile.clipped)
  }

  const shown =
    outcome &&
    track &&
    outcome.trackId === track.id &&
    outcome.heard === heardOf(track) &&
    // "Auto-polished" stops showing once the suggestion is undone.
    (outcome.message !== 'done' || !!track.polishSuggestion)
      ? outcome
      : null
  return {
    status:
      listeningTo && listeningTo === trackId
        ? 'listening'
        : windows.length === 0
          ? 'noTakes'
          : track && suggestionIsStale(track)
            ? 'stale'
            : 'ready',
    message: shown?.message ?? null,
    clipped: shown?.clipped ?? false,
    listen: () => void listen()
  }
}
