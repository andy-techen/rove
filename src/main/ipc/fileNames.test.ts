import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextTakeName, resolveAudioPath, uniqueName } from './fileNames'

describe('nextTakeName', () => {
  it('starts at take-001', () => {
    expect(nextTakeName([])).toBe('take-001.wav')
  })

  it('continues after the highest existing take, ignoring other files', () => {
    expect(nextTakeName(['take-001.wav', 'take-007.wav', 'backing-song.mp3', '.DS_Store'])).toBe(
      'take-008.wav'
    )
  })

  it('never reuses a number after a gap', () => {
    expect(nextTakeName(['take-003.wav'])).toBe('take-004.wav')
  })
})

describe('uniqueName', () => {
  it('keeps the name when it is free', () => {
    expect(uniqueName(['a.mp3'], 'b.mp3')).toBe('b.mp3')
  })

  it('adds a counter before the extension when the name is taken', () => {
    expect(uniqueName(['song.mp3', 'song-2.mp3'], 'song.mp3')).toBe('song-3.mp3')
  })
})

describe('resolveAudioPath', () => {
  const dir = path.resolve('/songs/my song')

  it('resolves files inside the audio folder', () => {
    expect(resolveAudioPath(dir, 'audio/take-001.wav')).toBe(
      path.join(dir, 'audio', 'take-001.wav')
    )
  })

  it.each(['audio/../project.json', '../other/audio/x.wav', '/etc/passwd', 'audio/sub/x.wav'])(
    'rejects %s',
    (rel) => {
      expect(() => resolveAudioPath(dir, rel)).toThrow()
    }
  )
})
