// How a voice's energy splits across frequency bands, frame by frame. Auto polish reads
// tone from this to set its controls; the voice profile sums it over every song.
import { fft, hann as hannWindow } from './fft'
import { gainToDb } from './units'
import { percentile } from './stats'

export const FRAME = 2048
export const HOP = FRAME / 2

export type Band = readonly [number, number]

// Bands, in Hz. The mixer's de-esser splits at DE_ESS_BAND's lower edge.
export const VOICED_BAND: Band = [80, 5000]
export const SIBILANT_BAND: Band = [5000, Infinity]
export const HUM_BAND: Band = [0, 150]
export const DE_ESS_BAND: Band = [6000, Infinity]
export const BODY_BAND: Band = [150, 400]
export const MID_BAND: Band = [1000, 2000]
export const PRESENCE_BAND: Band = [2500, 5000]
export const AIR_BAND: Band = [8000, 12000]

// Below this the whole recording is silence.
const SILENCE_DB = -70
// Singing sits at least this far over the room, and within this far of the loudest moments.
export const SINGING_OVER_ROOM_DB = 10
const SINGING_UNDER_LOUD_DB = 30
// Share of a frame's energy that marks it as voiced.
const VOICED_SHARE = 0.5

const PERCENT = { loud: 0.95, roomGuess: 0.1 }

export interface Frame {
  db: number
  voicedShare: number
  sibilantShare: number
  humShare: number
  deEssDb: number
  body: number
  mid: number
  presence: number
  air: number
}

const hann = hannWindow(FRAME)
const hannPower = hann.reduce((sum, w) => sum + w * w, 0)

/** One frame's level and how its energy splits across the bands. */
export function analyseFrame(samples: Float32Array, at: number, sampleRate: number): Frame {
  const re = new Float64Array(FRAME)
  const im = new Float64Array(FRAME)
  let energy = 0
  for (let n = 0; n < FRAME; n++) {
    const s = samples[at + n]
    energy += s * s
    re[n] = s * hann[n]
  }
  fft(re, im)
  const hzPerBin = sampleRate / FRAME
  // Mean power in a band (Parseval), counting both halves of the spectrum.
  const band = ([lo, hi]: Band): number => {
    let sum = 0
    for (let k = Math.max(1, Math.ceil(lo / hzPerBin)); k < FRAME / 2 && k * hzPerBin < hi; k++) {
      sum += re[k] * re[k] + im[k] * im[k]
    }
    return (2 * sum) / (FRAME * hannPower)
  }
  const total = band([0, Infinity]) || Number.MIN_VALUE
  return {
    db: gainToDb(Math.sqrt(energy / FRAME)),
    voicedShare: band(VOICED_BAND) / total,
    sibilantShare: band(SIBILANT_BAND) / total,
    humShare: band(HUM_BAND) / total,
    deEssDb: gainToDb(Math.sqrt(band(DE_ESS_BAND))),
    body: band(BODY_BAND),
    mid: band(MID_BAND),
    presence: band(PRESENCE_BAND),
    air: band(AIR_BAND)
  }
}

/** Every whole frame of a recording, a hop apart. */
export function analyseFrames(samples: Float32Array, sampleRate: number): Frame[] {
  const frames: Frame[] = []
  for (let at = 0; at + FRAME <= samples.length; at += HOP) {
    frames.push(analyseFrame(samples, at, sampleRate))
  }
  return frames
}

export interface SingingTest {
  /** A guess at the room's level, from the quietest frames. */
  roomDb: number
  /** Singing is louder than this. */
  floorDb: number
  isSinging(frame: Frame): boolean
}

/**
 * Which frames are singing: loud enough over the room, close enough to the loudest
 * moments, and mostly voiced. Null when the frames are all silence.
 */
export function singingTest(frames: Frame[]): SingingTest | null {
  if (frames.length === 0) return null
  const levels = frames.map((f) => f.db)
  const loudest = percentile(levels, PERCENT.loud)
  if (loudest < SILENCE_DB) return null
  const roomDb = percentile(levels, PERCENT.roomGuess)
  const floorDb = Math.max(roomDb + SINGING_OVER_ROOM_DB, loudest - SINGING_UNDER_LOUD_DB)
  return { roomDb, floorDb, isSinging: (f) => f.db > floorDb && f.voicedShare >= VOICED_SHARE }
}

/** A band's per-Hz level relative to the 1–2 kHz band's, from their summed powers. */
export function densityDb(power: number, band: Band, midPower: number): number {
  const refDensity = midPower / (MID_BAND[1] - MID_BAND[0])
  return 10 * Math.log10((power / (band[1] - band[0]) + Number.MIN_VALUE) / (refDensity || 1))
}
