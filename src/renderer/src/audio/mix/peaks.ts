import { dbToGain } from '../dsp/units'

/** Collects min/max pairs for fixed-size buckets of audio as it streams in. */
export class PeakAccumulator {
  private pairs: number[] = []
  private min = 0
  private max = 0
  private filled = 0

  constructor(readonly bucketSize: number) {}

  push(samples: Float32Array): void {
    for (const s of samples) {
      if (s < this.min) this.min = s
      if (s > this.max) this.max = s
      if (++this.filled === this.bucketSize) {
        this.pairs.push(this.min, this.max)
        this.min = this.max = this.filled = 0
      }
    }
  }

  /** The loudest sample so far, either way from zero. */
  get peak(): number {
    let peak = 0
    for (const v of this.pairs) peak = Math.max(peak, Math.abs(v))
    return peak
  }

  get bucketCount(): number {
    return this.pairs.length / 2
  }

  /** Min/max pairs per pixel, `bucketsPerPixel` buckets wide each, starting at `fromBucket`. */
  resample(pixels: number, bucketsPerPixel: number, fromBucket = 0): Float32Array {
    const out = new Float32Array(Math.max(0, pixels) * 2)
    const count = this.bucketCount
    for (let x = 0; x < pixels; x++) {
      const from = Math.floor(fromBucket + x * bucketsPerPixel)
      const to = Math.min(
        count,
        Math.max(from + 1, Math.floor(fromBucket + (x + 1) * bucketsPerPixel))
      )
      let min = 0
      let max = 0
      for (let b = from; b < to; b++) {
        if (this.pairs[b * 2] < min) min = this.pairs[b * 2]
        if (this.pairs[b * 2 + 1] > max) max = this.pairs[b * 2 + 1]
      }
      out[x * 2] = min
      out[x * 2 + 1] = max
    }
    return out
  }
}

// A waveform is drawn to fill its lane at its own loudest moment, so a vocal recorded
// with healthy headroom (peaking around -12 dB) reads as clearly as mastered music
// that peaks at 0 dB. Quieter than this peak it's mostly room noise: not blown up.
const QUIETEST_FILLED_PEAK = dbToGain(-30)

/** How much to enlarge a waveform whose loudest moment is `peak`, for drawing only. */
export const waveScale = (peak: number): number => 1 / Math.max(peak, QUIETEST_FILLED_PEAK)

// ~5 ms per bucket at 48 kHz: fine enough for any zoom the timeline offers, and a
// 3-minute song is only ~34k buckets to redraw from while dragging.
const OVERVIEW_BUCKET = 256
const overviews = new WeakMap<AudioBuffer, PeakAccumulator>()

/** Peaks for a whole decoded file, computed once and reused for every redraw. */
export function overviewOf(audio: AudioBuffer): PeakAccumulator {
  let overview = overviews.get(audio)
  if (!overview) {
    overview = new PeakAccumulator(OVERVIEW_BUCKET)
    overview.push(audio.getChannelData(0))
    overviews.set(audio, overview)
  }
  return overview
}
