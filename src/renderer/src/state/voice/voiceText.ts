import { t } from '@shared/copy'
import { MIN_PER_HOUR, SEC_PER_MIN } from '@shared/units'

/**
 * "41 s", "3 min", "1 min 20 s", "1 h 5 min": a length of singing or recording, rounded
 * down to the second, or to the minute once it passes an hour.
 */
export function singingTime(sec: number): string {
  const whole = Math.floor(sec)
  const minutes = Math.floor(whole / SEC_PER_MIN)
  const seconds = whole % SEC_PER_MIN
  if (minutes >= MIN_PER_HOUR) {
    return t('voice.hoursMinutes', {
      hours: Math.floor(minutes / MIN_PER_HOUR),
      minutes: minutes % MIN_PER_HOUR
    })
  }
  if (minutes === 0) return t('voice.seconds', { seconds })
  if (seconds === 0) return t('voice.minutes', { minutes })
  return t('voice.minutesSeconds', { minutes, seconds })
}

/** "Aug", or "Jan 2027" when the year needs saying: the first month shown, and each January. */
export function monthLabel(year: number, month: number, first: boolean): string {
  const withYear = first || month === 0
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    ...(withYear && { year: 'numeric' })
  }).format(new Date(year, month, 1))
}
