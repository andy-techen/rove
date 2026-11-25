import { CHORD_QUALITIES, Chord, ChordQuality } from '../../audio/music/chords'
import { PITCH_CLASSES } from '../../audio/pitch/key'
import { t } from '@shared/copy'
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

// Richer chords chord sheets use, played as the nearest kind Rove knows: an added or
// suspended colour drops away, ninths and up keep their seventh, half-diminished is
// played diminished. Matched exactly, like SUFFIXES.
const NEAREST: Record<string, ChordQuality> = {
  add9: 'major',
  add2: 'major',
  '2': 'major',
  '5': 'major',
  '6': 'major',
  '69': 'major',
  aug: 'major',
  '+': 'major',
  '9': '7',
  '11': '7',
  '13': '7',
  '7sus4': '7',
  '7sus': '7',
  '7b9': '7',
  '7#9': '7',
  maj9: 'maj7',
  M9: 'maj7',
  m6: 'minor',
  madd9: 'minor',
  mM7: 'minor',
  mmaj7: 'minor',
  m9: 'm7',
  m11: 'm7',
  m7b5: 'dim',
  ø: 'dim',
  ø7: 'dim',
  dim7: 'dim',
  '°7': 'dim',
  o7: 'dim'
}

// Sheets put a passing or optional chord in brackets: "(G)" is played as G.
const unbracketed = (text: string): string => text.replace(/^\((.+)\)$/, '$1')

/** A chord as a chord sheet writes it, richer ones played as their nearest. */
function sheetChord(written: string): Chord | null {
  const text = unbracketed(written)
  const exact = parseChord(text)
  if (exact) return exact
  const [body, ...bass] = text.split('/')
  const root = body && readNote(body)
  const quality = root && NEAREST[body.slice(root.length)]
  if (!root || !quality) return null
  const plain = parseChord([body.slice(0, root.length), ...bass].join('/'))
  return plain && { ...plain, quality }
}

/** A chord a paste couldn't read, and which pasted bar (from 0) it was in. */
export interface UnreadChord {
  name: string
  bar: number
}

// A bar written as one of these keeps the chord before it going ("N.C.": no chord).
const CARRY_ON = new Set(['%', '-', '.', '·', '/', 'N.C.', 'NC'])
// "x2", "(x3)", "2x": play the line that many times.
const REPEAT = /^\(?(?:[x×](\d+)|(\d+)[x×])\)?$/i
// A heading on its own line: "[Verse 1]", "[Chorus]".
const HEADING = /^\[[^\]]*\]$/
// A label before a line's chords: "Intro:", "Chorus 2:".
const LABEL = /^[A-Za-z][\w ]*:\s*/
// Chords written into the lyrics: "[C]Let it [G]be".
const INLINE = /\[([^\]]+)\]/g
// A line of guitar tab: "e|---3---|".
const TAB = /^[A-Ga-g][#b]?\s*\|[-\d|hpbr/\\~x ]*$/

const words = (s: string): string[] => s.split(/\s+/).filter(Boolean)

/**
 * A chart typed or pasted as text: "C G Am F" (one chord per bar), "| C | G | F G | C |"
 * (bars between lines, chords in a bar share it), or a chord sheet copied from the web,
 * chords above the lyrics or inside them in brackets, one bar per chord. Lyrics,
 * headings and tab are skipped. Anything on a line of chords it can't read is listed in
 * `unread` and its bar left to carry the last chord on.
 */
export function chartFromText(text: string): { bars: Chord[][]; unread: UnreadChord[] } {
  const unread: UnreadChord[] = []
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  // A whole sheet can hold lyrics, where "A" or "Am" is a word; only a capital letter
  // starts a chord there. A single typed line can be any case.
  const isChord = (token: string): boolean =>
    (lines.length === 1 || /^[A-G]/.test(unbracketed(token))) && !!sheetChord(token)

  // Each line's bars follow the ones before, so an unread chord can name its bar.
  const bars: Chord[][] = []
  const readLine = (line: string): Chord[][] => {
    if (TAB.test(line)) return []
    const inline = [...line.matchAll(INLINE)].map((m) => m[1].trim())
    if (inline.length && inline.every(isChord))
      return inline.map((name) => [sheetChord(name) as Chord])
    if (HEADING.test(line)) return []
    const body = line.replace(LABEL, '')
    const tokens = words(body.replace(/\|/g, ' '))
    const repeat = tokens.map((t) => REPEAT.exec(t)).find(Boolean)
    const playable = tokens.filter((t) => !REPEAT.test(t) && !CARRY_ON.has(t))
    // A line is chords when at least half of what's on it reads as chords.
    if (!playable.length || playable.filter(isChord).length * 2 < playable.length) return []
    const readBar = (cell: string[], bar: number): Chord[] =>
      cell.flatMap((token) => {
        if (CARRY_ON.has(token) || REPEAT.test(token)) return []
        const chord = sheetChord(token)
        if (!chord) unread.push({ name: token, bar: bars.length + bar })
        return chord ? [chord] : []
      })
    let read: Chord[][]
    if (body.includes('|')) {
      const cells = body.split('|')
      // "| C | G |" has nothing before the first line or after the last.
      if (!cells[0].trim()) cells.shift()
      if (cells.length && !cells.at(-1)?.trim()) cells.pop()
      read = cells.map((cell, i) => readBar(words(cell), i))
    } else {
      read = tokens.filter((t) => !REPEAT.test(t)).map((token, i) => readBar([token], i))
    }
    const times = repeat ? Number(repeat[1] ?? repeat[2]) : 1
    return Array.from({ length: Math.max(1, times) }, () => read).flat()
  }

  for (const line of lines) bars.push(...readLine(line))
  return { bars, unread }
}

/**
 * The chart Paste should put in, from the system clipboard's `text`: null when it holds
 * no chords, or when it hasn't changed since bars were copied in Rove (`textAtCopy`), so
 * those bars, with how each is played, paste instead.
 */
export function chordSheetToPaste(
  text: string,
  textAtCopy: string | null
): { bars: Chord[][]; unread: UnreadChord[] } | null {
  if (textAtCopy !== null && text === textAtCopy) return null
  const chart = chartFromText(text)
  return chart.bars.length ? chart : null
}

// A paste that missed a lot names the first few; the bars show the rest.
const UNREAD_SHOWN = 4

/**
 * What to tell the singer about chords a paste couldn't read: each with the bar it's in,
 * counting from `firstBar` (where the paste started, from 0). Null when all were read.
 */
export function unreadNote(unread: UnreadChord[], firstBar: number): string | null {
  if (!unread.length) return null
  const items = unread
    .slice(0, UNREAD_SHOWN)
    .map((u) => t('chords.unreadItem', { name: u.name, bar: firstBar + u.bar + 1 }))
  if (unread.length > UNREAD_SHOWN)
    items.push(t('chords.unreadMore', { n: unread.length - UNREAD_SHOWN }))
  return t('chords.unread', { list: items.join(', ') })
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
