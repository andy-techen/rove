import { LANDING_BIN_CENTS, LANDING_RANGE_CENTS, TakeRef, TakeSummary } from '@shared/voice'
import { AIR_BAND, BODY_BAND, Band, PRESENCE_BAND, densityDb } from '../dsp/voiceBands'
import { emptySummary } from './summary'

// The comfort zone is where most of the singing sits: the notes below which 5% and
// above which 5% of the sung time falls, so a stray low or high note doesn't stretch it.
const COMFORT_PERCENT = { low: 0.05, high: 0.95 }
// A held note within this many cents of the note counts as landing on it. Most
// listeners don't hear a held note as out of tune until it's 20–25 cents off.
const LANDED_CENTS = 20

/**
 * Where each tone measure (per Hz, relative to 1–2 kHz) sits from 0 to 1. Centred on
 * auto polish's TONE_REFERENCE, so a typical voice lands mid-scale. Starting values:
 * the main session will tune them by ear across voices and mics.
 */
const TONE_RANGE_DB: Record<keyof Tone, { band: Band; low: number; high: number }> = {
  warmth: { band: BODY_BAND, low: -5, high: 25 },
  clarity: { band: PRESENCE_BAND, low: -23, high: 7 },
  air: { band: AIR_BAND, low: -45, high: -5 }
}

export interface Tone {
  warmth: number
  clarity: number
  air: number
}

/** What the voice profile's charts show, from one combined summary. */
export interface VoiceProfile {
  sungSec: number
  /** Notes are MIDI note numbers; null when nothing was sung. */
  comfortLow: number | null
  comfortHigh: number | null
  mostUsedNote: number | null
  lowestNote: number | null
  highestNote: number | null
  /** Share of held notes landing within LANDED_CENTS of the note; null with none held. */
  landedShare: number | null
  landing: number[]
  /** Seconds on each note, lowest note first. */
  noteTime: { note: number; sec: number }[]
  /** Each from 0 to 1; null when no singing was heard. */
  tone: Tone | null
}

const minOf = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.min(a, b)
const maxOf = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b)

/** Adds summaries together. */
export function combine(summaries: TakeSummary[]): TakeSummary {
  return summaries.reduce((sum, s) => {
    const noteSec = { ...sum.noteSec }
    for (const [note, sec] of Object.entries(s.noteSec)) {
      noteSec[+note] = (noteSec[+note] ?? 0) + sec
    }
    return {
      sungSec: sum.sungSec + s.sungSec,
      noteSec,
      lowestNote: minOf(sum.lowestNote, s.lowestNote),
      highestNote: maxOf(sum.highestNote, s.highestNote),
      landing: sum.landing.map((n, i) => n + (s.landing[i] ?? 0)),
      tone: {
        body: sum.tone.body + s.tone.body,
        mid: sum.tone.mid + s.tone.mid,
        presence: sum.tone.presence + s.tone.presence,
        air: sum.tone.air + s.tone.air,
        frames: sum.tone.frames + s.tone.frames
      }
    }
  }, emptySummary())
}

/** The note at or below which a share of the sung time falls. */
function noteAtShare(noteTime: VoiceProfile['noteTime'], share: number): number | null {
  const total = noteTime.reduce((sum, n) => sum + n.sec, 0)
  let sofar = 0
  for (const { note, sec } of noteTime) {
    sofar += sec
    if (sofar >= share * total) return note
  }
  return null
}

function landedShare(landing: number[]): number | null {
  const held = landing.reduce((a, b) => a + b, 0)
  if (held === 0) return null
  const landed = landing.reduce((sum, n, i) => {
    const low = -LANDING_RANGE_CENTS + i * LANDING_BIN_CENTS
    return low >= -LANDED_CENTS && low + LANDING_BIN_CENTS <= LANDED_CENTS ? sum + n : sum
  }, 0)
  return landed / held
}

function toneOf({ body, mid, presence, air, frames }: TakeSummary['tone']): Tone | null {
  if (frames === 0 || mid === 0) return null
  const power: Record<keyof Tone, number> = { warmth: body, clarity: presence, air }
  const position = (key: keyof Tone): number => {
    const { band, low, high } = TONE_RANGE_DB[key]
    const db = densityDb(power[key], band, mid)
    return Math.min(1, Math.max(0, (db - low) / (high - low)))
  }
  return { warmth: position('warmth'), clarity: position('clarity'), air: position('air') }
}

export function profileOf(summary: TakeSummary): VoiceProfile {
  const noteTime = Object.entries(summary.noteSec)
    .map(([note, sec]) => ({ note: +note, sec }))
    .filter((n) => n.sec > 0)
    .sort((a, b) => a.note - b.note)
  const mostUsed = noteTime.reduce<VoiceProfile['noteTime'][number] | null>(
    (best, n) => (!best || n.sec > best.sec ? n : best),
    null
  )
  return {
    sungSec: summary.sungSec,
    comfortLow: noteAtShare(noteTime, COMFORT_PERCENT.low),
    comfortHigh: noteAtShare(noteTime, COMFORT_PERCENT.high),
    mostUsedNote: mostUsed?.note ?? null,
    lowestNote: summary.lowestNote,
    highestNote: summary.highestNote,
    landedShare: landedShare(summary.landing),
    landing: summary.landing,
    noteTime,
    tone: toneOf(summary.tone)
  }
}

export interface Entry {
  ref: TakeRef
  summary: TakeSummary
}

export interface MonthSummary {
  year: number
  /** 0 for January, as Date counts them. */
  month: number
  summary: TakeSummary
}

const MONTHS_PER_YEAR = 12

/**
 * Summaries by calendar month of recording (local time), oldest first. Months with no
 * singing between the first and last are included, empty, so gaps show on a chart.
 */
export function byMonth(entries: Entry[]): MonthSummary[] {
  if (entries.length === 0) return []
  const index = ({ ref }: Entry): number => {
    const date = new Date(ref.recordedAt)
    return date.getFullYear() * MONTHS_PER_YEAR + date.getMonth()
  }
  const indices = entries.map(index)
  const first = Math.min(...indices)
  const last = Math.max(...indices)
  return Array.from({ length: last - first + 1 }, (_, i) => ({
    year: Math.floor((first + i) / MONTHS_PER_YEAR),
    month: (first + i) % MONTHS_PER_YEAR,
    summary: combine(entries.filter((_, e) => indices[e] === first + i).map((e) => e.summary))
  }))
}

export interface SongSummary {
  folder: string
  songName: string
  summary: TakeSummary
}

/** Summaries by song, in the order the songs were first recorded. */
export function bySong(entries: Entry[]): SongSummary[] {
  const songs = new Map<string, { songName: string; firstAt: number; entries: Entry[] }>()
  for (const entry of entries) {
    const { folder, songName, recordedAt } = entry.ref
    const song = songs.get(folder) ?? { songName, firstAt: recordedAt, entries: [] }
    song.firstAt = Math.min(song.firstAt, recordedAt)
    song.entries.push(entry)
    songs.set(folder, song)
  }
  return [...songs.entries()]
    .sort(([, a], [, b]) => a.firstAt - b.firstAt)
    .map(([folder, song]) => ({
      folder,
      songName: song.songName,
      summary: combine(song.entries.map((e) => e.summary))
    }))
}
