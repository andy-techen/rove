import type { PolishReading } from '@shared/polishTaste'
import { nextTick } from '../dsp/resample'
import {
  AIR_BAND,
  BODY_BAND,
  FRAME,
  Frame,
  HOP,
  PRESENCE_BAND,
  SINGING_OVER_ROOM_DB,
  analyseFrame,
  densityDb,
  singingTest
} from '../dsp/voiceBands'
import { percentile } from '../dsp/stats'

export type { PolishReading }

/** The part of one take that plays: a clip's window into its decoded audio. */
export interface HeardWindow {
  audio: Pick<AudioBuffer, 'sampleRate' | 'numberOfChannels' | 'length' | 'getChannelData'>
  offsetSec: number
  /** 0 means to the end of the file (older projects). */
  durationSec: number
}

// Frames analysed between pauses that let the window repaint.
const FRAMES_PER_CHUNK = 400

const SIBILANT_SHARE = 0.5
// Hum: most of the energy between lines sits below this.
const HUM_SHARE = 0.5
// Fewer seconds of singing than this is too little to set anything from.
const MIN_SINGING_SEC = 5
const MIN_SIBILANT_FRAMES = 5
// A take clipped where this many samples in a row sit at full scale.
const CLIP_LEVEL = 0.999
const CLIP_RUN = 3

const PERCENT = {
  soft: 0.1,
  median: 0.5,
  loud: 0.95,
  room: 0.2
}

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

const sum = (frames: Frame[], key: keyof Frame): number =>
  frames.reduce((total, f) => total + f[key], 0)

/**
 * Listens to the played parts of a vocal track's takes and measures what auto polish
 * needs. Null when there's too little singing to say anything.
 */
export async function analyseVoice(windows: HeardWindow[]): Promise<PolishReading | null> {
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
  const test = singingTest(frames)
  if (!test) return null
  const { roomDb: roomGuess, floorDb: singingFloor, isSinging } = test
  const isSibilant = (f: Frame): boolean =>
    f.db > roomGuess + SINGING_OVER_ROOM_DB && f.sibilantShare >= SIBILANT_SHARE
  const singing = frames.filter(isSinging)
  const singingSec = frames.reduce((sec, f, i) => sec + (isSinging(f) ? secPerHop[i] : 0), 0)
  if (singingSec < MIN_SINGING_SEC) return null
  const sibilant = frames.filter(isSibilant)
  const gaps = frames.filter((f) => f.db <= singingFloor && !isSibilant(f))

  const sung = singing.map((f) => f.db)
  const softDb = percentile(sung, PERCENT.soft)
  const mid = sum(singing, 'mid')
  return {
    voiceDb: percentile(sung, PERCENT.median),
    softDb,
    rangeDb: percentile(sung, PERCENT.loud) - softDb,
    noiseDb: gaps.length
      ? percentile(
          gaps.map((f) => f.db),
          PERCENT.room
        )
      : roomGuess,
    hum:
      gaps.length > 0 &&
      percentile(
        gaps.map((f) => f.humShare),
        PERCENT.median
      ) >= HUM_SHARE,
    sibilanceDb:
      sibilant.length >= MIN_SIBILANT_FRAMES
        ? percentile(
            sibilant.map((f) => f.deEssDb),
            PERCENT.loud
          )
        : null,
    bodyDb: densityDb(sum(singing, 'body'), BODY_BAND, mid),
    presenceDb: densityDb(sum(singing, 'presence'), PRESENCE_BAND, mid),
    airDb: densityDb(sum(singing, 'air'), AIR_BAND, mid),
    clipped
  }
}
