import { INPUT_VOLUME_MAX } from '@shared/preferences/constants'
import { CLIP_DB, QUIET_DB } from '../mix/constants'
import { clamp } from '../dsp/units'
import {
  TARGET_PEAK_DB,
  STEPS_PER_DB,
  MAX_STEPS,
  CLIPPED_DROP_DB,
  CLOSE_ENOUGH_DB,
  MIN_VOLUME
} from './constants'

/**
 * The Mac input volume that puts the singer's loudest peak at the target, from the
 * volume now and the loudest peak heard. Null when nothing was heard: there's nothing
 * to aim from.
 */
export function nextInputVolume(current: number, loudestDb: number): number | null {
  if (!(loudestDb >= QUIET_DB)) return null
  const shortDb = loudestDb >= CLIP_DB ? -CLIPPED_DROP_DB : TARGET_PEAK_DB - loudestDb
  if (Math.abs(shortDb) < CLOSE_ENOUGH_DB) return current
  const steps = clamp(Math.round(shortDb * STEPS_PER_DB), -MAX_STEPS, MAX_STEPS)
  return clamp(current + steps, MIN_VOLUME, INPUT_VOLUME_MAX)
}
