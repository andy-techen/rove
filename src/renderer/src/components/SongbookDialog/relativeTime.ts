import { t } from '@shared/copy'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** A short, human label like "today" or "3 days ago". */
export function relativeTime(modifiedAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - modifiedAt)
  if (diff < HOUR) return t('songbook.justNow')
  if (diff < DAY) return t('songbook.today')
  if (diff < 2 * DAY) return t('songbook.yesterday')
  if (diff < WEEK) return t('songbook.daysAgo', { days: Math.floor(diff / DAY) })
  return new Date(modifiedAt).toLocaleDateString()
}
