import { describe, expect, it } from 'vitest'
import { t } from '@shared/copy'
import type { VideoOptions } from '../../audio/export/videoFrame'
import { videoSummary } from './videoSummary'

const video = (change: Partial<VideoOptions> = {}): VideoOptions => ({
  background: { kind: 'blank', id: 'sunset' },
  texts: [],
  lyrics: false,
  ...change
})

describe('videoSummary', () => {
  it('names the background, with nothing more when lyrics are off', () => {
    expect(videoSummary(video())).toEqual({
      title: t('export.video.backgrounds.sunset'),
      detail: null
    })
  })

  it('says when lyrics show', () => {
    expect(videoSummary(video({ lyrics: true })).detail).toBe(t('export.video.summary.lyrics'))
  })

  it('calls the singer’s own colour or picture a custom background', () => {
    expect(videoSummary(video({ background: { kind: 'colour', colour: '#123456' } })).title).toBe(
      t('export.video.summary.custom')
    )
    const file = new File([''], 'me.jpg')
    expect(videoSummary(video({ background: { kind: 'picture', file } })).title).toBe(
      t('export.video.summary.custom')
    )
  })
})
