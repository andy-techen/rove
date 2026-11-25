import { describe, expect, it } from 'vitest'
import { t } from '@shared/copy'
import { singingTime } from './voiceText'

describe('singingTime', () => {
  it.each([
    [41.7, t('voice.seconds', { seconds: 41 })],
    [180, t('voice.minutes', { minutes: 3 })],
    [80, t('voice.minutesSeconds', { minutes: 1, seconds: 20 })]
  ])('says %s seconds as "%s"', (sec, text) => {
    expect(singingTime(sec)).toBe(text)
  })
})
