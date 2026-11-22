import { t } from '@shared/copy'
import { SaveState } from './useSong'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
// Within this long, "just now" reads better than a count of seconds.
const JUST_NOW_MS = 10 * SEC

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** The short line shown in the top bar, e.g. "Saved 3 min ago". */
export function saveLabel(state: SaveState, now: number): string {
  if (state.status === 'saving') return t('save.saving')
  if (state.status === 'failed') return t('save.failed')
  const ago = now - state.at
  if (ago < JUST_NOW_MS) return t('save.justNow')
  if (ago < MIN) return t('save.seconds')
  if (ago < HOUR) return t('save.minutes', { minutes: Math.floor(ago / MIN) })
  return t('save.at', { time: clock.format(state.at) })
}

/** The hover text: the exact time of the last save. */
export function saveDetail(state: SaveState): string {
  if (state.status === 'saved') return t('save.detail', { time: clock.format(state.at) })
  return state.status === 'saving' ? t('save.detailSaving') : t('save.detailFailed')
}
