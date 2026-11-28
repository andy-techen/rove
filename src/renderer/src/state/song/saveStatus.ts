import { t } from '@shared/copy'
import { MIN_PER_HOUR, MS_PER_SEC, SEC_PER_MIN } from '@shared/units'
import { SaveState } from './useSong'
import { JUST_NOW_MS } from './constants'

const MIN = SEC_PER_MIN * MS_PER_SEC
const HOUR = MIN_PER_HOUR * MIN

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
