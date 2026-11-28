import { useEffect, useMemo, useState } from 'react'
import { Plan } from '@shared/features'
import { SongKey } from '../../audio/pitch/key'
import { hasRender } from '../../audio/dsp/renderCache'
import { changeMusicBuffer, musicKey } from '../../audio/music/stretch'
import { tuneBuffer, tuningKey } from '../../audio/pitch/tuning'
import { Project, musicOf } from '../song/project'
import { tuningOf } from './tuning'

/** Changed copies of recordings, by track id and then clip file. */
export type ProcessedAudio = Record<string, Record<string, AudioBuffer>>

// Waits for a slider to settle before rendering, so a drag doesn't queue up renders.
const RENDER_DEBOUNCE_MS = 250

interface Job {
  trackId: string
  file: string
  buffer: AudioBuffer
  /** Names this version, so a finished render is matched to the settings it's for. */
  key: string
  /**
   * Music clips are measured in time as played at the new speed, so they mustn't play
   * the original while the new version renders. A tuned vocal can (it lines up either way).
   */
  mustMatch: boolean
  render(): Promise<AudioBuffer>
}

/** Every recording that plays changed: tuned vocals, and music at a new speed or key. */
function jobsFor(
  project: Project,
  audio: Record<string, AudioBuffer>,
  key: SongKey | null,
  plan: Plan
): Job[] {
  const music = musicOf(project)
  const musicChanged = music.speed !== 1 || music.semitones !== 0
  return project.tracks.flatMap((track) => {
    const tuning = tuningOf(track, key, plan)
    const changesMusic = track.role === 'backing' && musicChanged
    if (!tuning && !changesMusic) return []
    return track.clips.flatMap((clip): Job[] => {
      const buffer = audio[clip.file]
      if (!buffer) return []
      const at = { trackId: track.id, file: clip.file, buffer }
      return [
        tuning
          ? {
              ...at,
              key: tuningKey(tuning),
              mustMatch: false,
              render: () => tuneBuffer(buffer, tuning)
            }
          : {
              ...at,
              key: musicKey(music),
              mustMatch: true,
              render: () => changeMusicBuffer(buffer, music)
            }
      ]
    })
  })
}

/** Makes every changed copy the project needs (remembered, so it's quick the second time). */
export async function processProject(
  project: Project,
  audio: Record<string, AudioBuffer>,
  key: SongKey | null,
  plan: Plan
): Promise<ProcessedAudio> {
  const result: ProcessedAudio = {}
  for (const job of jobsFor(project, audio, key, plan)) {
    const buffer = await job.render()
    result[job.trackId] = { ...result[job.trackId], [job.file]: buffer }
  }
  return result
}

/** The buffer to play for a clip: its changed copy when there is one. */
export const bufferFor = (
  audio: Record<string, AudioBuffer>,
  processed: ProcessedAudio,
  trackId: string,
  file: string
): AudioBuffer | undefined => processed[trackId]?.[file] ?? audio[file]

export interface Processing {
  processed: ProcessedAudio
  /** Something is rendering. */
  busy: boolean
  /** The music's clips don't have their audio yet; playing now would be out of time. */
  waiting: boolean
}

/**
 * Keeps changed copies in step with the project. While a new tuning renders, the
 * previous one keeps playing; anything switched back to as-recorded plays as recorded
 * straight away.
 */
export function useProcessedAudio(
  project: Project | undefined,
  audio: Record<string, AudioBuffer>,
  key: SongKey | null,
  plan: Plan
): Processing {
  const [rendered, setRendered] = useState<{ processed: ProcessedAudio; keys: string[] }>({
    processed: {},
    keys: []
  })
  const [busy, setBusy] = useState(false)
  const jobs = project ? jobsFor(project, audio, key, plan) : []
  // Only what rendering depends on, so unrelated edits (a fade, a volume) don't re-render.
  const signature = jobs.map((j) => `${j.trackId}:${j.file}:${j.key}`).join(';')

  useEffect(() => {
    if (!project) return
    let cancelled = false
    const current = jobsFor(project, audio, key, plan)
    const pending = current.some((j) => !hasRender(j.buffer, j.key))
    const timer = setTimeout(
      () => {
        if (pending) setBusy(true)
        processProject(project, audio, key, plan)
          .then((processed) => {
            if (!cancelled) setRendered({ processed, keys: current.map(jobId) })
          })
          .catch(() => {
            // Plays as recorded; the next change tries again.
          })
          .finally(() => !cancelled && setBusy(false))
      },
      pending ? RENDER_DEBOUNCE_MS : 0
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `signature` captures everything about the project and audio this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const ids = jobs.map(jobId).join(';')
  const strictMissing = jobs.filter((j) => j.mustMatch && !rendered.keys.includes(jobId(j)))
  const waiting = strictMissing.length > 0
  const processed = useMemo(() => {
    const wanted = new Map(jobs.map((j) => [`${j.trackId}:${j.file}`, j]))
    const out: ProcessedAudio = {}
    for (const [trackId, files] of Object.entries(rendered.processed)) {
      for (const [file, buffer] of Object.entries(files)) {
        const job = wanted.get(`${trackId}:${file}`)
        // Keep a copy only while its track is still changed, and for music only the
        // version for the current speed and key.
        if (!job || (job.mustMatch && !rendered.keys.includes(jobId(job)))) continue
        out[trackId] = { ...out[trackId], [file]: buffer }
      }
    }
    return out
    // `ids` captures the jobs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, ids])
  return { processed, busy, waiting }
}

const jobId = (job: Job): string => `${job.trackId}:${job.file}:${job.key}`
