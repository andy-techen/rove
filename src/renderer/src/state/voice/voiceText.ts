import { t } from '@shared/copy'

const SEC_PER_MIN = 60

/** "41 s", "3 min", "1 min 20 s": how long someone has sung, rounded to the second. */
export function singingTime(sec: number): string {
  const whole = Math.floor(sec)
  const minutes = Math.floor(whole / SEC_PER_MIN)
  const seconds = whole % SEC_PER_MIN
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
