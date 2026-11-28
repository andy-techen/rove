import {
  METER_FLOOR_DB,
  CLIP_DB,
  LOUD_DB,
  GOOD_DB,
  QUIET_DB,
  FALL_DB_PER_SEC,
  LEVEL_CHECK_SEC,
  MAX_COUNTED_FRAME_SEC,
  HINT_WINDOW_SEC
} from './constants'

export type LevelZone = 'silent' | 'quiet' | 'good' | 'loud' | 'clip'

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
