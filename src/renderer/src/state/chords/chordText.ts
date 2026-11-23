import { CHORD_QUALITIES, Chord, ChordQuality } from '../../audio/music/chords'
import { PITCH_CLASSES } from '../../audio/pitch/key'
import { chordName } from './noteNames'

const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const SHARP = /^[#♯]/
const FLAT = /^[b♭]/

// How chord sheets write each kind, including the common shorthands. Matched exactly
// (case matters: "M7" is major seventh, "m7" minor seventh).
const SUFFIXES: Record<string, ChordQuality> = {
  '': 'major',
  M: 'major',
  maj: 'major',
  m: 'minor',
  min: 'minor',
  '-': 'minor',
  '7': '7',
  dom7: '7',
  maj7: 'maj7',
  M7: 'maj7',
  ma7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  m7: 'm7',
  min7: 'm7',
  '-7': 'm7',
  sus2: 'sus2',
  sus: 'sus4',
  sus4: 'sus4',
  dim: 'dim',
  '°': 'dim',
  o: 'dim'
}

/** A note name ("E", "F♯", "Bb") at the start of `text`, and how much of it it used. */
function readNote(text: string): { pitch: number; length: number } | null {
  const letter = LETTERS[text[0]?.toLowerCase() ?? '']
  if (letter === undefined) return null
  const rest = text.slice(1)
  const shift = SHARP.test(rest) ? 1 : FLAT.test(rest) ? -1 : 0
  return {
    pitch: (letter + shift + PITCH_CLASSES) % PITCH_CLASSES,
    length: shift === 0 ? 1 : 2
  }
}

/** A chord as written on a chord sheet ("Am", "F♯7", "Bbmaj7", "C/E"), or null. */
export function parseChord(text: string): Chord | null {
  const [body, bassText, extra] = text.trim().split('/')
  if (!body || extra !== undefined) return null
  const root = readNote(body)
  if (!root) return null
  const quality = SUFFIXES[body.slice(root.length)]
  if (!quality) return null
  if (bassText === undefined) return { root: root.pitch, quality }
  const bass = readNote(bassText)
  if (!bass || bass.length !== bassText.length) return null
  return bass.pitch === root.pitch
    ? { root: root.pitch, quality }
    : { root: root.pitch, quality, bass: bass.pitch }
}

// A bar written as one of these keeps the chord before it going.
const CARRY_ON = new Set(['%', '-', '.', '·', '/'])

/**
 * A chart typed or pasted as text: "C G Am F" (one chord per bar) or
 * "| C | G | F G | C |" (bars between lines, chords in a bar share it). Anything it
 * can't read is listed in `unread` and its bar left to carry the last chord on.
 */
export function chartFromText(text: string): { bars: Chord[][]; unread: string[] } {
  const unread: string[] = []
  const readBar = (tokens: string[]): Chord[] =>
    tokens.flatMap((token) => {
      if (CARRY_ON.has(token)) return []
      const chord = parseChord(token)
      if (!chord) unread.push(token)
      return chord ? [chord] : []
    })
  const words = (s: string): string[] => s.split(/\s+/).filter(Boolean)
  if (!text.includes('|')) return { bars: words(text).map((w) => readBar([w])), unread }
  const cells = text.split('|')
  // "| C | G |" has nothing before the first line or after the last.
  if (!cells[0].trim()) cells.shift()
  if (cells.length && !cells.at(-1)?.trim()) cells.pop()
  return { bars: cells.map((cell) => readBar(words(cell))), unread }
}

/** Every chord the picker offers: each kind on each root, C first. */
export const ALL_CHORDS: Chord[] = Array.from({ length: PITCH_CLASSES }, (_, root) =>
  CHORD_QUALITIES.map((quality) => ({ root, quality }))
).flat()

const simplified = (s: string): string =>
  s.toLowerCase().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '')

/**
 * The chords matching what's been typed: the exact chord first when it reads as one
 * ("Db7" finds C♯7), then every chord whose name starts with it.
 */
export function chordsMatching(text: string, limit: number): Chord[] {
  const typed = simplified(text)
  if (!typed) return []
  const exact = parseChord(text)
  const starts = ALL_CHORDS.filter((c) => simplified(chordName(c)).startsWith(typed))
  const all = exact ? [exact, ...starts.filter((c) => !sameChord(c, exact))] : starts
  return all.slice(0, limit)
}

export const sameChord = (a: Chord | null | undefined, b: Chord | null | undefined): boolean =>
  !!a && !!b && a.root === b.root && a.quality === b.quality && a.bass === b.bass
