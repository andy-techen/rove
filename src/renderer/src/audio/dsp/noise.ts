const MULTIPLIER = 16807
const MODULUS = 2147483647

/**
 * Repeatable noise between −1 and 1, so a render sounds the same every time:
 * Park–Miller "minimal standard" random numbers. Each call gives the next sample.
 */
export function seededNoise(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * MULTIPLIER) % MODULUS
    return (state / MODULUS) * 2 - 1
  }
}
