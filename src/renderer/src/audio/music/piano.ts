import { PianoEvent } from '../../state/chords/pianoPart'
import { nextTick } from '../dsp/resample'

/** Each sampled note's sound, by MIDI note, at the render's sample rate. */
export type PianoSamples = ReadonlyMap<number, Float32Array>

// A real piano, sampled: the Salamander Grand (pianoSamples/README.md). A synthesised
// piano sounds cheap, and a voice sits more happily over a real one.
const SAMPLE_URLS = import.meta.glob<string>('./pianoSamples/*.m4a', {
  query: '?url',
  import: 'default',
  eager: true
})

// Each voice's level: a bass note and a four-note chord struck together stay under full
// scale, and the piano sits about as loud as the guitar's fingerpicking.
const NOTE_LEVEL = 0.18
// How long a note takes to die away once its key, or the pedal, is let go: a damper
// settling on the string.
const RELEASE_SEC = 0.25
// A key struck again while still sounding stops its last note; a short fade keeps that
// from clicking.
const RESTRIKE_SEC = 0.02
/** How long the last chord rings after the chart ends. */
export const PIANO_RING_OUT_SEC = 2
const EVENTS_PER_CHUNK = 64
// Where a note starts: within 40 dB of its loudest, less a moment so the hammer's attack
// is kept. AAC adds a few milliseconds of silence before the sound (encoder priming),
// which would otherwise make every note late.
const ONSET_LEVEL = 0.01
const ONSET_LEAD_SEC = 0.001
const SEMITONES_PER_OCTAVE = 12

/** The sample a note is played from: the closest in pitch. */
export function nearestSample(midi: number, roots: number[]): number {
  return roots.reduce((best, root) => (Math.abs(root - midi) < Math.abs(best - midi) ? root : best))
}

/** Where the sound in `samples` begins, in frames. */
export function onsetOf(samples: Float32Array, sampleRate: number): number {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  const first = samples.findIndex((v) => Math.abs(v) > peak * ONSET_LEVEL)
  return Math.max(0, first - Math.round(ONSET_LEAD_SEC * sampleRate))
}

const loaded = new Map<number, Promise<PianoSamples>>()

/** The bundled samples, decoded once per sample rate, each starting on its note. */
export function loadPianoSamples(sampleRate: number): Promise<PianoSamples> {
  let samples = loaded.get(sampleRate)
  if (!samples) {
    samples = Promise.all(
      Object.entries(SAMPLE_URLS).map(async ([path, url]) => {
        const midi = Number(path.match(/(\d+)\.m4a$/)?.[1])
        const bytes = await (await fetch(url)).arrayBuffer()
        // Decoding through a context resamples to its rate.
        const buffer = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(bytes)
        const data = buffer.getChannelData(0)
        return [midi, data.slice(onsetOf(data, sampleRate))] as const
      })
    ).then((entries) => new Map(entries))
    // A failed load is tried again next time rather than remembered.
    samples.catch(() => loaded.delete(sampleRate))
    loaded.set(sampleRate, samples)
  }
  return samples
}

interface Sounding {
  start: number
  /** The frame the key is let go, after which the note dies away. */
  release: number
  sample: Float32Array
  /** How many sample frames each output frame steps: above 1 plays it higher. */
  rate: number
  gain: number
}

/**
 * Plays piano notes into a buffer starting at `fromSec` on the timeline, each from its
 * nearest sample, shifted to pitch. A key holds one note at a time, as on a piano.
 */
export async function renderPiano(
  events: PianoEvent[],
  samples: PianoSamples,
  fromSec: number,
  lengthSec: number,
  sampleRate: number
): Promise<Float32Array<ArrayBuffer>> {
  const out = new Float32Array(Math.max(1, Math.ceil(lengthSec * sampleRate)))
  const roots = [...samples.keys()]
  const releaseFrames = Math.max(1, Math.round(RELEASE_SEC * sampleRate))
  const restrikeFrames = Math.max(1, Math.round(RESTRIKE_SEC * sampleRate))
  const keys = new Map<number, Sounding>()

  // Writes a note until `until` (a frame), dying away after its release and fading out
  // if it's cut short by the same key struck again.
  const play = (note: Sounding, until: number): void => {
    const natural = note.start + Math.floor((note.sample.length - 1) / note.rate)
    const end = Math.min(until, natural, note.release + releaseFrames, out.length)
    const cut = until < Math.min(natural, note.release + releaseFrames)
    for (let n = Math.max(0, note.start); n < end; n++) {
      const pos = (n - note.start) * note.rate
      const i = Math.floor(pos)
      const value = note.sample[i] + (note.sample[i + 1] - note.sample[i]) * (pos - i)
      const released = n < note.release ? 1 : 1 - (n - note.release) / releaseFrames
      const fade = cut ? Math.min(1, (end - n) / restrikeFrames) : 1
      out[n] += value * note.gain * released * fade
    }
  }

  for (let e = 0; e < events.length; e++) {
    const event = events[e]
    const root = nearestSample(event.midi, roots)
    const start = Math.max(0, Math.round((event.time - fromSec) * sampleRate))
    const sounding: Sounding = {
      start,
      release: start + Math.round(event.holdSec * sampleRate),
      sample: samples.get(root) as Float32Array,
      rate: 2 ** ((event.midi - root) / SEMITONES_PER_OCTAVE),
      gain: NOTE_LEVEL * event.velocity
    }
    const ringing = keys.get(event.midi)
    if (ringing) play(ringing, start + restrikeFrames)
    keys.set(event.midi, sounding)
    if ((e + 1) % EVENTS_PER_CHUNK === 0) await nextTick()
  }
  for (const ringing of keys.values()) play(ringing, out.length)
  return out
}
