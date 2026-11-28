import { SEC_PER_MIN } from '@shared/units'
import {
  ALMOST_DONE_SEC,
  TIME_LEFT_MIN_ELAPSED_SEC,
  TIME_LEFT_MIN_PROGRESS,
  TIME_LEFT_STEP_SEC
} from './constants'

export type TimeLeft = { kind: 'soon' } | { kind: 'sec' | 'min'; count: number }

/** How long a job that's `progress` of the way through after `elapsedSec` has left. */
export function timeLeft(progress: number, elapsedSec: number): TimeLeft | null {
  if (progress < TIME_LEFT_MIN_PROGRESS || elapsedSec < TIME_LEFT_MIN_ELAPSED_SEC) return null
  const sec = (elapsedSec / progress) * (1 - progress)
  if (sec < ALMOST_DONE_SEC) return { kind: 'soon' }
  if (sec < SEC_PER_MIN) {
    return { kind: 'sec', count: Math.ceil(sec / TIME_LEFT_STEP_SEC) * TIME_LEFT_STEP_SEC }
  }
  return { kind: 'min', count: Math.ceil(sec / SEC_PER_MIN) }
}
