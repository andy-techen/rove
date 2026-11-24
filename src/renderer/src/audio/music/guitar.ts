import { midiToHz } from '../pitch/pitch'
import { nextTick } from '../dsp/resample'

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

/** How long a single pluck rings before it's cut. */
const PLUCK_SEC = 3
// How long the lowest string takes to die away by 60 dB; higher strings ring shorter.
const LOW_RING_SEC = 3.5
const LOW_STRING_HZ = 82
const DECAY_60DB = 3
// Softens the noise burst, like a soft pick or a thumb: a warm, round tone. Brighter
// settings sound harsh, and their strong upper harmonics blur which chord is playing.
const PICK_SMOOTHING = 0.93
// Park–Miller "minimal standard" random numbers: every render sounds the same.
const PRNG_SEED = 2718
const PRNG_MULT = 16807
const PRNG_MOD = 2147483647
// A doubled note gets its own noise burst, so the two voices don't sound like one.
const SEED_STEPS = 100

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
  const loss = 10 ** (-DECAY_60DB / (ringSec * hz))

  const loop = new Float32Array(period)
  let seed = PRNG_SEED + Math.round(midi * SEED_STEPS)
  let prev = 0
  for (let i = 0; i < period; i++) {
    seed = (seed * PRNG_MULT) % PRNG_MOD
    const noise = (seed / PRNG_MOD) * 2 - 1
    prev = prev * PICK_SMOOTHING + noise * (1 - PICK_SMOOTHING)
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

// A strum isn't instant: the pick crosses the strings one after another.
const DOWN_SPREAD_SEC = 0.012
const UP_SPREAD_SEC = 0.008
// Each voice's level in the mix: six strings, each doubled, stay under full scale.
const NOTE_LEVEL = 0.16
// Every note is played twice, the second a touch sharp and a moment late, as when a part
// is double-tracked: the two beat gently against each other and the guitar sounds full
// rather than thin.
const DOUBLE_CENTS = 7
const DOUBLE_DELAY_SEC = 0.009
const DOUBLE_LEVEL = 0.75
const CENTS_PER_SEMITONE = 100
// A guitar body's warmth: the low end, under about 250 Hz, lifted by half again.
const WARMTH_HZ = 250
const WARMTH = 0.5
// A string struck again stops its last note; a short fade keeps that from clicking.
const DAMP_SEC = 0.01
// Takes the top off, like a guitar's body does.
const BODY_SMOOTHING = 0.35
/** How long the last chord rings after the chart ends. */
export const RING_OUT_SEC = 2
const EVENTS_PER_CHUNK = 64
// The doubled voice of a string is held under its own key, beside the string's.
const DOUBLE_VOICE = 0.5

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
      const gain = NOTE_LEVEL * event.velocity
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
