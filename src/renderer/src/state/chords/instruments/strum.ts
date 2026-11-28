import { PITCH_CLASSES } from '@shared/units'
import { Chord, ChordSegment } from '../../../audio/music/chords'
import { ChordFeel } from '../../song/project'
import { StrumEvent, StrumNote } from '../../../audio/music/guitar'
import { fretsOf } from './guitarShapes'
import {
  A_STRING,
  GOLDEN,
  LOW_E,
  OPEN_STRINGS,
  PICK_STEP_BEATS,
  STRUM_CHANGE_ACCENT,
  UP_STRUM_LOWEST_STRING,
  VARIATION
} from './constants'

/** What the strum pattern needs to know about the chart as it plays. */
export interface StrumTimeline {
  chords: ChordSegment[]
  secPerBeat: number
  beatsPerBar: number
  startSec: number
  endSec: number
}

/** The notes of a chord as a guitarist holds it, low string first. */
export function guitarNotes(chord: Chord): StrumNote[] {
  const notes = fretsOf(chord).flatMap((fret, string) =>
    fret < 0 ? [] : [{ string, midi: OPEN_STRINGS[string] + fret }]
  )
  if (chord.bass === undefined || chord.bass === chord.root) return notes
  // A slash chord: the bass note on whichever low string reaches it nearer the nut,
  // under the chord's notes on the strings above.
  const fretOn = (string: number): number =>
    ((((chord.bass ?? 0) - OPEN_STRINGS[string]) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES
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
const chordAt = (chords: ChordSegment[], sec: number): number =>
  chords.findIndex((c) => sec >= c.start && sec < c.end)

/**
 * Which string a fingerpicked step plays: T is the thumb on the bass, 1 2 3 the fingers
 * on the top three strings of the chord, low to high.
 */
type Pick = 'T' | '1' | '2' | '3'

// The "Fingerpick" feel, T 1 2 1 3 1 2 1 in eighths: the thumb on the bass, then the
// fingers rolling over the top strings, as folk and ballad players do. Waltz time plays
// its first six.
const PICK: Record<number, Pick[]> = {
  4: ['T', '1', '2', '1', '3', '1', '2', '1'],
  3: ['T', '1', '2', '1', '3', '1']
}
// The thumb lands a little firmer than the fingers.
const PICK_LEVEL: Record<Pick, number> = { T: 0.9, '1': 0.6, '2': 0.6, '3': 0.65 }

/** The note a step plucks, from the chord's notes (low string first). */
function pickedNote(notes: StrumNote[], pick: Pick): StrumNote | undefined {
  if (pick === 'T') return notes[0]
  const top = notes.slice(-3)
  return top[Number(pick) - 1] ?? top.at(-1)
}

/** One stroke of a pattern: a strum across the chord, or a single picked string. */
interface Stroke {
  notes: StrumNote[]
  strength: number
  direction: 'down' | 'up'
}

/**
 * Every strum or pick over a chart, in timeline seconds, each bar played its own way
 * (strummed unless `feels` says otherwise).
 */
export function eventsFor(timeline: StrumTimeline, feels: ChordFeel[] = []): StrumEvent[] {
  const barSec = timeline.secPerBeat * timeline.beatsPerBar
  const bars = Math.round((timeline.endSec - timeline.startSec) / barSec)
  const events: StrumEvent[] = []
  let lastSegment = -1
  const play = (time: number, stroke: (notes: StrumNote[], changed: boolean) => Stroke): void => {
    const segment = chordAt(timeline.chords, time)
    const chord = timeline.chords[segment]?.chord
    if (!chord) return
    const changed = segment !== lastSegment
    lastSegment = segment
    const { notes, strength, direction } = stroke(guitarNotes(chord), changed)
    if (!notes.length) return
    const wobble = 1 - VARIATION * ((events.length * GOLDEN) % 1)
    events.push({
      time,
      notes,
      velocity: (changed ? STRUM_CHANGE_ACCENT : strength) * wobble,
      direction
    })
  }
  for (let bar = 0; bar < bars; bar++) {
    const barStart = timeline.startSec + bar * barSec
    if (feels[bar] === 'pick') {
      const steps = PICK[timeline.beatsPerBar] ?? PICK[4]
      steps.forEach((pick, i) =>
        play(barStart + i * PICK_STEP_BEATS * timeline.secPerBeat, (notes, changed) => {
          // A new chord always starts on its bass, wherever in the pattern it lands.
          const note = pickedNote(notes, changed ? 'T' : pick)
          return { notes: note ? [note] : [], strength: PICK_LEVEL[pick], direction: 'down' }
        })
      )
    } else {
      const steps = STRUM[timeline.beatsPerBar] ?? STRUM[4]
      for (const step of steps)
        play(barStart + step.beat * timeline.secPerBeat, (notes) => ({
          notes:
            step.direction === 'up'
              ? notes.filter((n) => n.string >= UP_STRUM_LOWEST_STRING).reverse()
              : notes,
          strength: step.strength,
          direction: step.direction
        }))
    }
  }
  return events
}
