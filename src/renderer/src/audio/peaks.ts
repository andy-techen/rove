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
