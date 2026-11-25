import { describe, expect, it } from 'vitest'
import { encodeWav } from '../encode/wav'
import { readWav } from './readWav'

const bytesOf = (buffer: ArrayBuffer): Uint8Array => new Uint8Array(buffer)

describe('readWav', () => {
  it("reads back a take's samples and rate", () => {
    const take = Float32Array.from([0, 0.5, -0.5, 0.25, -1])
    const { samples, sampleRate } = readWav(bytesOf(encodeWav([take], 48000)))
    expect(sampleRate).toBe(48000)
    expect(Array.from(samples).map((s) => +s.toFixed(3))).toEqual([0, 0.5, -0.5, 0.25, -1])
  })

  it('finds the audio past chunks it does not know', () => {
    const plain = bytesOf(encodeWav([Float32Array.from([0.5, -0.5])], 44100))
    const extra = new Uint8Array([...'LIST'].map((c) => c.charCodeAt(0)).concat([2, 0, 0, 0, 9, 9]))
    const withList = new Uint8Array([...plain.subarray(0, 36), ...extra, ...plain.subarray(36)])
    const [first, second] = readWav(withList).samples
    expect([first.toFixed(3), second]).toEqual(['0.500', -0.5])
  })

  it('mixes stereo to mono', () => {
    const wav = encodeWav([Float32Array.from([0.5]), Float32Array.from([-0.5])], 48000)
    expect(readWav(bytesOf(wav)).samples[0]).toBeCloseTo(0, 4)
  })

  it('rejects a file that is not a WAV', () => {
    expect(() => readWav(new TextEncoder().encode('ID3 an mp3, honest'))).toThrow()
  })

  it('rejects 24-bit audio', () => {
    expect(() => readWav(bytesOf(encodeWav([Float32Array.from([0])], 48000, 24)))).toThrow()
  })
})
