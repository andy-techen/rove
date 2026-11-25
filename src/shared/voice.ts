// The voice profile: what the singer's recordings say about their voice across every
// song. Each played window of a take is listened to once and summed into a
// TakeSummary; the profile adds summaries together, overall, by month or by song.
// Summaries are kept in userData/voice.json so a take is never analysed twice.

/** Sung notes, in seconds, needed before the profile shows. */
export const VOICE_UNLOCK_SEC = 180

/** How finely held notes are sorted by how far they land from the note. */
export const LANDING_BIN_CENTS = 5
/** Held notes land between half a semitone flat and half a semitone sharp. */
export const LANDING_RANGE_CENTS = 50
export const LANDING_BINS = (2 * LANDING_RANGE_CENTS) / LANDING_BIN_CENTS

/** What one played window of a take adds to the profile. Every field adds up. */
export interface TakeSummary {
  /** Seconds where a sung note was heard. */
  sungSec: number
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
