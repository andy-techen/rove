import { beforeAll, describe, expect, it } from 'vitest'

interface Processor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>
  ): boolean
}

const g = globalThis as unknown as Record<string, unknown>
let GateClass: new () => Processor
const SR = 48000

beforeAll(async () => {
  g.sampleRate = SR
  g.AudioWorkletProcessor = class {}
  g.registerProcessor = (_name: string, cls: new () => Processor) => {
    GateClass = cls
  }
  await import('./gate-worklet')
})

/** Runs a signal through the gate in 128-frame blocks and returns the output. */
function run(signal: Float32Array, threshold = -40, range = -25): Float32Array {
  const gate = new GateClass()
  const out = new Float32Array(signal.length)
  const params = { threshold: new Float32Array([threshold]), range: new Float32Array([range]) }
  for (let i = 0; i < signal.length; i += 128) {
    const input = signal.subarray(i, i + 128)
    const output = new Float32Array(input.length)
    gate.process([[input]], [[output]], params)
    out.set(output, i)
  }
  return out
}

const rms = (x: Float32Array, from: number, to: number): number => {
  let sum = 0
  for (let i = from; i < to; i++) sum += x[i] * x[i]
  return Math.sqrt(sum / (to - from))
}

const tone = (amp: number, seconds: number): Float32Array =>
  Float32Array.from(
    { length: seconds * SR },
    (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / SR)
  )

describe('gate worklet', () => {
  it('lets singing through untouched', () => {
    const singing = tone(0.3, 0.5)
    const out = run(singing)
    expect(rms(out, SR * 0.2, SR * 0.5) / rms(singing, SR * 0.2, SR * 0.5)).toBeCloseTo(1, 2)
  })

  it('turns quiet room noise down by the range, not to silence', () => {
    const noise = tone(0.002, 1)
    const out = run(noise, -40, -25)
    const reduction = 20 * Math.log10(rms(out, SR * 0.6, SR) / rms(noise, SR * 0.6, SR))
    expect(reduction).toBeCloseTo(-25, 0)
  })

  it('holds open briefly after a phrase so word endings are not clipped', () => {
    const signal = new Float32Array(SR)
    signal.set(tone(0.3, 0.5))
    signal.set(tone(0.002, 0.5), SR * 0.5)
    const out = run(signal)
    // 20 ms after the phrase ends, the tail is still close to full level.
    const at = SR * 0.52
    expect(Math.abs(out[at]) / Math.max(1e-9, Math.abs(signal[at]))).toBeGreaterThan(0.8)
  })
})
