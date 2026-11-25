import { LANDING_BINS, TakeSummary } from '@shared/voice'
import type { Entry } from '../../audio/voice'

interface Sung {
  /** Seconds sung, spread evenly over the notes. */
  sec?: number
  /** Seconds of recording; twice the singing unless given. */
  recordedSec?: number
  notes?: number[]
  /** Held notes per landing bin; bin 10 is 0–5 cents sharp. */
  landing?: Record<number, number>
  tone?: TakeSummary['tone']
}

/** A summarised take window on a song, recorded on a date: test data for voice views. */
export function sungEntry(folder: string, date: string, sung: Sung = {}): Entry {
  const { sec = 60, notes = [48, 55, 60], landing = { 10: 4 } } = sung
  const noteSec = Object.fromEntries(notes.map((n) => [n, sec / notes.length]))
  return {
    ref: {
      folder,
      songName: folder,
      file: `audio/take-${date}.wav`,
      offsetSec: 0,
      durationSec: 0,
      part: 'lead',
      recordedAt: new Date(`${date}T12:00:00`).getTime()
    },
    summary: {
      sungSec: sec,
      recordedSec: sung.recordedSec ?? 2 * sec,
      noteSec,
      lowestNote: Math.min(...notes),
      highestNote: Math.max(...notes),
      landing: Array.from({ length: LANDING_BINS }, (_, i) => landing[i] ?? 0),
      tone: sung.tone ?? { body: 1, mid: 1, presence: 1, air: 1, frames: 1 }
    }
  }
}
