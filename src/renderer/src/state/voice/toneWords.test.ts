import { describe, expect, it } from 'vitest'
import { t } from '@shared/copy'
import { toneHeadline, toneLeans } from './toneWords'

describe('toneLeans', () => {
  it('says which end each scale leans to, or balanced near the middle', () => {
    expect(toneLeans({ body: 0.8, brightness: 0.2, air: 0.55 })).toEqual({
      body: 'high',
      brightness: 'low',
      air: 'balanced'
    })
  })
})

describe('toneHeadline', () => {
  it('names only the scales that lean, in plain words', () => {
    expect(toneHeadline({ body: 'high', brightness: 'low', air: 'balanced' })).toBe(
      t('voice.toneHeadline.two', {
        first: t('voice.tone.body.high'),
        second: t('voice.tone.brightness.low').toLowerCase()
      })
    )
  })

  it('calls a voice that leans nowhere balanced', () => {
    expect(toneHeadline({ body: 'balanced', brightness: 'balanced', air: 'balanced' })).toBe(
      t('voice.tone.balanced')
    )
  })
})
