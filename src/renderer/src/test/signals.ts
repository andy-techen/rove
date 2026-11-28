// Synthetic audio for tests: tones, sung-like notes, silence, and joining them up.

const RATE = 48000

const samples = (seconds: number, rate: number, at: (i: number) => number) =>
  Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => at(i))

export const silence = (seconds: number, rate = RATE) =>
  new Float32Array(Math.round(seconds * rate))

/** A pure sine. */
export const tone = (hz: number, seconds: number, amp = 0.3, rate = RATE) =>
  samples(seconds, rate, (i) => amp * Math.sin((2 * Math.PI * hz * i) / rate))

/** A sung-like tone: a fundamental with a few weaker harmonics. */
export const voice = (hz: number, seconds: number, rate = RATE) =>
  samples(seconds, rate, (i) => {
    const t = (2 * Math.PI * hz * i) / rate
    return 0.25 * Math.sin(t) + 0.12 * Math.sin(2 * t) + 0.06 * Math.sin(3 * t)
  })

export const join = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0)
  return out
}
