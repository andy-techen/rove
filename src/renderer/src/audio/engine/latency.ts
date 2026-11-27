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

/**
 * The round-trip delay as far as the system reports it: the music's way out to the
 * singer's ears plus the voice's way in from the mic. Takes are shifted earlier by this
 * so they line up with the music they were sung to.
 */
export function estimatedLatency(ctx: AudioContext, inputSec = 0): number {
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + inputSec
}

// Bluetooth headphones can add a quarter of a second or more that macOS doesn't report;
// anything past these is more likely a misheard take than a real delay.
const LEARNED_MIN_SEC = -0.1
const LEARNED_MAX_SEC = 0.5

/**
 * The extra delay to remove from takes on this mic and output, after the singer lined
 * a take up by `linedUpBySec`: the next take lands in time without asking.
 */
export function learnLatency(previousSec: number, linedUpBySec: number): number {
  return Math.min(LEARNED_MAX_SEC, Math.max(LEARNED_MIN_SEC, previousSec + linedUpBySec))
}
