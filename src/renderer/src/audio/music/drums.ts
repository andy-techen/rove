import type { DrumHit, DrumVoice } from '../../state/chords/instruments/beats'
import { seededNoise } from '../dsp/noise'
import {
  DRUM_NOISE_SEED,
  KICK,
  SNARE,
  HAT,
  OPEN_HAT,
  RIM,
  CLAP,
  TOM,
  CRASH,
  LEVEL,
  CEILING
} from './constants'

// Each drum is synthesised once per sample rate: a few short sounds, so no samples ship.

function noise(length: number): Float32Array {
  const next = seededNoise(DRUM_NOISE_SEED)
  return Float32Array.from({ length }, () => next())
}

/** Noise with its lows taken out: what's left is the sizzle of a cymbal or snare wire. */
function highPassed(samples: Float32Array, hz: number, sampleRate: number): Float32Array {
  const pole = Math.exp((-2 * Math.PI * hz) / sampleRate)
  let low = 0
  return samples.map((x) => {
    low = low * pole + x * (1 - pole)
    return x - low
  })
}

const decay = (n: number, sampleRate: number, sec: number): number =>
  Math.exp(-n / (sampleRate * sec))

function synth(voice: DrumVoice, sampleRate: number): Float32Array {
  const frames = (sec: number): number => Math.round(sec * sampleRate)
  switch (voice) {
    case 'kick': {
      let phase = 0
      return Float32Array.from({ length: frames(KICK.sec) }, (_, n) => {
        const t = n / sampleRate
        const hz = KICK.toHz + (KICK.fromHz - KICK.toHz) * Math.exp(-t / KICK.sweepSec)
        phase += (2 * Math.PI * hz) / sampleRate
        return Math.sin(phase) * decay(n, sampleRate, KICK.decaySec)
      })
    }
    case 'snare': {
      const wires = highPassed(noise(frames(SNARE.sec)), SNARE.wiresHz, sampleRate)
      return wires.map(
        (w, n) =>
          w * decay(n, sampleRate, SNARE.wiresSec) +
          Math.sin((2 * Math.PI * SNARE.hz * n) / sampleRate) *
            decay(n, sampleRate, SNARE.toneSec) *
            SNARE.tone
      )
    }
    case 'hat':
    case 'openHat': {
      const shape = voice === 'hat' ? HAT : OPEN_HAT
      return highPassed(noise(frames(shape.sec)), shape.hz, sampleRate).map(
        (x, n) => x * decay(n, sampleRate, shape.decaySec)
      )
    }
    case 'clap': {
      const n = frames(CLAP.sec)
      const body = highPassed(noise(n), CLAP.hz, sampleRate)
      return body.map((x, i) => {
        const t = i / sampleRate
        // Each hand is a short burst; after the last, the clap rings off into the room.
        const last = (CLAP.bursts - 1) * CLAP.burstGapSec
        const burst =
          t < last + CLAP.burstGapSec
            ? Math.exp(-(t % CLAP.burstGapSec) / CLAP.burstSec)
            : Math.exp(-(t - last) / CLAP.tailSec)
        return x * burst
      })
    }
    case 'tom': {
      let phase = 0
      return Float32Array.from({ length: frames(TOM.sec) }, (_, i) => {
        const t = i / sampleRate
        const hz = TOM.toHz + (TOM.fromHz - TOM.toHz) * Math.exp(-t / TOM.sweepSec)
        phase += (2 * Math.PI * hz) / sampleRate
        return Math.sin(phase) * decay(i, sampleRate, TOM.decaySec)
      })
    }
    case 'crash':
      return highPassed(noise(frames(CRASH.sec)), CRASH.hz, sampleRate).map(
        (x, i) => x * decay(i, sampleRate, CRASH.decaySec)
      )
    case 'rim': {
      const click = noise(frames(RIM.sec))
      return click.map(
        (x, n) =>
          (Math.sin((2 * Math.PI * RIM.hz * n) / sampleRate) + x * RIM.click) *
          decay(n, sampleRate, RIM.decaySec)
      )
    }
  }
}

const sounds = new Map<string, Float32Array>()

/** A drum's sound, made once per sample rate and reused. */
export function drum(voice: DrumVoice, sampleRate: number): Float32Array {
  const key = `${voice}@${sampleRate}`
  let sound = sounds.get(key)
  if (!sound) {
    sound = synth(voice, sampleRate)
    sounds.set(key, sound)
  }
  return sound
}

/** A drum's level in the kit, for playing it outside a render (the beat pad's loop). */
export const drumLevel = (voice: DrumVoice): number => LEVEL[voice]

/** Plays drum hits into a buffer starting at `fromSec` on the timeline. */
export function renderDrums(
  hits: DrumHit[],
  fromSec: number,
  lengthSec: number,
  sampleRate: number
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(1, Math.ceil(lengthSec * sampleRate)))
  for (const hit of hits) {
    const sound = drum(hit.voice, sampleRate)
    const start = Math.max(0, Math.round((hit.time - fromSec) * sampleRate))
    const gain = LEVEL[hit.voice] * hit.velocity
    const end = Math.min(out.length, start + sound.length)
    for (let n = start; n < end; n++) out[n] += sound[n - start] * gain
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  if (peak > CEILING) for (let n = 0; n < out.length; n++) out[n] *= CEILING / peak
  return out
}
