import {
  LANDING_BIN_CENTS,
  LANDING_BINS,
  LANDING_RANGE_CENTS,
  TakeRef,
  TakeSummary
} from '@shared/voice'
import { analyseFrames, singingTest } from '../dsp/voiceBands'
import { analysePitch, hzToMidi } from '../pitch/pitch'

/** The part of a take that plays. durationSec 0 means to the end. */
export type TakeWindow = Pick<TakeRef, 'offsetSec' | 'durationSec'>

// A note has to be held this long to count towards range, time on each note and
// landing: shorter runs are slides, ornaments and the odd octave slip in the pitch
// tracker, which would stretch the range with notes the singer passes through rather
// than sings.
const HELD_NOTE_SEC = 0.15
// A jump bigger than this between hops is a new note, not vibrato or drift.
const NOTE_CHANGE_SEMITONES = 0.7
const CENTS_PER_SEMITONE = 100

export function emptySummary(): TakeSummary {
  return {
    sungSec: 0,
    noteSec: {},
    lowestNote: null,
    highestNote: null,
    landing: new Array<number>(LANDING_BINS).fill(0),
    tone: { body: 0, mid: 0, presence: 0, air: 0, frames: 0 }
  }
}

function clipWindow(samples: Float32Array, sampleRate: number, window: TakeWindow): Float32Array {
  const start = Math.min(samples.length, Math.max(0, Math.round(window.offsetSec * sampleRate)))
  const end =
    window.durationSec > 0
      ? Math.min(samples.length, start + Math.round(window.durationSec * sampleRate))
      : samples.length
  return samples.subarray(start, end)
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** Runs of steady pitch (in MIDI note numbers) long enough to count as held notes. */
function heldNotes(midi: number[], hopSec: number): number[][] {
  const minHops = Math.ceil(HELD_NOTE_SEC / hopSec - 1e-9)
  const held: number[][] = []
  let run: number[] = []
  const close = (): void => {
    if (run.length >= minHops) held.push(run)
    run = []
  }
  for (const note of midi) {
    const last = run[run.length - 1]
    if (!note || (last !== undefined && Math.abs(note - last) > NOTE_CHANGE_SEMITONES)) close()
    if (note) run.push(note)
  }
  close()
  return held
}

/** Which landing bin a held note's middle falls in, by its cents from the nearest note. */
function landingBin(note: number): number {
  const cents = (note - Math.round(note)) * CENTS_PER_SEMITONE
  const bin = Math.floor((cents + LANDING_RANGE_CENTS) / LANDING_BIN_CENTS)
  return Math.min(LANDING_BINS - 1, Math.max(0, bin))
}

/** What the played window of one take adds to the voice profile. */
export async function summariseTake(
  samples: Float32Array,
  sampleRate: number,
  window: TakeWindow
): Promise<TakeSummary> {
  const played = clipWindow(samples, sampleRate, window)
  const summary = emptySummary()
  const { f0, hopSec } = await analysePitch(played, sampleRate)
  const midi = Array.from(f0, (hz) => (hz > 0 ? hzToMidi(hz) : 0))

  summary.sungSec = midi.filter((note) => note > 0).length * hopSec
  const runs = heldNotes(midi, hopSec)
  for (const note of runs.flat()) {
    const key = Math.round(note)
    summary.noteSec[key] = (summary.noteSec[key] ?? 0) + hopSec
  }

  const held = runs.map(median)
  if (held.length) {
    summary.lowestNote = Math.round(Math.min(...held))
    summary.highestNote = Math.round(Math.max(...held))
  }
  for (const note of held) summary.landing[landingBin(note)]++

  const frames = analyseFrames(played, sampleRate)
  const test = singingTest(frames)
  for (const f of test ? frames.filter(test.isSinging) : []) {
    summary.tone.body += f.body
    summary.tone.mid += f.mid
    summary.tone.presence += f.presence
    summary.tone.air += f.air
    summary.tone.frames++
  }
  return summary
}
