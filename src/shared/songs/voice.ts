// The voice profile: what the singer's recordings say about their voice across every
// song. Each played window of a take is listened to once and summed into a
// TakeSummary; the profile adds summaries together, overall, by month or by song.
// Summaries are kept in userData/voice.json so a take is never analysed twice.

import { LANDING_BINS, VOICE_ANALYSIS_VERSION } from './constants'

/** What one played window of a take adds to the profile. Every field adds up. */
export interface TakeSummary {
  /** Seconds where a sung note was heard. */
  sungSec: number
  /** Seconds of recording in the window, sung or not. */
  recordedSec: number
  /** Seconds on each note, keyed by MIDI note number (60 is middle C). */
  noteSec: Record<number, number>
  /** The lowest and highest notes held long enough to count; null when none were. */
  lowestNote: number | null
  highestNote: number | null
  /**
   * Held notes by how far their middle sits from the nearest note: LANDING_BINS counts,
   * from LANDING_RANGE_CENTS flat to LANDING_RANGE_CENTS sharp.
   */
  landing: number[]
  /** Band power summed over the sung moments, and how many there were. Tone is their ratios. */
  tone: { body: number; mid: number; presence: number; air: number; frames: number }
}

/** One vocal clip on a Songbook song's timeline: the part of a take that plays. */
export interface TakeRef {
  /** The song's folder name under the songs folder. */
  folder: string
  songName: string
  /** The take, relative to the song folder ("audio/take-001.wav"). */
  file: string
  offsetSec: number
  /** 0 means to the end of the file (older projects). */
  durationSec: number
  part: 'lead' | 'harmony'
  /** When the take was recorded, in ms since the epoch. */
  recordedAt: number
}

/** A take window's summary, kept so it's never analysed twice. */
export interface VoiceCacheEntry {
  folder: string
  file: string
  offsetSec: number
  durationSec: number
  version: number
  summary: TakeSummary
}

export const VOICE_CHANNELS = {
  listTakes: 'voice:listTakes',
  readTake: 'voice:readTake',
  loadCache: 'voice:loadCache',
  saveCache: 'voice:saveCache'
} as const

/** What window.api offers the voice profile. */
export interface VoiceApi {
  listTakes(): Promise<TakeRef[]>
  /** The take's bytes; refused unless one of that song's vocal clips plays it. */
  readTake(folder: string, file: string): Promise<Uint8Array>
  loadCache(): Promise<VoiceCacheEntry[]>
  saveCache(entries: VoiceCacheEntry[]): Promise<void>
}

/** A vocal clip as project.json has it: which part of which take plays. */
export type VocalClip = Pick<TakeRef, 'file' | 'offsetSec' | 'durationSec' | 'part'>

const isSeconds = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

/**
 * Every vocal clip in a project.json, lead and harmony. Malformed clips are left out, and a
 * clip copied to another spot on the timeline counts once: it's the same singing.
 */
export function vocalClipsOf(manifest: unknown): VocalClip[] {
  const m = manifest as { tracks?: unknown } | null
  if (!m || !Array.isArray(m.tracks)) return []
  const clips: VocalClip[] = []
  const seen = new Set<string>()
  for (const track of m.tracks as unknown[]) {
    const tr = track as { role?: unknown; part?: unknown; clips?: unknown } | null
    if (!tr || !Array.isArray(tr.clips) || tr.role !== 'vocal') continue
    const part = tr.part === 'harmony' ? 'harmony' : 'lead'
    for (const clip of tr.clips as unknown[]) {
      const c = clip as { file?: unknown; offset?: unknown; duration?: unknown } | null
      if (!c || typeof c.file !== 'string' || !c.file) continue
      const offsetSec = c.offset ?? 0
      const durationSec = c.duration ?? 0
      if (!isSeconds(offsetSec) || !isSeconds(durationSec)) continue
      const key = JSON.stringify([c.file, offsetSec, durationSec])
      if (seen.has(key)) continue
      seen.add(key)
      clips.push({ file: c.file, offsetSec, durationSec, part })
    }
  }
  return clips
}

function parseNoteSec(raw: unknown): Record<number, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const notes: Record<number, number> = {}
  for (const [key, sec] of Object.entries(raw)) {
    const note = Number(key)
    if (!Number.isInteger(note) || note < 0 || !isSeconds(sec)) return null
    notes[note] = sec
  }
  return notes
}

const isNote = (n: unknown): n is number | null =>
  n === null || (Number.isInteger(n) && (n as number) >= 0)

function parseSummary(raw: unknown): TakeSummary | null {
  const s = raw as Partial<Record<keyof TakeSummary, unknown>> | null
  // Summaries from before recordedSec existed fail here, so those windows are listened to again.
  if (!s || !isSeconds(s.sungSec) || !isSeconds(s.recordedSec)) return null
  if (!isNote(s.lowestNote) || !isNote(s.highestNote)) return null
  const noteSec = parseNoteSec(s.noteSec)
  if (!noteSec) return null
  const { landing } = s
  if (!Array.isArray(landing) || landing.length !== LANDING_BINS || !landing.every(isSeconds)) {
    return null
  }
  const tone = s.tone as Partial<TakeSummary['tone']> | null
  if (
    !tone ||
    !isSeconds(tone.body) ||
    !isSeconds(tone.mid) ||
    !isSeconds(tone.presence) ||
    !isSeconds(tone.air) ||
    !isSeconds(tone.frames)
  ) {
    return null
  }
  return {
    sungSec: s.sungSec,
    recordedSec: s.recordedSec,
    noteSec,
    lowestNote: s.lowestNote,
    highestNote: s.highestNote,
    landing: [...landing],
    tone: {
      body: tone.body,
      mid: tone.mid,
      presence: tone.presence,
      air: tone.air,
      frames: tone.frames
    }
  }
}

/** The stored summaries, keeping only well-formed entries; a bad one is analysed again. */
export function parseVoiceCache(raw: unknown): VoiceCacheEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: VoiceCacheEntry[] = []
  for (const entry of raw) {
    const e = entry as Partial<Record<keyof VoiceCacheEntry, unknown>> | null
    if (!e || typeof e.folder !== 'string' || !e.folder || typeof e.file !== 'string' || !e.file) {
      continue
    }
    if (!isSeconds(e.offsetSec) || !isSeconds(e.durationSec)) continue
    if (e.version !== VOICE_ANALYSIS_VERSION) continue
    const summary = parseSummary(e.summary)
    if (!summary) continue
    entries.push({
      folder: e.folder,
      file: e.file,
      offsetSec: e.offsetSec,
      durationSec: e.durationSec,
      version: VOICE_ANALYSIS_VERSION,
      summary
    })
  }
  return entries
}
