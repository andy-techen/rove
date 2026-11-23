import { Chord } from '../../audio/music/chords'

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
  if (slot === 0) return replace(bars, at, bar.length > 1 ? [chord, bar[1]] : [chord])
  const first = bar[0] ?? chordBefore(bars, at) ?? chord
  return replace(bars, at, [first, chord])
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

/** Back to one chord for the whole bar: its first. */
export const joinBar = (bars: Chord[][], at: number): Chord[][] =>
  replace(bars, at, bars[at].slice(0, 1))

/** Empties a bar, so it carries the chord before it on. */
export const clearBar = (bars: Chord[][], at: number): Chord[][] => replace(bars, at, [])

export const removeBar = (bars: Chord[][], at: number): Chord[][] => bars.filter((_, i) => i !== at)

/** A new bar after the last, carrying the last chord on. */
export const addBar = (bars: Chord[][]): Chord[][] => [...bars, []]

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
