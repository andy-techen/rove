import { gainToDb } from '../dsp/units'

export const METER_FLOOR_DB = -60

export type LevelZone = 'silent' | 'quiet' | 'good' | 'loud' | 'clip'

// Zone floors in dBFS. They aim a beginner at peaks around -12 dBFS: enough signal
// to work with, with headroom for the loudest notes before the 16-bit capture clips.
export const CLIP_DB = -1
export const LOUD_DB = -6
export const GOOD_DB = -24
export const QUIET_DB = -45

export const toDb = gainToDb

// Peak meter falls at this rate after a peak, so the bar is readable.
const FALL_DB_PER_SEC = 24
// Time singing in the green before the level counts as checked.
const LEVEL_CHECK_SEC = 1.5
// Longest frame gap counted toward that time (animation pauses in hidden windows).
const MAX_COUNTED_FRAME_SEC = 0.5
// How far back hints look for the loudest moment.
const HINT_WINDOW_SEC = 2.5

export function meterFill(db: number): number {
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB))
}

export function levelZone(db: number): LevelZone {
  if (db >= CLIP_DB) return 'clip'
  if (db >= LOUD_DB) return 'loud'
  if (db >= GOOD_DB) return 'good'
  if (db >= QUIET_DB) return 'quiet'
  return 'silent'
}

// Peak-meter ballistics: rise instantly, fall slowly so the bar is readable.
export function nextDisplayDb(
  prevDb: number,
  peakDb: number,
  dtSec: number,
  fallDbPerSec = FALL_DB_PER_SEC
): number {
  return Math.max(peakDb, prevDb - fallDbPerSec * dtSec, METER_FLOOR_DB)
}

// Requires a sustained stretch in the target range so a single cough or tap
// doesn't count as a level check. Frame gaps are capped because animation
// frames pause while the window is hidden.
export class LevelCheck {
  private inRangeSec = 0

  constructor(private requiredSec = LEVEL_CHECK_SEC) {}

  update(dtSec: number, db: number): boolean {
    if (levelZone(db) === 'good') this.inRangeSec += Math.min(dtSec, MAX_COUNTED_FRAME_SEC)
    return this.inRangeSec >= this.requiredSec
  }
}

// Hints follow the loudest moment of the last few seconds, so a breath between
// lines doesn't flip the advice to "too quiet" and a clip stays visible long
// enough to read.
export class RecentPeak {
  private samples: { t: number; db: number }[] = []

  constructor(private windowSec = HINT_WINDOW_SEC) {}

  push(tSec: number, db: number): number {
    this.samples.push({ t: tSec, db })
    while (this.samples.length && this.samples[0].t < tSec - this.windowSec) this.samples.shift()
    return this.max()
  }

  max(): number {
    let m = -Infinity
    for (const s of this.samples) m = Math.max(m, s.db)
    return m
  }
}
