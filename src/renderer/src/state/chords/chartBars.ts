import { Chord } from '../../audio/music/chords'
import { sameChord } from './chordText'

// A bar holds one chord, or two sharing it: what a beginner's chart needs.
export const MAX_CHORDS_PER_BAR = 2
// Taps further apart than this start a new count, so a pause doesn't drag the tempo down.
const TAP_RESET_SEC = 2
// The last few taps set the tempo: enough to even out a wobble, recent enough to follow.
const TAPS_COUNTED = 5
const SEC_PER_MIN = 60

const replace = (bars: Chord[][], at: number, bar: Chord[]): Chord[][] =>
  bars.map((b, i) => (i === at ? bar : b))

/**
 * Puts a chord in one half of a bar (slot 0 or 1). An empty bar picked in its second
 * half is split, starting with what it was carrying on from: the chord before it.
 */
export function withChordAt(bars: Chord[][], at: number, slot: number, chord: Chord): Chord[][] {
  const bar = bars[at] ?? []
  if (slot === 0) return replace(bars, at, merged(bar.length > 1 ? [chord, bar[1]] : [chord]))
  const first = bar[0] ?? chordBefore(bars, at) ?? chord
  return replace(bars, at, merged([first, chord]))
}

/** Two halves with the same chord are just one bar of it. */
const merged = (bar: Chord[]): Chord[] =>
  bar.length > 1 && sameChord(bar[0], bar[1]) ? [bar[0]] : bar

/**
 * One half of a split bar (or a whole bar) goes back to keeping the chord before it
 * ringing. Undefined when there's nothing before it to keep.
 */
export function keepAt(bars: Chord[][], at: number, slot: number): Chord[][] | undefined {
  const bar = bars[at] ?? []
  if (bar.length < 2) return replace(bars, at, [])
  if (slot === 1) return replace(bars, at, [bar[0]])
  const before = chordBefore(bars, at)
  return before ? replace(bars, at, merged([before, bar[1]])) : undefined
}

/** The chord sounding as bar `at` begins: the last one written before it. */
export function chordBefore(bars: Chord[][], at: number): Chord | undefined {
  for (let i = at - 1; i >= 0; i--) if (bars[i].length) return bars[i].at(-1)
  return undefined
}

/** Shares a bar between its chord and a second one (the same, until another is picked). */
export function splitBar(bars: Chord[][], at: number): Chord[][] {
  const first = bars[at]?.[0] ?? chordBefore(bars, at)
  return first ? replace(bars, at, [first, first]) : bars
}

/** Empties a bar, so it carries the chord before it on. */
export const clearBar = (bars: Chord[][], at: number): Chord[][] => replace(bars, at, [])

export const removeBar = (bars: Chord[][], at: number): Chord[][] => bars.filter((_, i) => i !== at)

const inRange = (i: number, first: number, last: number): boolean => i >= first && i <= last

/** One chord for each bar from `first` to `last`. */
export const fillBars = (bars: Chord[][], first: number, last: number, chord: Chord): Chord[][] =>
  bars.map((b, i) => (inRange(i, first, last) ? [chord] : b))

/** Empties bars `first` to `last`, so they carry the chord before them on. */
export const clearBars = (bars: Chord[][], first: number, last: number): Chord[][] =>
  bars.map((b, i) => (inRange(i, first, last) ? [] : b))

// The structural edits below take any per-bar list (the chords, or how each bar is
// played), so a chart's lists move together.

/** Takes bars `first` to `last` out; a chart keeps at least one bar, `fallback`. */
export function removeBars<T>(bars: T[], first: number, last: number, fallback: T): T[] {
  const kept = bars.filter((_, i) => !inRange(i, first, last))
  return kept.length ? kept : [fallback]
}

/** Bars `a` and `b` trade places. */
export function swapBars<T>(bars: T[], a: number, b: number): T[] {
  if (a === b || a >= bars.length || b >= bars.length) return bars
  return bars.map((bar, i) => (i === a ? bars[b] : i === b ? bars[a] : bar))
}

/**
 * The line of bars holding bar `at` (charts are written `perLine` to a line), copied in
 * right after it: verses and choruses repeat. Returns where the copy starts.
 */
export function repeatLine<T>(
  bars: T[],
  at: number,
  perLine: number
): { bars: T[]; copyAt: number } {
  const lineStart = Math.floor(at / perLine) * perLine
  const line = bars.slice(lineStart, lineStart + perLine)
  const copyAt = lineStart + line.length
  return { bars: insertBars(bars, copyAt, line), copyAt }
}

/** Bars put in before bar `at`, moving the ones after along. */
export const insertBars = <T>(bars: T[], at: number, added: T[]): T[] => [
  ...bars.slice(0, at),
  ...added,
  ...bars.slice(at)
]

/** A new bar after the last, carrying the last chord on. */
export const addBar = (bars: Chord[][]): Chord[][] => [...bars, []]

/** Bars `first` to `last`, to paste elsewhere. */
export const copyBars = <T>(bars: T[], first: number, last: number): T[] =>
  bars.slice(first, last + 1)

/** Pasted bars written over the chart from bar `at`, growing it as needed. */
export function pasteBars(bars: Chord[][], at: number, pasted: Chord[][]): Chord[][] {
  const next = [...bars]
  pasted.forEach((bar, i) => {
    next[at + i] = bar.slice(0, MAX_CHORDS_PER_BAR)
  })
  return next
}

/**
 * The tempo of taps (in seconds, oldest first), from the last few taps in a row. Null
 * until there are two taps close enough together to count.
 */
export function tapTempo(taps: number[]): number | null {
  let from = taps.length - 1
  while (from > 0 && taps[from] - taps[from - 1] <= TAP_RESET_SEC) from--
  const run = taps.slice(Math.max(from, taps.length - TAPS_COUNTED))
  if (run.length < 2) return null
  const beatSec = (run.at(-1)! - run[0]) / (run.length - 1)
  return Math.round(SEC_PER_MIN / beatSec)
}
