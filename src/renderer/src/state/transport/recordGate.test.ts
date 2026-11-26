import { describe, expect, it } from 'vitest'
import { canChangeLyrics, canStartRecording } from './recordGate'

const ready = {
  mode: 'idle' as const,
  hasMusic: true,
  recorderReady: true,
  hasPendingTake: false,
  busy: false,
  waiting: false
}

describe('canStartRecording', () => {
  it('lets a take start from a stop or while the song plays', () => {
    expect(canStartRecording(ready)).toBe(true)
    expect(canStartRecording({ ...ready, mode: 'playing' })).toBe(true)
  })

  it('waits while a take is recording or saving', () => {
    expect(canStartRecording({ ...ready, mode: 'recording' })).toBe(false)
    expect(canStartRecording({ ...ready, mode: 'saving' })).toBe(false)
  })

  it('waits for the mic, the music and an unsaved take', () => {
    expect(canStartRecording({ ...ready, recorderReady: false })).toBe(false)
    expect(canStartRecording({ ...ready, hasMusic: false })).toBe(false)
    expect(canStartRecording({ ...ready, hasPendingTake: true })).toBe(false)
  })
})

describe('canChangeLyrics', () => {
  it('lets the singer pick lyrics while recording, to read along', () => {
    expect(canChangeLyrics('recording', false)).toBe(true)
  })

  it('waits while a take is being saved, so the change is not lost under it', () => {
    expect(canChangeLyrics('saving', false)).toBe(false)
    expect(canChangeLyrics('idle', true)).toBe(false)
  })
})
