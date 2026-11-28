import { describe, expect, it } from 'vitest'
import { clamp, dbToGain, gainToDb } from './units'

describe('clamp', () => {
  it('keeps a value inside its range', () => {
    expect(clamp(-2, -1, 1)).toBe(-1)
    expect(clamp(0.5, -1, 1)).toBe(0.5)
    expect(clamp(3, -1, 1)).toBe(1)
  })
})

describe('decibels', () => {
  it('maps full scale to 0 dB and half scale to about -6 dB, and back', () => {
    expect(gainToDb(1)).toBe(0)
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 2)
    expect(dbToGain(gainToDb(0.5))).toBeCloseTo(0.5, 12)
  })

  it('reads silence as minus infinity', () => {
    expect(gainToDb(0)).toBe(-Infinity)
  })
})
