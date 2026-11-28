import { TakeRef, TakeSummary } from '@shared/songs/voice'
import { LANDING_BIN_CENTS, LANDING_BINS, LANDING_RANGE_CENTS } from '@shared/songs/constants'
import { analyseFrames, singingTest } from '../dsp/voiceBands'
import { mean, median } from '../dsp/stats'
import { analysePitch, hzToMidi } from '../pitch/pitch'
import {
  HELD_NOTE_SEC,
  NOTE_CHANGE_SEMITONES,
  NOTE_DRIFT_SEMITONES,
  NOTE_EDGE_SHARE,
  STEADY_SEMITONES
} from './constants'
import { CENTS_PER_SEMITONE } from '@shared/units'

/** The part of a take that plays. durationSec 0 means to the end. */
export type TakeWindow = Pick<TakeRef, 'offsetSec' | 'durationSec'>

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
