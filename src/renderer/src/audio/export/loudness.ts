import { dbToGain, gainToDb } from '../dsp/units'

// Loudness to ITU-R BS.1770-4 / EBU R128, as streaming services measure it.
// https://www.itu.int/rec/R-REC-BS.1770
const BLOCK_SEC = 0.4
// Blocks overlap by 75%, so a new one starts every 100 ms.
const BLOCKS_PER_WINDOW = 4
const ABSOLUTE_GATE_LUFS = -70
const RELATIVE_GATE_LU = -10
// Offsets the K-weighting filter's gain at 1 kHz, so a 1 kHz tone reads its RMS level.
const LOUDNESS_OFFSET = -0.691

// Never boost a mix more than this to reach the target: a near-silent song would
// otherwise come out as amplified hiss.
const MAX_BOOST_DB = 20

type Biquad = [b0: number, b1: number, b2: number, a1: number, a2: number]

/**
 * The two K-weighting stages (a head-shaped high shelf, then a high-pass) for any
 * sample rate, using the analogue prototypes from libebur128.
 * https://github.com/jiixyj/libebur128/blob/master/ebur128/ebur128.c
 */
function kWeighting(sampleRate: number): [Biquad, Biquad] {
  const shelfK = Math.tan((Math.PI * 1681.974450955533) / sampleRate)
  const shelfQ = 0.7071752369554196
  const vh = 10 ** (3.999843853973347 / 20)
  const vb = vh ** 0.4996667741545416
  const a0 = 1 + shelfK / shelfQ + shelfK * shelfK
  const shelf: Biquad = [
    (vh + (vb * shelfK) / shelfQ + shelfK * shelfK) / a0,
    (2 * (shelfK * shelfK - vh)) / a0,
    (vh - (vb * shelfK) / shelfQ + shelfK * shelfK) / a0,
    (2 * (shelfK * shelfK - 1)) / a0,
    (1 - shelfK / shelfQ + shelfK * shelfK) / a0
  ]
  const hpK = Math.tan((Math.PI * 38.13547087602444) / sampleRate)
  const hpQ = 0.5003270373238773
  const hpA0 = 1 + hpK / hpQ + hpK * hpK
  const highPass: Biquad = [
    1,
    -2,
    1,
    (2 * (hpK * hpK - 1)) / hpA0,
    (1 - hpK / hpQ + hpK * hpK) / hpA0
  ]
  return [shelf, highPass]
}

/** Runs a channel through K-weighting and sums its energy in 100 ms steps. */
function stepEnergies(samples: Float32Array, sampleRate: number, stepLength: number): Float64Array {
  const stages = kWeighting(sampleRate)
  const state = stages.map(() => [0, 0, 0, 0])
  const energies = new Float64Array(Math.floor(samples.length / stepLength))
  for (let i = 0; i < energies.length * stepLength; i++) {
    let y = samples[i]
    stages.forEach(([b0, b1, b2, a1, a2], s) => {
      const [x1, x2, y1, y2] = state[s]
      const out = b0 * y + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      state[s] = [y, x1, out, y1]
      y = out
    })
    energies[Math.floor(i / stepLength)] += y * y
  }
  return energies
}

const blockLoudness = (power: number): number => LOUDNESS_OFFSET + 10 * Math.log10(power)

/** Integrated loudness of a stereo or mono mix, in LUFS; -Infinity for silence. */
export function integratedLoudness(channels: Float32Array[], sampleRate: number): number {
  const stepLength = Math.round((sampleRate * BLOCK_SEC) / BLOCKS_PER_WINDOW)
  const blockLength = stepLength * BLOCKS_PER_WINDOW
  const perChannel = channels.map((c) => stepEnergies(c, sampleRate, stepLength))
  const steps = perChannel[0]?.length ?? 0
  // Left and right weigh equally; surround weights don't apply to a stereo mix.
  const blocks: number[] = []
  for (let b = 0; b + BLOCKS_PER_WINDOW <= steps; b++) {
    let power = 0
    for (const energies of perChannel) {
      for (let s = b; s < b + BLOCKS_PER_WINDOW; s++) power += energies[s]
    }
    blocks.push(power / blockLength)
  }
  const gated = (threshold: number, powers: number[]): number[] =>
    powers.filter((p) => blockLoudness(p) > threshold)
  const mean = (powers: number[]): number => powers.reduce((a, b) => a + b, 0) / powers.length

  const audible = gated(ABSOLUTE_GATE_LUFS, blocks)
  if (audible.length === 0) return -Infinity
  const relative = blockLoudness(mean(audible)) + RELATIVE_GATE_LU
  const kept = gated(relative, audible)
  return blockLoudness(mean(kept))
}

/** The gain that brings a mix to the target loudness, never a big boost. */
export function levelGainDb(measuredLufs: number, targetLufs: number): number {
  if (!Number.isFinite(measuredLufs)) return 0
  return Math.min(MAX_BOOST_DB, targetLufs - measuredLufs)
}

export function samplePeakDb(channels: Float32Array[]): number {
  let peak = 0
  for (const channel of channels) {
    for (const s of channel) peak = Math.max(peak, Math.abs(s))
  }
  return gainToDb(peak)
}

/**
 * Turns the whole mix down just enough that no sample passes the ceiling. The
 * limiter catches nearly everything; this catches what slips past its attack.
 */
export function withPeakCeiling(channels: Float32Array[], ceilingDb: number): Float32Array[] {
  const over = samplePeakDb(channels) - ceilingDb
  if (over <= 0) return channels
  const gain = dbToGain(-over)
  return channels.map((c) => c.map((s) => s * gain))
}
