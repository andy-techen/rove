import { Chord } from '../../audio/music/chords'

// Standard-tuning shapes, low E string first: the fret each string is held at,
// 0 for open, -1 for not played. Open shapes where there's a common one, else the
// usual E- or A-shape barre. Indexed by root (C = 0).
const X = -1
const TRIADS: Record<'major' | 'minor', number[][]> = {
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

type OtherQuality = Exclude<Chord['quality'], 'major' | 'minor'>

// The open shapes guitarists reach for first, where the movable shapes below would put
// the chord up the neck. Keyed by root.
const OPEN: Record<OtherQuality, Partial<Record<number, number[]>>> = {
  '7': {
    0: [X, 3, 2, 3, 1, 0], // C7
    2: [X, X, 0, 2, 1, 2], // D7
    7: [3, 2, 0, 0, 0, 1], // G7
    11: [X, 2, 1, 2, 0, 2] // B7
  },
  maj7: {
    0: [X, 3, 2, 0, 0, 0], // Cmaj7
    2: [X, X, 0, 2, 2, 2], // Dmaj7
    5: [X, X, 3, 2, 1, 0], // Fmaj7
    7: [3, 2, 0, 0, 0, 2] // Gmaj7
  },
  m7: { 2: [X, X, 0, 2, 1, 1] }, // Dm7
  sus2: { 2: [X, X, 0, 2, 3, 0] }, // Dsus2
  sus4: { 2: [X, X, 0, 2, 3, 3] }, // Dsus4
  dim: {}
}

// Movable shapes, as frets above the root's fret: the E shape has its root on the low
// E string, the A shape on the A string. Every kind of chord has both.
const E_SHAPE: Record<OtherQuality, number[]> = {
  '7': [0, 2, 0, 1, 0, 0],
  maj7: [0, X, 1, 1, 0, X],
  m7: [0, 2, 0, 0, 0, 0],
  sus2: [0, 2, 4, 4, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  dim: [0, 1, 2, 0, X, X]
}
const A_SHAPE: Record<OtherQuality, number[]> = {
  '7': [X, 0, 2, 0, 2, 0],
  maj7: [X, 0, 2, 1, 2, 0],
  m7: [X, 0, 2, 0, 1, 0],
  sus2: [X, 0, 2, 2, 0, 0],
  sus4: [X, 0, 2, 2, 3, 0],
  dim: [X, 0, 1, 2, 1, X]
}
// The pitch classes of the low E and A strings.
const E_ROOT = 4
const A_ROOT = 9

const fretFor = (root: number, stringRoot: number): number => (root - stringRoot + 12) % 12
const placed = (shape: number[], fret: number): number[] =>
  shape.map((f) => (f === X ? X : f + fret))

/** The fret each string is held at for a chord, low E first (0 open, -1 not played). */
export function fretsOf(chord: Chord): number[] {
  const { root, quality } = chord
  if (quality === 'major' || quality === 'minor') return TRIADS[quality][root]
  const open = OPEN[quality][root]
  if (open) return open
  // Whichever movable shape sits lower on the neck is easier to reach.
  const onE = fretFor(root, E_ROOT)
  const onA = fretFor(root, A_ROOT)
  return onA <= onE ? placed(A_SHAPE[quality], onA) : placed(E_SHAPE[quality], onE)
}

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
