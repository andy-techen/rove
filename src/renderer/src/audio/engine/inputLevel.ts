import { INPUT_VOLUME_MAX } from '@shared/inputVolume'
import { CLIP_DB, QUIET_DB } from '../mix/meter'

// The loudest part of a song should peak here: in the meter's green, below "getting
// loud", with room for an even bigger note on the night.
export const TARGET_PEAK_DB = -10
// Mac inputs move roughly half a dB per step of the input volume. It's only roughly,
// so a second try lands closer; never more than this many steps at once.
const STEPS_PER_DB = 2
const MAX_STEPS = 40
// A clipped peak hides how loud the voice really was, so back off by at least this.
const CLIPPED_DROP_DB = 12
// Within this of the target, leave the level alone.
const CLOSE_ENOUGH_DB = 2
// Never turn the mic all the way off.
const MIN_VOLUME = 5

/**
 * The Mac input volume that puts the singer's loudest peak at the target, from the
 * volume now and the loudest peak heard. Null when nothing was heard: there's nothing
 * to aim from.
 */
export function nextInputVolume(current: number, loudestDb: number): number | null {
  if (!(loudestDb >= QUIET_DB)) return null
  const shortDb = loudestDb >= CLIP_DB ? -CLIPPED_DROP_DB : TARGET_PEAK_DB - loudestDb
  if (Math.abs(shortDb) < CLOSE_ENOUGH_DB) return current
  const steps = Math.max(-MAX_STEPS, Math.min(MAX_STEPS, Math.round(shortDb * STEPS_PER_DB)))
  return Math.max(MIN_VOLUME, Math.min(INPUT_VOLUME_MAX, current + steps))
}
