import { createRecorder } from './engine'

/** Where a take belongs on the timeline once the round-trip delay is removed. */
export function alignTake(
  fromSec: number,
  fileDurationSec: number,
  latencySec: number
): { start: number; offset: number; duration: number } {
  // A note sung in time with the music at timeline t reaches the recorder at
  // t + latency, so the take is shifted earlier by the latency.
  const start = fromSec - latencySec
  if (start >= 0) return { start, offset: 0, duration: fileDurationSec }
  return { start: 0, offset: -start, duration: Math.max(0, fileDurationSec + start) }
}

export const CLICK_TIMES = [0.5, 1.0, 1.5, 2.0, 2.5]
const CAPTURE_SEC = 3.2
const SEARCH_WINDOW_SEC = 0.4
const MAX_SPREAD_SEC = 0.004
// A click must stand this far above the room noise (and above this absolute floor).
const MIN_CLICK_OVER_NOISE = 4
const MIN_CLICK_LEVEL = 0.01
// The click's onset is where it first reaches half its peak.
const ONSET_FRACTION = 0.5
const CLICK_SEC = 0.004
const CLICK_HZ = 2000
const CLICK_LEVEL = 0.8
// Extra listening time after the last click, for the slowest setups.
const TAIL_SEC = 0.3
const MS_PER_SEC = 1000
// Scheduling slightly ahead so the clicks and the recorder start on the same frame.
const START_LEAD_SEC = 0.2

/**
 * Finds how late each click arrived in the recording. Returns the median delay in
 * seconds, or null when the clicks weren't heard clearly or didn't agree.
 */
export function estimateLatency(
  samples: Float32Array,
  sampleRate: number,
  clickTimes: number[] = CLICK_TIMES
): number | null {
  // The pre-roll before the first click tells us how loud the room is.
  let noise = 0
  const preRoll = Math.min(samples.length, Math.floor(clickTimes[0] * sampleRate))
  for (let i = 0; i < preRoll; i++) noise = Math.max(noise, Math.abs(samples[i]))

  const delays: number[] = []
  for (const click of clickTimes) {
    const from = Math.floor(click * sampleRate)
    const to = Math.min(samples.length, from + Math.floor(SEARCH_WINDOW_SEC * sampleRate))
    let peak = 0
    for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(samples[i]))
    if (peak < Math.max(MIN_CLICK_LEVEL, noise * MIN_CLICK_OVER_NOISE)) continue
    for (let i = from; i < to; i++) {
      if (Math.abs(samples[i]) >= peak * ONSET_FRACTION) {
        delays.push(i / sampleRate - click)
        break
      }
    }
  }

  if (delays.length < clickTimes.length - 1) return null
  delays.sort((a, b) => a - b)
  if (delays[delays.length - 1] - delays[0] > MAX_SPREAD_SEC) return null
  return delays[Math.floor(delays.length / 2)]
}

export function makeClickTrack(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const buffer = ctx.createBuffer(1, Math.ceil(CAPTURE_SEC * sr), sr)
  const data = buffer.getChannelData(0)
  const clickLen = Math.floor(CLICK_SEC * sr)
  for (const t of CLICK_TIMES) {
    const start = Math.floor(t * sr)
    for (let i = 0; i < clickLen; i++) {
      // A short, decaying burst: sharp onset, easy to find in the recording.
      data[start + i] =
        CLICK_LEVEL * Math.sin((2 * Math.PI * CLICK_HZ * i) / sr) * (1 - i / clickLen)
    }
  }
  return buffer
}

/** Plays the click track out loud and listens for it. */
export async function measureLatency(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode
): Promise<number | null> {
  await ctx.resume()
  const recorder = await createRecorder(source)
  try {
    const clicks = ctx.createBufferSource()
    clicks.buffer = makeClickTrack(ctx)
    clicks.connect(ctx.destination)
    const startAt = ctx.currentTime + START_LEAD_SEC
    clicks.start(startAt)
    recorder.start(startAt)
    await new Promise((r) => setTimeout(r, (CAPTURE_SEC + TAIL_SEC) * MS_PER_SEC))
    clicks.disconnect()
    return estimateLatency(await recorder.stop(), ctx.sampleRate)
  } finally {
    recorder.dispose()
  }
}

/** Uncalibrated fallback: the output half of the delay, which the browser can report. */
export function estimatedLatency(ctx: AudioContext): number {
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
}

const key = (deviceId: string): string => `rove.latency.${deviceId}`

export function loadLatency(deviceId: string): number | null {
  try {
    const raw = localStorage.getItem(key(deviceId))
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

export function saveLatency(deviceId: string, seconds: number | null): void {
  try {
    if (seconds === null) localStorage.removeItem(key(deviceId))
    else localStorage.setItem(key(deviceId), String(seconds))
  } catch {
    // Calibration is per session if storage is unavailable.
  }
}
