import { t } from '@shared/copy'
import { MS_PER_SEC, SEC_PER_MIN } from '@shared/units'
import { DAY, HOUR, WEEK } from './constants'

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

/** When a song was last changed, in words for the last week: "Today", "3 days ago". */
export function relativeTime(modifiedAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - modifiedAt)
  if (diff < HOUR) return t('songbook.justNow')
  if (diff < DAY) return t('songbook.today')
  if (diff < 2 * DAY) return t('songbook.yesterday')
  if (diff < WEEK) return t('songbook.daysAgo', { days: Math.floor(diff / DAY) })
  return new Date(modifiedAt).toLocaleDateString()
}
