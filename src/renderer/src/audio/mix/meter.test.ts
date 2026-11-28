import { describe, expect, it } from 'vitest'
import {
  LevelCheck,
  METER_FLOOR_DB,
  RecentPeak,
  levelZone,
  meterFill,
  nextDisplayDb
} from './meter'

describe('meterFill', () => {
  it('spans the floor to 0 dB and clamps outside it', () => {
    expect(meterFill(-Infinity)).toBe(0)
    expect(meterFill(METER_FLOOR_DB)).toBe(0)
    expect(meterFill(METER_FLOOR_DB / 2)).toBe(0.5)
    expect(meterFill(0)).toBe(1)
    expect(meterFill(3)).toBe(1)
  })
})

describe('levelZone', () => {
  it.each([
    [-Infinity, 'silent'],
    [-50, 'silent'],
    [-45, 'quiet'],
    [-30, 'quiet'],
    [-24, 'good'],
    [-12, 'good'],
    [-6, 'loud'],
    [-1, 'clip'],
    [0, 'clip']
  ])('%d dB is %s', (db, zone) => {
    expect(levelZone(db)).toBe(zone)
  })
})

describe('nextDisplayDb', () => {
  it('jumps up to a louder peak immediately', () => {
    expect(nextDisplayDb(-40, -10, 1 / 60)).toBe(-10)
  })

  it('falls at the configured rate when the input drops', () => {
    expect(nextDisplayDb(-10, -50, 0.5, 24)).toBe(-22)
  })

  it('never falls below the meter floor, even on silence', () => {
    expect(nextDisplayDb(-58, -Infinity, 1)).toBe(METER_FLOOR_DB)
  })
})

describe('LevelCheck', () => {
  const frames = (check: LevelCheck, db: number, seconds: number): boolean => {
    let passed = false
    for (let t = 0; t < seconds; t += 1 / 60) passed = check.update(1 / 60, db)
    return passed
  }

  it('passes after enough time singing in the target range', () => {
    expect(frames(new LevelCheck(1.5), -12, 1.6)).toBe(true)
  })

  it('does not pass on a short burst', () => {
    expect(frames(new LevelCheck(1.5), -12, 0.5)).toBe(false)
  })

  it('adds up in-range time across phrases', () => {
    const check = new LevelCheck(1.5)
    frames(check, -12, 0.8)
    frames(check, -55, 1)
    expect(frames(check, -12, 0.8)).toBe(true)
  })

  it('does not count time spent too quiet or clipping', () => {
    const check = new LevelCheck(1.5)
    frames(check, -40, 2)
    expect(frames(check, 0, 2)).toBe(false)
  })

  it('caps a long frame gap so a hidden window cannot pass the check at once', () => {
    expect(new LevelCheck(1.5).update(5, -12)).toBe(false)
  })
})

describe('RecentPeak', () => {
  it('holds the loudest level within the window, ignoring quieter breaths', () => {
    const recent = new RecentPeak(2)
    recent.push(0, -3)
    expect(recent.push(1.5, -40)).toBe(-3)
  })

  it('lets old peaks expire once they leave the window', () => {
    const recent = new RecentPeak(2)
    recent.push(0, -3)
    recent.push(1, -20)
    expect(recent.push(2.5, -40)).toBe(-20)
    expect(recent.push(3.5, -40)).toBe(-40)
  })
})
