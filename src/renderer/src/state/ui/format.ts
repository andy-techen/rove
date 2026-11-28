import { MS_PER_SEC, SEC_PER_MIN } from '@shared/units'

/** A length of time as minutes and seconds: "1:05". */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / SEC_PER_MIN)}:${String(whole % SEC_PER_MIN).padStart(2, '0')}`
}

/** The transport timer: minutes always two digits, so the readout doesn't shift as it plays. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = String(Math.floor(whole / SEC_PER_MIN)).padStart(2, '0')
  return `${minutes}:${String(whole % SEC_PER_MIN).padStart(2, '0')}`
}

/** The milliseconds after the timer's seconds: ".345". */
export function formatMillis(seconds: number): string {
  // Rounded to a microsecond first, so 0.07 doesn't come out as .069.
  const ms = Math.floor(Math.round(Math.max(0, seconds) * MS_PER_SEC * MS_PER_SEC) / MS_PER_SEC)
  return `.${String(ms % MS_PER_SEC).padStart(3, '0')}`
}
