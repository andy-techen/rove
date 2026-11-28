import { describe, expect, it } from 'vitest'
import { dbToGain } from '../dsp/units'
import { seededNoise } from '../dsp/noise'
import { HeardWindow, analyseVoice } from './polishReading'

const RATE = 48000

/** A sung-like tone: a 220 Hz voice with harmonics up to about 4 kHz, at an RMS level. */
function voice(sec: number, db: number, body = 1): Float32Array {
  const out = new Float32Array(Math.round(sec * RATE))
  const harmonics = Array.from({ length: 18 }, (_, i) => (i < 2 ? body : 1) / (i + 1))
  const rms = Math.sqrt(harmonics.reduce((sum, a) => sum + (a * a) / 2, 0))
  const scale = dbToGain(db) / rms
  for (let n = 0; n < out.length; n++) {
    let v = 0
    harmonics.forEach((a, i) => (v += a * Math.sin((2 * Math.PI * 220 * (i + 1) * n) / RATE)))
    out[n] = v * scale
  }
  return out
}

/** An "s": a burst of energy between 6.5 and 11 kHz, at an RMS level. */
function ess(sec: number, db: number): Float32Array {
  const out = new Float32Array(Math.round(sec * RATE))
  const random = seededNoise(3)
  const partials = Array.from({ length: 19 }, (_, i) => ({
    hz: 6500 + i * 250,
    phase: random() * Math.PI
  }))
  const scale = dbToGain(db) / Math.sqrt(partials.length / 2)
  for (let n = 0; n < out.length; n++) {
    let v = 0
    for (const p of partials) v += Math.sin((2 * Math.PI * p.hz * n) / RATE + p.phase)
    out[n] = v * scale
  }
  return out
}

const silence = (sec: number): Float32Array => new Float32Array(Math.round(sec * RATE))

const join = (...parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Room noise (white, at an RMS level) and an optional 60 Hz hum over the whole take. */
function inRoom(take: Float32Array, noiseDb: number, humDb?: number): Float32Array {
  const random = seededNoise(7)
  // Uniform noise in ±1 has an RMS of 1/√3.
  const noise = dbToGain(noiseDb) * Math.sqrt(3)
  const hum = humDb === undefined ? 0 : dbToGain(humDb) * Math.SQRT2
  return take.map((s, n) => s + random() * noise + hum * Math.sin((2 * Math.PI * 60 * n) / RATE))
}

/** Phrases of singing with short gaps between them. */
const phrases = (count: number, db: (i: number) => number, gap = silence(0.6)): Float32Array =>
  join(...Array.from({ length: count }, (_, i) => join(voice(2, db(i)), gap)))

const heard = (data: Float32Array, offsetSec = 0, durationSec = 0): HeardWindow => ({
  audio: {
    sampleRate: RATE,
    numberOfChannels: 1,
    length: data.length,
    getChannelData: () => data as Float32Array<ArrayBuffer>
  },
  offsetSec,
  durationSec
})

describe('analyseVoice', () => {
  it('hears how loud the room is between lines', async () => {
    const profile = await analyseVoice([
      heard(
        inRoom(
          phrases(4, () => -20),
          -60
        )
      )
    ])
    expect(Math.abs(profile!.noiseDb + 60)).toBeLessThan(2)
  })

  it('hears how loud the voice is', async () => {
    const profile = await analyseVoice([
      heard(
        inRoom(
          phrases(4, () => -20),
          -60
        )
      )
    ])
    expect(Math.abs(profile!.voiceDb + 20)).toBeLessThan(1)
  })

  it('hears soft and strong moments as a spread', async () => {
    const steady = await analyseVoice([
      heard(
        inRoom(
          phrases(6, () => -20),
          -70
        )
      )
    ])
    const wide = await analyseVoice([
      heard(
        inRoom(
          phrases(6, (i) => -32 + i * 4),
          -70
        )
      )
    ])
    expect(wide!.rangeDb).toBeGreaterThan(steady!.rangeDb + 10)
  })

  it('hears mains hum in the room', async () => {
    const clean = await analyseVoice([
      heard(
        inRoom(
          phrases(4, () => -20),
          -65
        )
      )
    ])
    const humming = await analyseVoice([
      heard(
        inRoom(
          phrases(4, () => -20),
          -65,
          -50
        )
      )
    ])
    expect(clean?.hum).toBe(false)
    expect(humming?.hum).toBe(true)
  })

  it('hears louder "s" sounds as more sibilance', async () => {
    const withEss = (db: number): Float32Array =>
      inRoom(
        phrases(4, () => -20, join(ess(0.15, db), silence(0.45))),
        -70
      )
    const soft = await analyseVoice([heard(withEss(-40))])
    const sharp = await analyseVoice([heard(withEss(-25))])
    expect(sharp!.sibilanceDb!).toBeGreaterThan(soft!.sibilanceDb! + 10)
  })

  it('hears a thin voice as having less body', async () => {
    const full = await analyseVoice([
      heard(
        inRoom(
          phrases(4, () => -20),
          -70
        )
      )
    ])
    const thin = await analyseVoice([
      heard(
        inRoom(
          join(...Array.from({ length: 4 }, () => join(voice(2, -20, 0.2), silence(0.6)))),
          -70
        )
      )
    ])
    expect(thin!.bodyDb).toBeLessThan(full!.bodyDb - 6)
  })

  it('only listens to the part of a take that plays', async () => {
    const take = inRoom(
      join(
        phrases(4, () => -10),
        phrases(4, () => -30)
      ),
      -70
    )
    const profile = await analyseVoice([heard(take, 10.4, 10.4)])
    expect(Math.abs(profile!.voiceDb + 30)).toBeLessThan(1)
  })

  it('notices when a take was too loud', async () => {
    const take = phrases(4, () => -20)
    take.fill(1, 1000, 1100)
    expect((await analyseVoice([heard(take)]))?.clipped).toBe(true)
    expect((await analyseVoice([heard(phrases(4, () => -20))]))?.clipped).toBe(false)
  })

  it('needs a few seconds of singing to say anything', async () => {
    expect(await analyseVoice([heard(silence(10))])).toBeNull()
    expect(
      await analyseVoice([
        heard(
          inRoom(
            phrases(1, () => -20),
            -60
          )
        )
      ])
    ).toBeNull()
  })
})
