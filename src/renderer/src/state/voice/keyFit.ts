import { type Entry, combine, profileOf } from '../../audio/voice'
import type { TakeSummary } from '@shared/songs/voice'
import { MUSIC_SEMITONES_MAX } from '../song/project'
import { KEY_FIT_MIN_GAIN, KEY_FIT_SONG_SEC, KEY_FIT_ZONE_SEC } from './constants'

/** Lowest and highest notes, as MIDI note numbers. */
export interface NoteRange {
  low: number
  high: number
}

export interface KeySuggestion {
  /** The key shift that suits the singer. */
  semitones: number
  /** Where they sing this song at the current key. */
  sung: NoteRange
  /** Their comfort zone, from their other songs. */
  zone: NoteRange
}

const shifted = (range: NoteRange, by: number): NoteRange => ({
  low: range.low + by,
  high: range.high + by
})

/** Semitones of the range that fall outside the zone, both ends together. */
const spill = (range: NoteRange, zone: NoteRange): number =>
  Math.max(0, zone.low - range.low) + Math.max(0, range.high - zone.high)

const centre = (range: NoteRange): number => (range.low + range.high) / 2

/**
 * The key shift that puts a song (its range at the original key) inside the comfort zone,
 * or centres it when it's wider; null when it isn't clearly better than the current one.
 */
export function suggestedShift(song: NoteRange, zone: NoteRange, current: number): number | null {
  const cost = (s: number): [number, number, number] => [
    spill(shifted(song, s), zone),
    Math.abs(centre(shifted(song, s)) - centre(zone)),
    Math.abs(s - current)
  ]
  let best = current
  for (let s = -MUSIC_SEMITONES_MAX; s <= MUSIC_SEMITONES_MAX; s++) {
    const [a, b] = [cost(s), cost(best)]
    const better = a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
    if (better < 0) best = s
  }
  const gain = spill(shifted(song, current), zone) - spill(shifted(song, best), zone)
  return gain >= KEY_FIT_MIN_GAIN ? best : null
}

/** A take's notes as if sung at the song's original key. */
const atOriginalKey = ({ ref, summary }: Entry): TakeSummary => {
  const noteSec: Record<number, number> = {}
  for (const [note, sec] of Object.entries(summary.noteSec)) {
    noteSec[+note - ref.semitones] = sec
  }
  return { ...summary, noteSec }
}

/** Where most of the singing sits, once there's enough of it. */
function comfortOf(summaries: TakeSummary[], minSec: number): NoteRange | null {
  const profile = profileOf(combine(summaries))
  const { comfortLow: low, comfortHigh: high } = profile
  return profile.sungSec >= minSec && low !== null && high !== null ? { low, high } : null
}

/**
 * A key that suits the singer better for this song, from their lead takes: where they sang
 * it, against their comfort zone in their other songs. Null until there's enough of both,
 * or when the current key already suits them.
 */
export function keySuggestion(
  entries: Entry[],
  folder: string,
  current: number
): KeySuggestion | null {
  const lead = entries.filter((e) => e.ref.part === 'lead')
  const song = comfortOf(
    lead.filter((e) => e.ref.folder === folder).map(atOriginalKey),
    KEY_FIT_SONG_SEC
  )
  const zone = comfortOf(
    lead.filter((e) => e.ref.folder !== folder).map((e) => e.summary),
    KEY_FIT_ZONE_SEC
  )
  if (!song || !zone) return null
  const semitones = suggestedShift(song, zone, current)
  return semitones === null ? null : { semitones, sung: shifted(song, current), zone }
}
