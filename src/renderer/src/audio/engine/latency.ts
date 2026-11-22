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
 * The round-trip delay as far as the browser can report it (the output side). Takes are
 * shifted earlier by this so they line up with the music they were sung to.
 */
export function estimatedLatency(ctx: AudioContext): number {
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
}
