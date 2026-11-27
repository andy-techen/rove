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
// Wandering further than this from where a run has sat so far is a new note too: a
// singer gliding between notes never jumps from one hop to the next, so the jump test
// alone would join the notes and measure the slide. Wide enough for vibrato.
const NOTE_DRIFT_SEMITONES = 0.6
// A note's first and last moments are the scoop into it and the fall away; landing
// listens to the steady middle.
const NOTE_EDGE_SHARE = 0.25
// A held note whose steady middle still moves this far from one half to the other is
// a slide, not a note, so it says nothing about where the singer lands.
const STEADY_SEMITONES = 0.25
const CENTS_PER_SEMITONE = 100

export function emptySummary(): TakeSummary {
  return {
    sungSec: 0,
    recordedSec: 0,
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
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/** Runs of steady pitch (in MIDI note numbers) long enough to count as held notes. */
function heldNotes(midi: number[], hopSec: number): number[][] {
  const minHops = Math.ceil(HELD_NOTE_SEC / hopSec - 1e-9)
  const held: number[][] = []
  let run: number[] = []
  const close = (): void => {
    if (run.length >= minHops) held.push(run)
    run = []
  }
  let sum = 0
  for (const note of midi) {
    const last = run[run.length - 1]
    const jumped = last !== undefined && Math.abs(note - last) > NOTE_CHANGE_SEMITONES
    const drifted = run.length > 0 && Math.abs(note - sum / run.length) > NOTE_DRIFT_SEMITONES
    if (!note || jumped || drifted) {
      close()
      sum = 0
    }
    if (note) {
      run.push(note)
      sum += note
    }
  }
  close()
  return held
}

/** Where a held note settles: its steady middle, or null when it's still sliding. */
function settledPitch(run: number[]): number | null {
  const edge = Math.floor(run.length * NOTE_EDGE_SHARE)
  const middle = run.slice(edge, run.length - edge)
  const half = Math.floor(middle.length / 2)
  const drift = median(middle.slice(half)) - median(middle.slice(0, half || 1))
  return Math.abs(drift) > STEADY_SEMITONES ? null : median(middle)
}

/** Cents from the nearest note, from half a semitone flat to just under half sharp. */
const centsOff = (note: number): number => {
  const cents = (note - Math.round(note)) * CENTS_PER_SEMITONE
  return cents >= LANDING_RANGE_CENTS ? cents - CENTS_PER_SEMITONE : cents
}

/**
 * How far the take's notes sit from A440 as a whole, in cents. Backing tracks aren't
 * always tuned to A440 (older recordings, tape speed, a speed change), and a singer in
 * tune with one would otherwise land off every note. Cents wrap at a semitone, so this
 * is a circular mean: notes at +45 and -45 sit together around 50, not at 0.
 */
function tuningOf(notes: number[]): number {
  const angles = notes.map((n) => (centsOff(n) / CENTS_PER_SEMITONE) * 2 * Math.PI)
  const angle = Math.atan2(mean(angles.map(Math.sin)), mean(angles.map(Math.cos)))
  return (angle / (2 * Math.PI)) * CENTS_PER_SEMITONE
}

/** Which landing bin a note falls in, by its cents from the nearest note in tuning. */
function landingBin(note: number, tuningCents: number): number {
  const cents = centsOff(note - tuningCents / CENTS_PER_SEMITONE)
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

  summary.recordedSec = played.length / sampleRate
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
  const settled = runs.map(settledPitch).filter((n): n is number => n !== null)
  if (settled.length) {
    const tuning = tuningOf(settled)
    for (const note of settled) summary.landing[landingBin(note, tuning)]++
  }

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
