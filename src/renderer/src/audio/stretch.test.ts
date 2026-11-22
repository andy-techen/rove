import { describe, expect, it } from 'vitest'
import { analysePitch, hzToMidi } from './pitch'
import { changeSpeedAndPitch, detectBeat, detectTempo } from './stretch'

const SR = 48000

const tone = (hz: number, seconds: number): Float32Array =>
  Float32Array.from(
    { length: Math.round(seconds * SR) },
    (_, i) => 0.3 * Math.sin((2 * Math.PI * hz * i) / SR)
  )

/** A click track: a short burst of decaying noise on every beat. */
function clicks(bpm: number, seconds: number, startSec = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR))
  const beat = (60 / bpm) * SR
  let seed = 1
  for (let b = 0; startSec * SR + b * beat < out.length; b++) {
    const at = Math.round(startSec * SR + b * beat)
    for (let i = 0; i < SR * 0.03 && at + i < out.length; i++) {
      seed = (seed * 16807) % 2147483647
      out[at + i] = ((seed / 2147483647) * 2 - 1) * 0.5 * Math.exp(-i / (SR * 0.006))
    }
  }
  return out
}

/** The median sung pitch of the middle of a signal, as a MIDI note. */
async function pitchOf(samples: Float32Array): Promise<number> {
  const { f0 } = await analysePitch(samples, SR)
  const middle = Array.from(f0.subarray(f0.length / 4, (f0.length * 3) / 4)).filter((f) => f > 0)
  return hzToMidi(middle.sort((a, b) => a - b)[middle.length >> 1])
}

/** A click track that speeds up steadily, and the true time of each click. */
function speedingClicks(fromBpm: number, toBpm: number, seconds: number) {
  const out = new Float32Array(Math.round(seconds * SR))
  const times: number[] = []
  let seed = 1
  for (let t = 0.2; t < seconds - 0.05;) {
    times.push(t)
    const at = Math.round(t * SR)
    for (let i = 0; i < SR * 0.03 && at + i < out.length; i++) {
      seed = (seed * 16807) % 2147483647
      out[at + i] = ((seed / 2147483647) * 2 - 1) * 0.5 * Math.exp(-i / (SR * 0.006))
    }
    const bpm = fromBpm + ((toBpm - fromBpm) * t) / seconds
    t += 60 / bpm
  }
  return { audio: out, times }
}

describe('detectTempo', () => {
  it.each([96, 120, 140])('hears %i BPM in a click track', async (bpm) => {
    const found = await detectTempo({ channels: [clicks(bpm, 20)], sampleRate: SR })
    expect(found).not.toBeNull()
    expect(Math.abs(found! - bpm)).toBeLessThan(1)
  })

  it('finds where the beats fall, not just how fast they come', async () => {
    const beat = await detectBeat({ channels: [clicks(120, 20, 0.23)], sampleRate: SR })
    // Beats every 0.5 s from 0.23 s: the first one heard is at 0.23 s (give or take a frame).
    expect(beat!.firstBeatSec % 0.5).toBeCloseTo(0.23, 1)
    expect(Math.abs((beat!.firstBeatSec % 0.5) - 0.23)).toBeLessThan(0.02)
  })

  it('hears no tempo in silence', async () => {
    expect(await detectTempo({ channels: [new Float32Array(SR * 5)], sampleRate: SR })).toBeNull()
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
    const { audio, times } = speedingClicks(100, 112, 30)
    const beat = await detectBeat({ channels: [audio], sampleRate: SR })
    const nearest = (t: number): number => Math.min(...beat!.times.map((b) => Math.abs(b - t)))
    // Every real click from the second bar on has a tracked beat within 30 ms.
    const misses = times.slice(4).filter((t) => nearest(t) > 0.03)
    expect(misses).toEqual([])
  })
})
