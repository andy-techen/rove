import { describe, expect, it } from 'vitest'
import { analysePitch, hzToMidi } from '../pitch/pitch'
import { changeSpeedAndPitch, detectBeat } from './stretch'
import { seededNoise } from '../dsp/noise'
import { median } from '../dsp/stats'
import { tone } from '../../test/signals'

const SR = 48000
// Beat detection downsamples to about this rate anyway, so click tracks needn't be finer.
const CLICK_SR = 12000

/** A decaying burst of noise at `at`: one click. */
function click(out: Float32Array, at: number, noise: () => number): void {
  for (let i = 0; i < CLICK_SR * 0.03 && at + i < out.length; i++) {
    out[at + i] = noise() * 0.5 * Math.exp(-i / (CLICK_SR * 0.006))
  }
}

/** A click track: a click on every beat. */
function clicks(bpm: number, seconds: number, startSec = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * CLICK_SR))
  const beat = (60 / bpm) * CLICK_SR
  const noise = seededNoise(1)
  for (let b = 0; startSec * CLICK_SR + b * beat < out.length; b++) {
    click(out, Math.round(startSec * CLICK_SR + b * beat), noise)
  }
  return out
}

/** The median sung pitch of the middle of a signal, as a MIDI note. */
async function pitchOf(samples: Float32Array): Promise<number> {
  const { f0 } = await analysePitch(samples, SR)
  const middle = Array.from(f0.subarray(f0.length / 4, (f0.length * 3) / 4)).filter((f) => f > 0)
  return hzToMidi(median(middle))
}

/** A click track that speeds up steadily, and the true time of each click. */
function speedingClicks(fromBpm: number, toBpm: number, seconds: number) {
  const out = new Float32Array(Math.round(seconds * CLICK_SR))
  const times: number[] = []
  const noise = seededNoise(1)
  for (let t = 0.2; t < seconds - 0.05;) {
    times.push(t)
    click(out, Math.round(t * CLICK_SR), noise)
    const bpm = fromBpm + ((toBpm - fromBpm) * t) / seconds
    t += 60 / bpm
  }
  return { audio: out, times }
}

describe('detectBeat', () => {
  it.each([96, 140])('hears %i BPM in a click track', async (bpm) => {
    const found = (await detectBeat({ channels: [clicks(bpm, 20)], sampleRate: CLICK_SR }))?.bpm
    expect(found).toBeDefined()
    expect(Math.abs(found! - bpm)).toBeLessThan(1)
  })

  it('hears 120 BPM, and where the beats fall', async () => {
    const beat = await detectBeat({ channels: [clicks(120, 20, 0.23)], sampleRate: CLICK_SR })
    expect(Math.abs(beat!.bpm - 120)).toBeLessThan(1)
    // Beats every 0.5 s from 0.23 s: the first one heard is at 0.23 s (give or take a frame).
    expect(Math.abs((beat!.firstBeatSec % 0.5) - 0.23)).toBeLessThan(0.02)
  })

  it('hears no tempo in silence', async () => {
    const silent = new Float32Array(CLICK_SR * 5)
    expect(await detectBeat({ channels: [silent], sampleRate: CLICK_SR })).toBeNull()
  })
})

describe('changeSpeedAndPitch', () => {
  it('plays faster at the same pitch', async () => {
    const [faster] = await changeSpeedAndPitch([tone(220, 2)], SR, 1.25, 0)
    expect(faster.length).toBeCloseTo((2 * SR) / 1.25, -2)
    expect(await pitchOf(faster)).toBeCloseTo(hzToMidi(220), 1)
  })

  it('plays slower at the same pitch', async () => {
    const [slower] = await changeSpeedAndPitch([tone(220, 2)], SR, 0.8, 0)
    expect(slower.length).toBeCloseTo((2 * SR) / 0.8, -2)
    expect(await pitchOf(slower)).toBeCloseTo(hzToMidi(220), 1)
  })

  it('moves the key without changing the length', async () => {
    const [higher] = await changeSpeedAndPitch([tone(220, 2)], SR, 1, 2)
    expect(higher.length).toBeCloseTo(2 * SR, -2)
    expect(await pitchOf(higher)).toBeCloseTo(hzToMidi(220) + 2, 1)
  })

  it('changes every channel alike', async () => {
    const out = await changeSpeedAndPitch([tone(220, 1), tone(330, 1)], SR, 1.1, -1)
    expect(out).toHaveLength(2)
    expect(out[0].length).toBe(out[1].length)
  })
})

describe('beat tracking', () => {
  it('stays on the beat when the tempo drifts, where a steady grid would not', async () => {
    const { audio, times } = speedingClicks(100, 112, 15)
    const beat = await detectBeat({ channels: [audio], sampleRate: CLICK_SR })
    const nearest = (t: number): number => Math.min(...beat!.times.map((b) => Math.abs(b - t)))
    // Every real click from the second bar on has a tracked beat within 30 ms.
    const misses = times.slice(4).filter((t) => nearest(t) > 0.03)
    expect(misses).toEqual([])
  })
})
