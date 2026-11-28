import { beforeAll, describe, expect, it } from 'vitest'
import { dbToGain } from '../dsp/units'
import { seededNoise } from '../dsp/noise'
import { join, silence as silenceAt } from '../../test/signals'
import { HeardWindow, PolishReading, analyseVoice } from './polishReading'

// High enough to hold the "s" band (up to 11 kHz); lower rates keep the fixtures quick.
const RATE = 24000
const PHRASE_SEC = 2

const silence = (sec: number): Float32Array => silenceAt(sec, RATE)

/** A sung-like phrase at 0 dB RMS: a 220 Hz voice with harmonics up to about 4 kHz. */
function unitVoice(body: number): Float32Array {
  const out = new Float32Array(PHRASE_SEC * RATE)
  const harmonics = Array.from({ length: 18 }, (_, i) => (i < 2 ? body : 1) / (i + 1))
  const rms = Math.sqrt(harmonics.reduce((sum, a) => sum + (a * a) / 2, 0))
  for (let n = 0; n < out.length; n++) {
    let v = 0
    harmonics.forEach((a, i) => (v += a * Math.sin((2 * Math.PI * 220 * (i + 1) * n) / RATE)))
    out[n] = v / rms
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

/** Room noise (white, at an RMS level) and an optional 60 Hz hum over the whole take. */
function inRoom(take: Float32Array, noiseDb: number, humDb?: number): Float32Array {
  const random = seededNoise(7)
  // Uniform noise in ±1 has an RMS of 1/√3.
  const noise = dbToGain(noiseDb) * Math.sqrt(3)
  const hum = humDb === undefined ? 0 : dbToGain(humDb) * Math.SQRT2
  return take.map((s, n) => s + random() * noise + hum * Math.sin((2 * Math.PI * 60 * n) / RATE))
}

const FULL = unitVoice(1)
const THIN = unitVoice(0.2)

/** Phrases of singing with short gaps between them. */
const phrases = (
  count: number,
  db: (i: number) => number,
  { gap = silence(0.6), sung = FULL } = {}
): Float32Array =>
  join(
    ...Array.from({ length: count }, (_, i) =>
      join(
        sung.map((s) => s * dbToGain(db(i))),
        gap
      )
    )
  )

const ROOM_DB = -65
const VOICE_DB = -20
const steady = (): Float32Array => phrases(4, () => VOICE_DB)

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

const read = async (data: Float32Array, offsetSec = 0, durationSec = 0) =>
  (await analyseVoice([heard(data, offsetSec, durationSec)]))!

describe('analyseVoice', () => {
  // A steady voice in a quiet, clean room: the other side of most comparisons.
  let usual: PolishReading
  beforeAll(async () => {
    usual = await read(inRoom(steady(), ROOM_DB))
  })

  it('hears how loud the voice is, and the room between lines', () => {
    expect(Math.abs(usual.voiceDb - VOICE_DB)).toBeLessThan(1)
    expect(Math.abs(usual.noiseDb - ROOM_DB)).toBeLessThan(2)
  })

  it('hears soft and strong moments as a spread', async () => {
    const wide = await read(
      inRoom(
        phrases(4, (i) => -32 + i * 6),
        ROOM_DB
      )
    )
    expect(wide.rangeDb).toBeGreaterThan(usual.rangeDb + 10)
  })

  it('hears mains hum in the room', async () => {
    expect(usual.hum).toBe(false)
    expect((await read(inRoom(steady(), ROOM_DB, -50))).hum).toBe(true)
  })

  it('hears louder "s" sounds as more sibilance', async () => {
    const withEss = (db: number): Float32Array =>
      inRoom(
        phrases(4, () => VOICE_DB, { gap: join(ess(0.15, db), silence(0.45)) }),
        -70
      )
    const soft = await read(withEss(-40))
    const sharp = await read(withEss(-25))
    expect(sharp.sibilanceDb!).toBeGreaterThan(soft.sibilanceDb! + 10)
  })

  it('hears a thin voice as having less body', async () => {
    const thin = await read(
      inRoom(
        phrases(4, () => VOICE_DB, { sung: THIN }),
        ROOM_DB
      )
    )
    expect(thin.bodyDb).toBeLessThan(usual.bodyDb - 6)
  })

  it('only listens to the part of a take that plays', async () => {
    const take = inRoom(
      join(
        phrases(4, () => -10),
        phrases(4, () => -30)
      ),
      -70
    )
    const profile = await read(take, 10.4, 10.4)
    expect(Math.abs(profile.voiceDb + 30)).toBeLessThan(1)
  })

  it('notices when a take was too loud', async () => {
    const take = steady()
    take.fill(1, 1000, 1100)
    expect((await read(take)).clipped).toBe(true)
    expect(usual.clipped).toBe(false)
  })

  it('needs a few seconds of singing to say anything', async () => {
    expect(await analyseVoice([heard(silence(10))])).toBeNull()
    expect(
      await analyseVoice([
        heard(
          inRoom(
            phrases(1, () => VOICE_DB),
            -60
          )
        )
      ])
    ).toBeNull()
  })
})
