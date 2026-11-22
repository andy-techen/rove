export const METER_FLOOR_DB = -60

export type LevelZone = 'silent' | 'quiet' | 'good' | 'loud' | 'clip'

export const ZONE_HINTS: Record<LevelZone, string> = {
  silent: 'Sing a few lines to check your level.',
  quiet: 'A bit quiet. Move a little closer to the mic.',
  good: 'Sounds good. Keep it about here.',
  loud: 'Getting loud. Ease back from the mic a little.',
  clip: 'Too loud! Back off the mic or turn down its gain.'
}

export function toDb(peak: number): number {
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}

export function meterFill(db: number): number {
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB))
}

// Thresholds aim a beginner at peaks around -12 dBFS: enough signal to work with,
// with headroom for the loudest notes before the 16-bit capture clips.
export function levelZone(db: number): LevelZone {
  if (db >= -1) return 'clip'
  if (db >= -6) return 'loud'
  if (db >= -24) return 'good'
  if (db >= -45) return 'quiet'
  return 'silent'
}

// Peak-meter ballistics: rise instantly, fall slowly so the bar is readable.
export function nextDisplayDb(
  prevDb: number,
  peakDb: number,
  dtSec: number,
  fallDbPerSec = 24
): number {
  return Math.max(peakDb, prevDb - fallDbPerSec * dtSec, METER_FLOOR_DB)
}

// Requires a sustained stretch in the target range so a single cough or tap
// doesn't count as a level check. Frame gaps are capped because animation
// frames pause while the window is hidden.
export class LevelCheck {
  private inRangeSec = 0

  constructor(private requiredSec = 1.5) {}

  update(dtSec: number, db: number): boolean {
    if (levelZone(db) === 'good') this.inRangeSec += Math.min(dtSec, 0.5)
    return this.inRangeSec >= this.requiredSec
  }
}

// Hints follow the loudest moment of the last few seconds, so a breath between
// lines doesn't flip the advice to "too quiet" and a clip stays visible long
// enough to read.
export class RecentPeak {
  private samples: { t: number; db: number }[] = []

  constructor(private windowSec = 2.5) {}

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
