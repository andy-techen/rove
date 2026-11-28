import { midiToHz } from '../pitch/pitch'
import { nextTick } from '../dsp/resample'
import { seededNoise } from '../dsp/noise'
import {
  EVENTS_PER_CHUNK,
  PLUCK_SEC,
  LOW_RING_SEC,
  LOW_STRING_HZ,
  DECADES_IN_60DB,
  PICK_SMOOTHING,
  GUITAR_NOISE_SEED,
  SEED_STEPS,
  DOWN_SPREAD_SEC,
  UP_SPREAD_SEC,
  GUITAR_NOTE_LEVEL,
  DOUBLE_CENTS,
  DOUBLE_DELAY_SEC,
  DOUBLE_LEVEL,
  WARMTH_HZ,
  WARMTH,
  DAMP_SEC,
  BODY_SMOOTHING,
  DOUBLE_VOICE
} from './constants'
import { CENTS_PER_SEMITONE } from '@shared/units'

/** One string sounding in a strum. Strings count from the low E (0) to the high E (5). */
export interface StrumNote {
  string: number
  midi: number
}

/** One strum across the strings: when, which notes, how hard, and which way. */
export interface StrumEvent {
  time: number
  notes: StrumNote[]
  /** 0 to 1. */
  velocity: number
  direction: 'down' | 'up'
}

// A plucked string, synthesised (Karplus–Strong): a burst of noise circulating through
// a delay one period long, softened a little each time round. It's computed here in
// JS rather than with a Web Audio feedback loop, because a delay inside a loop can't be
// shorter than one 128-frame render quantum, which would cap the pitch near 375 Hz.
// https://webaudio.github.io/web-audio-api/#DelayNode (cycles and minimum delay)

/** One string plucked at `midi` (a fraction is a little sharp), peak 1, ringing for PLUCK_SEC. */
function synthPluck(midi: number, sampleRate: number): Float32Array {
  const hz = midiToHz(midi)
  const out = new Float32Array(Math.round(PLUCK_SEC * sampleRate))
  // The averaging filter adds half a sample of delay; an all-pass makes up the
  // fraction of a sample the loop can't, so the note is in tune.
  const delay = sampleRate / hz - 0.5
  const period = Math.floor(delay)
  const frac = delay - period
  const allpass = (1 - frac) / (1 + frac)
  const ringSec = LOW_RING_SEC * Math.sqrt(LOW_STRING_HZ / hz)
  const loss = 10 ** (-DECADES_IN_60DB / (ringSec * hz))

  const loop = new Float32Array(period)
  const noise = seededNoise(GUITAR_NOISE_SEED + Math.round(midi * SEED_STEPS))
  let prev = 0
  for (let i = 0; i < period; i++) {
    prev = prev * PICK_SMOOTHING + noise() * (1 - PICK_SMOOTHING)
    loop[i] = prev
  }
  let last = loop[period - 1]
  let apIn = 0
  let apOut = 0
  for (let n = 0; n < out.length; n++) {
    const i = n % period
    const current = loop[i]
    out[n] = current
    const averaged = loss * 0.5 * (current + last)
    last = current
    const tuned = allpass * averaged + apIn - allpass * apOut
    apIn = averaged
    apOut = tuned
    loop[i] = tuned
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  if (peak > 0) for (let n = 0; n < out.length; n++) out[n] /= peak
  return out
}

const plucks = new Map<string, Float32Array>()

/** A pluck, synthesised once per note and sample rate. */
export function pluck(midi: number, sampleRate: number): Float32Array {
  const key = `${sampleRate}:${midi}`
  let made = plucks.get(key)
  if (!made) {
    made = synthPluck(midi, sampleRate)
    plucks.set(key, made)
  }
  return made
}

interface Sounding {
  start: number
  sample: Float32Array
  gain: number
}

/**
 * Plays strums into a buffer starting at `fromSec` on the timeline. Each string holds
 * one note at a time, as on a guitar: a new strum stops what that string was playing.
 */
export async function renderStrums(
  events: StrumEvent[],
  fromSec: number,
  lengthSec: number,
  sampleRate: number
): Promise<Float32Array<ArrayBuffer>> {
  const out = new Float32Array(Math.max(1, Math.ceil(lengthSec * sampleRate)))
  const strings = new Map<number, Sounding>()
  const damp = Math.max(1, Math.round(DAMP_SEC * sampleRate))

  // Writes a note from where it starts until `until` (a frame), fading its last moments
  // when it's cut short.
  const play = (note: Sounding, until: number): void => {
    const end = Math.min(until, note.start + note.sample.length, out.length)
    const cut = end < note.start + note.sample.length
    for (let n = Math.max(0, note.start); n < end; n++) {
      const fade = cut ? Math.min(1, (end - n) / damp) : 1
      out[n] += note.sample[n - note.start] * note.gain * fade
    }
  }

  for (let e = 0; e < events.length; e++) {
    const event = events[e]
    const spread = event.direction === 'down' ? DOWN_SPREAD_SEC : UP_SPREAD_SEC
    // A strum is aimed so its middle lands on the beat, as a player's is: started on the
    // beat, a six-string barre's top strings would sound a beat-feel late.
    const lead = ((event.notes.length - 1) * spread + DOUBLE_DELAY_SEC) / 2
    event.notes.forEach((note, i) => {
      const start = Math.max(0, Math.round((event.time - fromSec - lead + i * spread) * sampleRate))
      const gain = GUITAR_NOTE_LEVEL * event.velocity
      const voices: [number, Sounding][] = [
        [note.string, { start, sample: pluck(note.midi, sampleRate), gain }],
        [
          note.string + DOUBLE_VOICE,
          {
            start: start + Math.round(DOUBLE_DELAY_SEC * sampleRate),
            sample: pluck(note.midi + DOUBLE_CENTS / CENTS_PER_SEMITONE, sampleRate),
            gain: gain * DOUBLE_LEVEL
          }
        ]
      ]
      for (const [voice, sounding] of voices) {
        const ringing = strings.get(voice)
        if (ringing) play(ringing, sounding.start)
        strings.set(voice, sounding)
      }
    })
    if ((e + 1) % EVENTS_PER_CHUNK === 0) await nextTick()
  }
  for (const ringing of strings.values()) play(ringing, out.length)

  let body = 0
  let low = 0
  const lowPole = Math.exp((-2 * Math.PI * WARMTH_HZ) / sampleRate)
  for (let n = 0; n < out.length; n++) {
    body = body * BODY_SMOOTHING + out[n] * (1 - BODY_SMOOTHING)
    low = low * lowPole + body * (1 - lowPole)
    out[n] = body + low * WARMTH
  }
  return out
}
