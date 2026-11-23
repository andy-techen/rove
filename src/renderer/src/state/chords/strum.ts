import { Chord, ChordSegment } from '../../audio/music/chords'
import { StrumEvent, StrumNote } from '../../audio/music/guitar'
import { fretsOf } from './guitarShapes'

/** What the strum pattern needs to know about the chart as it plays. */
export interface StrumTimeline {
  chords: ChordSegment[]
  secPerBeat: number
  beatsPerBar: number
  startSec: number
  endSec: number
}

// Standard tuning, low to high: E2 A2 D3 G3 B3 E4.
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]
const LOW_E = 0
const A_STRING = 1
// Up strums catch only the top strings, as a real strum on the way back up does.
const UP_STRUM_LOWEST_STRING = 2

/** The notes of a chord as a guitarist holds it, low string first. */
export function guitarNotes(chord: Chord): StrumNote[] {
  const notes = fretsOf(chord).flatMap((fret, string) =>
    fret < 0 ? [] : [{ string, midi: OPEN_STRINGS[string] + fret }]
  )
  if (chord.bass === undefined || chord.bass === chord.root) return notes
  // A slash chord: the bass note on whichever low string reaches it nearer the nut,
  // under the chord's notes on the strings above.
  const fretOn = (string: number): number =>
    ((((chord.bass ?? 0) - OPEN_STRINGS[string]) % 12) + 12) % 12
  const bassString = fretOn(LOW_E) <= fretOn(A_STRING) ? LOW_E : A_STRING
  const bass = { string: bassString, midi: OPEN_STRINGS[bassString] + fretOn(bassString) }
  return [bass, ...notes.filter((n) => n.string > bassString && n.midi > bass.midi)]
}

interface Step {
  /** Where in the bar, in beats from its first. */
  beat: number
  direction: 'down' | 'up'
  /** How hard, 0 to 1, before the accent on a chord change. */
  strength: number
}

// The "Strum" feel: the classic down, down-up, up-down-up of campfire guitar, and its
// waltz-time cousin.
const STRUM: Record<number, Step[]> = {
  4: [
    { beat: 0, direction: 'down', strength: 0.85 },
    { beat: 1, direction: 'down', strength: 0.7 },
    { beat: 1.5, direction: 'up', strength: 0.5 },
    { beat: 2.5, direction: 'up', strength: 0.5 },
    { beat: 3, direction: 'down', strength: 0.7 },
    { beat: 3.5, direction: 'up', strength: 0.5 }
  ],
  3: [
    { beat: 0, direction: 'down', strength: 0.85 },
    { beat: 1, direction: 'down', strength: 0.65 },
    { beat: 1.5, direction: 'up', strength: 0.45 },
    { beat: 2, direction: 'down', strength: 0.65 },
    { beat: 2.5, direction: 'up', strength: 0.45 }
  ]
}
// A new chord is struck a little harder, so the change is heard.
const CHANGE_ACCENT = 1
// Players never hit two strums exactly alike: a small, repeatable variation in level.
const VARIATION = 0.08
const GOLDEN = 0.618034

const chordAt = (chords: ChordSegment[], sec: number): number =>
  chords.findIndex((c) => sec >= c.start && sec < c.end)

/** The "Strum" pattern over a chart: every strum, in timeline seconds. */
export function strumEvents(timeline: StrumTimeline): StrumEvent[] {
  const steps = STRUM[timeline.beatsPerBar] ?? STRUM[4]
  const barSec = timeline.secPerBeat * timeline.beatsPerBar
  const bars = Math.round((timeline.endSec - timeline.startSec) / barSec)
  const events: StrumEvent[] = []
  let lastSegment = -1
  for (let bar = 0; bar < bars; bar++) {
    for (const step of steps) {
      const time = timeline.startSec + bar * barSec + step.beat * timeline.secPerBeat
      const segment = chordAt(timeline.chords, time)
      const chord = timeline.chords[segment]?.chord
      if (!chord) continue
      const changed = segment !== lastSegment
      lastSegment = segment
      const notes = guitarNotes(chord)
      const k = events.length
      const wobble = 1 - VARIATION * ((k * GOLDEN) % 1)
      events.push({
        time,
        notes:
          step.direction === 'up'
            ? notes.filter((n) => n.string >= UP_STRUM_LOWEST_STRING).reverse()
            : notes,
        velocity: (changed ? CHANGE_ACCENT : step.strength) * wobble,
        direction: step.direction
      })
    }
  }
  return events
}
