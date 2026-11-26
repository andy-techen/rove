/**
 * A steady, made-up waveform for the drawings: a few sines, so it reads as sung rather
 * than random, and comes out the same on every build. Values are 0–1, with a near-silent
 * floor outside the phrases.
 */
export function wave(bars: number, seed: number, phrases: [number, number][] = [[0, 1]]): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const t = i / bars
    if (!phrases.some(([a, b]) => t >= a && t <= b)) return 0.04
    const shape = 0.55 + 0.3 * Math.sin(i * 0.37 + seed) + 0.15 * Math.sin(i * 1.7 + seed * 2)
    return Math.max(0.1, Math.min(1, shape))
  })
}
