import { describe, expect, it } from 'vitest'
import { concatSamples, encodeWav } from './wav'

const ascii = (view: DataView, offset: number, length: number): string =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)))

describe('encodeWav', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2])
  const view = new DataView(encodeWav([samples], 48000))

  it('writes a 16-bit mono PCM header for the given sample rate', () => {
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(28, true)).toBe(96000)
    expect(view.getUint16(34, true)).toBe(16)
  })

  it('sizes the RIFF and data chunks from the sample count', () => {
    expect(view.byteLength).toBe(44 + samples.length * 2)
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
  })

  it('converts samples to 16-bit integers and clamps out-of-range values', () => {
    const pcm = Array.from({ length: samples.length }, (_, i) => view.getInt16(44 + i * 2, true))
    expect(pcm).toEqual([0, 16383, -16384, 32767, -32768, 32767, -32768])
  })
})

describe('encodeWav for export', () => {
  it('interleaves stereo 24-bit samples', () => {
    const view = new DataView(
      encodeWav([new Float32Array([1, 0]), new Float32Array([-1, 0.5])], 48000, 24)
    )
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint16(32, true)).toBe(6)
    expect(view.getUint16(34, true)).toBe(24)
    const sample = (i: number) =>
      (view.getInt8(44 + i * 3 + 2) << 16) | view.getUint16(44 + i * 3, true)
    expect([0, 1, 2, 3].map(sample)).toEqual([0x7fffff, -0x800000, 0, 0x3fffff])
  })
})

describe('concatSamples', () => {
  it('joins chunks in order', () => {
    const out = concatSamples([
      new Float32Array([1, 2]),
      new Float32Array([]),
      new Float32Array([3])
    ])
    expect(Array.from(out)).toEqual([1, 2, 3])
  })
})
