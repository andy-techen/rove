import { VOICE_UNLOCK_SEC } from '@shared/voice'
import { Entry, VoiceProfile, byMonth, bySong, combine, profileOf } from '../../audio/voice'

const SEMITONES = 12

/** The notes the charts' keyboard spans: whole octaves, C to B. */
export interface KeyRange {
  low: number
  high: number
}

export interface MonthView {
  year: number
  /** 0 for January. */
  month: number
  /** Null for a month with no singing. */
  profile: VoiceProfile | null
  /** This month reached a note higher (or lower) than any month before it. */
  newHigh: boolean
  newLow: boolean
}

export interface SongView {
  folder: string
  songName: string
  profile: VoiceProfile
}

/** What's been listened to, for the cards at the top. */
export interface VoiceTotals {
  songs: number
  /** Seconds of recording on the timelines, sung or not. */
  recordedSec: number
  /** Takes listened to; a take split into several clips counts once. */
  takes: number
}

export type VoiceView =
  | { locked: true; sungSec: number; totals: VoiceTotals }
  | {
      locked: false
      totals: VoiceTotals
      overall: VoiceProfile
      months: MonthView[]
      songs: SongView[]
      keys: KeyRange
    }

/** Whole octaves around every note any chart will draw. */
function keyRangeOf(profiles: VoiceProfile[]): KeyRange {
  const notes = profiles.flatMap((p) => [
    ...p.noteTime.map((n) => n.note),
    ...[p.lowestNote, p.highestNote].filter((n): n is number => n !== null)
  ])
  const low = Math.min(...notes)
  const high = Math.max(...notes)
  return {
    low: Math.floor(low / SEMITONES) * SEMITONES,
    high: Math.floor(high / SEMITONES) * SEMITONES + SEMITONES - 1
  }
}

function monthViews(entries: Entry[]): MonthView[] {
  let highest: number | null = null
  let lowest: number | null = null
  return byMonth(entries).map(({ year, month, summary }) => {
    if (summary.sungSec === 0) {
      return { year, month, profile: null, newHigh: false, newLow: false }
    }
    const profile = profileOf(summary)
    const { highestNote: high, lowestNote: low } = profile
    const newHigh = highest !== null && high !== null && high > highest
    const newLow = lowest !== null && low !== null && low < lowest
    if (high !== null) highest = highest === null ? high : Math.max(highest, high)
    if (low !== null) lowest = lowest === null ? low : Math.min(lowest, low)
    return { year, month, profile, newHigh, newLow }
  })
}

function totalsOf(entries: Entry[]): VoiceTotals {
  return {
    songs: new Set(entries.map((e) => e.ref.folder)).size,
    recordedSec: entries.reduce((sum, e) => sum + e.summary.recordedSec, 0),
    takes: new Set(entries.map((e) => JSON.stringify([e.ref.folder, e.ref.file]))).size
  }
}

/** What the Your voice section shows, from every summarised take window. */
export function voiceView(entries: Entry[]): VoiceView {
  const overall = profileOf(combine(entries.map((e) => e.summary)))
  const totals = totalsOf(entries)
  if (overall.sungSec < VOICE_UNLOCK_SEC) return { locked: true, sungSec: overall.sungSec, totals }
  const songs = bySong(entries).map(({ folder, songName, summary }) => ({
    folder,
    songName,
    profile: profileOf(summary)
  }))
  return {
    locked: false,
    totals,
    overall,
    months: monthViews(entries),
    songs,
    keys: keyRangeOf([overall])
  }
}
