import type { DrumHit, DrumVoice } from '../../state/chords/beats'
import { seededNoise } from '../dsp/noise'

// Each drum is synthesised once per sample rate: a few short sounds, so no samples ship.

const NOISE_SEED = 1618

function noise(length: number): Float32Array {
  const next = seededNoise(NOISE_SEED)
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

// Kick: a low sine that drops in pitch as it dies, the thump of a bass drum.
const KICK = { sec: 0.45, fromHz: 140, toHz: 48, sweepSec: 0.05, decaySec: 0.14 }
// Snare: a short tone for the drum, under a burst of noise for the wires.
const SNARE = { sec: 0.25, hz: 190, toneSec: 0.04, wiresSec: 0.07, wiresHz: 1500, tone: 0.5 }
// Hats: high, bright noise; closed is a tick, open rings a little.
const HAT = { sec: 0.08, decaySec: 0.018, hz: 7000 }
const OPEN_HAT = { sec: 0.4, decaySec: 0.12, hz: 6000 }
// Rim: a short knock, for quiet bars.
const RIM = { sec: 0.05, hz: 1700, decaySec: 0.008, click: 0.4 }
// Clap: a few hands a moment apart, then the room.
const CLAP = { sec: 0.3, hz: 1200, burstGapSec: 0.011, bursts: 3, burstSec: 0.004, tailSec: 0.06 }
// Tom: a tuned drum, a fifth or so above the kick, that sags in pitch as it rings.
const TOM = { sec: 0.5, fromHz: 190, toHz: 120, sweepSec: 0.08, decaySec: 0.18 }
// Crash: a big wash of bright noise that takes a while to die.
const CRASH = { sec: 1.6, hz: 4500, decaySec: 0.55 }

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

// Each drum's level in the kit. Quiet beside the guitar, and the hats quieter still: the
// voice is the star. Even every drum struck at once, full force, stays well under 1.
const LEVEL: Record<DrumVoice, number> = {
  kick: 0.34,
  snare: 0.22,
  clap: 0.16,
  rim: 0.12,
  hat: 0.06,
  openHat: 0.06,
  tom: 0.22,
  crash: 0.08
}

/** A drum's level in the kit, for playing it outside a render (the beat pad's loop). */
export const drumLevel = (voice: DrumVoice): number => LEVEL[voice]

// The loudest a render may be. Every drum at once, hard, could pass it, so a render that
// would is turned down as a whole: quieter, never clipped.
const CEILING = 0.9

/** The longest any drum rings, so a render can leave room after its last bar. */
export const DRUM_TAIL_SEC = CRASH.sec

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
