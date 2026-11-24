import { fft } from '../dsp/fft'
import { nextTick } from '../dsp/resample'
import { gainToDb } from '../dsp/units'

/** What auto polish heard in a vocal track's takes. Levels are dBFS (RMS). */
export interface VoiceProfile {
  /** Typical singing level: the median of the sung moments. */
  voiceDb: number
  /** Soft singing: the quietest tenth of the sung moments. */
  softDb: number
  /** How far strong singing rises above soft singing. */
  rangeDb: number
  /** The room between lines. */
  noiseDb: number
  /** Mains hum or rumble between lines. */
  hum: boolean
  /** Level of the "s" sounds above the de-esser's split; null when there are too few. */
  sibilanceDb: number | null
  /** The voice's tone, per Hz, relative to 1–2 kHz: body, presence and air. */
  bodyDb: number
  presenceDb: number
  airDb: number
  /** Some of a take hit full scale: too loud to fix afterwards. */
  clipped: boolean
}

/** The part of one take that plays: a clip's window into its decoded audio. */
export interface HeardWindow {
  audio: Pick<AudioBuffer, 'sampleRate' | 'numberOfChannels' | 'length' | 'getChannelData'>
  offsetSec: number
  /** 0 means to the end of the file (older projects). */
  durationSec: number
}

const FRAME = 2048
const HOP = FRAME / 2
// Frames analysed between pauses that let the window repaint.
const FRAMES_PER_CHUNK = 400

// Below this the whole track is silence.
const SILENCE_DB = -70
// Singing sits at least this far over the room, and within this far of the loudest moments.
const SINGING_OVER_ROOM_DB = 10
const SINGING_UNDER_LOUD_DB = 30
// Share of a frame's energy that marks it as voiced (low) or as an "s" (high).
const VOICED_SHARE = 0.5
const SIBILANT_SHARE = 0.5
// Hum: most of the energy between lines sits below this.
const HUM_SHARE = 0.5
// Fewer seconds of singing than this is too little to set anything from.
const MIN_SINGING_SEC = 5
const MIN_SIBILANT_FRAMES = 5
// A take clipped where this many samples in a row sit at full scale.
const CLIP_LEVEL = 0.999
const CLIP_RUN = 3

// Bands, in Hz. The de-esser band matches the de-esser's split in the mixer.
const VOICED_BAND = [80, 5000] as const
const SIBILANT_BAND = [5000, Infinity] as const
const HUM_BAND = [0, 150] as const
const DE_ESS_BAND = [6000, Infinity] as const
const BODY_BAND = [150, 400] as const
const MID_BAND = [1000, 2000] as const
const PRESENCE_BAND = [2500, 5000] as const
const AIR_BAND = [8000, 12000] as const

const PERCENT = {
  soft: 0.1,
  median: 0.5,
  loud: 0.95,
  room: 0.2,
  roomFallback: 0.1
}

interface Frame {
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

const hann = Float64Array.from(
  { length: FRAME },
  (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (FRAME - 1))
)
const hannPower = hann.reduce((sum, w) => sum + w * w, 0)

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(p * (sorted.length - 1))]
}

const median = (values: number[]): number => percentile(values, PERCENT.median)

/** The played part of a take, mixed to mono. */
function monoWindow(heard: HeardWindow): Float32Array {
  const { audio, offsetSec, durationSec } = heard
  const start = Math.min(audio.length, Math.max(0, Math.round(offsetSec * audio.sampleRate)))
  const end =
    durationSec > 0
      ? Math.min(audio.length, start + Math.round(durationSec * audio.sampleRate))
      : audio.length
  const mono = new Float32Array(Math.max(0, end - start))
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const channel = audio.getChannelData(c)
    for (let i = 0; i < mono.length; i++) mono[i] += channel[start + i] / audio.numberOfChannels
  }
  return mono
}

function hasClipping(samples: Float32Array): boolean {
  let run = 0
  for (const s of samples) {
    run = Math.abs(s) >= CLIP_LEVEL ? run + 1 : 0
    if (run >= CLIP_RUN) return true
  }
  return false
}

/** One frame's level and how its energy splits across the bands. */
function analyseFrame(samples: Float32Array, at: number, sampleRate: number): Frame {
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
  const band = ([lo, hi]: readonly [number, number]): number => {
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

/** Per-Hz level of one band relative to another, over many frames. */
function densityDb(frames: Frame[], key: keyof Frame, width: number, ref: Frame[]): number {
  const sum = (fs: Frame[], k: keyof Frame): number => fs.reduce((s, f) => s + f[k], 0)
  const refDensity = sum(ref, 'mid') / (MID_BAND[1] - MID_BAND[0])
  return 10 * Math.log10((sum(frames, key) / width + Number.MIN_VALUE) / (refDensity || 1))
}

/**
 * Listens to the played parts of a vocal track's takes and measures what auto polish
 * needs. Null when there's too little singing to say anything.
 */
export async function analyseVoice(windows: HeardWindow[]): Promise<VoiceProfile | null> {
  const frames: Frame[] = []
  let clipped = false
  const secPerHop: number[] = []
  for (const heard of windows) {
    const samples = monoWindow(heard)
    clipped ||= hasClipping(samples)
    for (let at = 0; at + FRAME <= samples.length; at += HOP) {
      frames.push(analyseFrame(samples, at, heard.audio.sampleRate))
      secPerHop.push(HOP / heard.audio.sampleRate)
      if (frames.length % FRAMES_PER_CHUNK === 0) await nextTick()
    }
  }
  if (frames.length === 0) return null
  const levels = frames.map((f) => f.db)
  const loudest = percentile(levels, PERCENT.loud)
  if (loudest < SILENCE_DB) return null

  const roomGuess = percentile(levels, PERCENT.roomFallback)
  const singingFloor = Math.max(roomGuess + SINGING_OVER_ROOM_DB, loudest - SINGING_UNDER_LOUD_DB)
  const isSinging = (f: Frame): boolean => f.db > singingFloor && f.voicedShare >= VOICED_SHARE
  const isSibilant = (f: Frame): boolean =>
    f.db > roomGuess + SINGING_OVER_ROOM_DB && f.sibilantShare >= SIBILANT_SHARE
  const singing = frames.filter(isSinging)
  const singingSec = frames.reduce((sec, f, i) => sec + (isSinging(f) ? secPerHop[i] : 0), 0)
  if (singingSec < MIN_SINGING_SEC) return null
  const sibilant = frames.filter(isSibilant)
  const gaps = frames.filter((f) => f.db <= singingFloor && !isSibilant(f))

  const sung = singing.map((f) => f.db)
  const softDb = percentile(sung, PERCENT.soft)
  return {
    voiceDb: median(sung),
    softDb,
    rangeDb: percentile(sung, PERCENT.loud) - softDb,
    noiseDb: gaps.length
      ? percentile(
          gaps.map((f) => f.db),
          PERCENT.room
        )
      : roomGuess,
    hum: gaps.length > 0 && median(gaps.map((f) => f.humShare)) >= HUM_SHARE,
    sibilanceDb:
      sibilant.length >= MIN_SIBILANT_FRAMES
        ? percentile(
            sibilant.map((f) => f.deEssDb),
            PERCENT.loud
          )
        : null,
    bodyDb: densityDb(singing, 'body', BODY_BAND[1] - BODY_BAND[0], singing),
    presenceDb: densityDb(singing, 'presence', PRESENCE_BAND[1] - PRESENCE_BAND[0], singing),
    airDb: densityDb(singing, 'air', AIR_BAND[1] - AIR_BAND[0], singing),
    clipped
  }
}
