// The placeholder demo song: four bars of C, G, Am, F with a short sung line and a
// harmony a third above it. It stands in until a real recording is added (see
// DEMO_AUDIO in site.ts), and is synthesised in the browser, so it costs no download.

export const BPM = 84
export const BEATS = 16
export const BEAT_SEC = 60 / BPM
export const SONG_SEC = BEATS * BEAT_SEC

export interface Note {
  /** Start and length in beats. */
  beat: number
  beats: number
  midi: number
  /** 0..1: some notes softer, so Smoothness has something to even out. */
  velocity: number
}

/** One chord per bar: root note (MIDI) and its triad above it. */
export const CHORDS: { root: number; triad: number[] }[] = [
  { root: 36, triad: [60, 64, 67] }, // C
  { root: 43, triad: [59, 62, 67] }, // G
  { root: 45, triad: [60, 64, 69] }, // Am
  { root: 41, triad: [60, 65, 69] } // F
]

const n = (beat: number, beats: number, midi: number, velocity = 0.8): Note => ({
  beat,
  beats,
  midi,
  velocity
})

export const MELODY: Note[] = [
  n(0, 1, 64, 0.6),
  n(1, 1, 67, 0.75),
  n(2, 1, 69, 0.9),
  n(3, 1, 67, 0.7),
  n(4, 1.5, 67, 0.95),
  n(5.5, 0.5, 65, 0.5),
  n(6, 1, 64, 0.7),
  n(7, 1, 62, 0.55),
  n(8, 1, 72, 1),
  n(9, 0.5, 71, 0.6),
  n(9.5, 1.5, 69, 0.85),
  n(11, 1, 64, 0.5),
  n(12, 1, 65, 0.65),
  n(13, 1, 69, 0.85),
  n(14, 1.75, 67, 0.75)
]

// C major, by pitch class; a harmony moves two scale steps up (a third).
const SCALE = [0, 2, 4, 5, 7, 9, 11]
const OCTAVE = 12
const THIRD_STEPS = 2

/** The note a diatonic third above, staying in C major. */
export function thirdAbove(midi: number): number {
  const octave = Math.floor(midi / OCTAVE)
  const step = SCALE.indexOf(midi % OCTAVE)
  if (step < 0) throw new Error(`${midi} isn't in C major`)
  const up = step + THIRD_STEPS
  return (octave + Math.floor(up / SCALE.length)) * OCTAVE + SCALE[up % SCALE.length]
}

export const HARMONY: Note[] = MELODY.map((note) => ({
  ...note,
  midi: thirdAbove(note.midi),
  velocity: note.velocity * 0.8
}))

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / OCTAVE)
