import { Chord } from '../../audio/music/chords'

// Standard-tuning shapes, low E string first: the fret each string is held at,
// 0 for open, -1 for not played. Open shapes where there's a common one, else the
// usual E- or A-shape barre. Indexed by root (C = 0).
const X = -1
const SHAPES: Record<Chord['quality'], number[][]> = {
  major: [
    [X, 3, 2, 0, 1, 0], // C
    [X, 4, 6, 6, 6, 4], // C♯
    [X, X, 0, 2, 3, 2], // D
    [X, 6, 8, 8, 8, 6], // E♭
    [0, 2, 2, 1, 0, 0], // E
    [1, 3, 3, 2, 1, 1], // F
    [2, 4, 4, 3, 2, 2], // F♯
    [3, 2, 0, 0, 0, 3], // G
    [4, 6, 6, 5, 4, 4], // A♭
    [X, 0, 2, 2, 2, 0], // A
    [X, 1, 3, 3, 3, 1], // B♭
    [X, 2, 4, 4, 4, 2] // B
  ],
  minor: [
    [X, 3, 5, 5, 4, 3], // Cm
    [X, 4, 6, 6, 5, 4], // C♯m
    [X, X, 0, 2, 3, 1], // Dm
    [X, 6, 8, 8, 7, 6], // E♭m
    [0, 2, 2, 0, 0, 0], // Em
    [1, 3, 3, 1, 1, 1], // Fm
    [2, 4, 4, 2, 2, 2], // F♯m
    [3, 5, 5, 3, 3, 3], // Gm
    [4, 6, 6, 4, 4, 4], // G♯m
    [X, 0, 2, 2, 1, 0], // Am
    [X, 1, 3, 3, 2, 1], // B♭m
    [X, 2, 4, 4, 3, 2] // Bm
  ]
}

// A barre is drawn when one finger plainly holds several strings: the lowest fret
// used, on strings at least this far apart (so two neighbouring notes aren't one).
const BARRE_MIN_SPAN = 3

export interface Grip {
  /** The fret the diagram's top row stands for: 1 at the nut, higher up the neck. */
  baseFret: number
  /** Strings (0 = low E) left open, and not played. */
  open: number[]
  muted: number[]
  /** Fingers, by string and by fret counted from the diagram's top row (1 = top). */
  dots: { string: number; fret: number }[]
  /** One finger across several strings, in the same counting. */
  barre: { fret: number; from: number; to: number } | null
}

/** The fret each string is held at for a chord, low E first (0 open, -1 not played). */
export const fretsOf = (chord: Chord): number[] => SHAPES[chord.quality][chord.root]

/** How to hold a chord on a guitar, ready to draw as a chord box. */
export function gripOf(chord: Chord): Grip {
  const frets = fretsOf(chord)
  const fretted = frets.filter((f) => f > 0)
  const lowest = Math.min(...fretted)
  // Chords that fit within the first four frets are drawn from the nut.
  const baseFret = Math.max(...fretted) <= 4 ? 1 : lowest
  const atLowest = frets.flatMap((f, s) => (f === lowest ? [s] : []))
  const from = atLowest[0]
  const to = atLowest.at(-1) ?? from
  const spansOpen = frets.slice(from, to + 1).some((f) => f === 0)
  const barre =
    atLowest.length >= 2 && to - from >= BARRE_MIN_SPAN && !spansOpen
      ? { fret: lowest - baseFret + 1, from, to }
      : null
  return {
    baseFret,
    open: frets.flatMap((f, s) => (f === 0 ? [s] : [])),
    muted: frets.flatMap((f, s) => (f === X ? [s] : [])),
    dots: frets.flatMap((f, s) =>
      f > 0 && !(barre && f === lowest) ? [{ string: s, fret: f - baseFret + 1 }] : []
    ),
    barre
  }
}
