import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  instrumentalName,
  nextTakeName,
  nextUntitledName,
  resolveAudioPath,
  songbookFolder,
  songFolderName,
  uniqueFolderName,
  uniqueName
} from './fileNames'

describe('nextTakeName', () => {
  it('starts at take-001 and continues after the highest existing take, ignoring other files', () => {
    expect(nextTakeName([])).toBe('take-001.wav')
    expect(nextTakeName(['take-001.wav', 'take-007.wav', 'backing-song.mp3', '.DS_Store'])).toBe(
      'take-008.wav'
    )
  })

  it('never reuses a number after a gap', () => {
    expect(nextTakeName(['take-003.wav'])).toBe('take-004.wav')
  })
})

describe('nextUntitledName', () => {
  it('uses "Untitled Song" when free', () => {
    expect(nextUntitledName(['My Song'])).toBe('Untitled Song')
  })

  it('numbers later untitled songs, filling the first free number', () => {
    expect(nextUntitledName(['Untitled Song', 'Untitled Song 2', 'Untitled Song 4'])).toBe(
      'Untitled Song 3'
    )
  })
})

describe('uniqueFolderName', () => {
  it('treats names differing only in case as taken, like the macOS file system', () => {
    expect(uniqueFolderName(['my song'], 'My Song')).toBe('My Song 2')
  })
})

describe('songFolderName', () => {
  it.each([
    ['Summer Demo', 'Summer Demo'],
    ['  AC/DC: Cover  ', 'AC-DC- Cover'],
    ['..hidden', 'hidden'],
    ['a\\b', 'a-b'],
    ['   ', ''],
    ['x'.repeat(150), 'x'.repeat(100)]
  ])('%j becomes %j', (input, expected) => {
    expect(songFolderName(input)).toBe(expected)
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

describe('instrumentalName', () => {
  it('names the instrumental after the song it came from', () => {
    expect(instrumentalName([], 'audio/My Song.mp3')).toBe('My Song (no vocals).wav')
  })

  it('never reuses a name already in the audio folder', () => {
    expect(instrumentalName(['My Song (no vocals).wav'], 'audio/My Song.mp3')).toBe(
      'My Song (no vocals)-2.wav'
    )
  })
})

describe('songbookFolder', () => {
  it('accepts a folder name directly inside the songs folder', () => {
    expect(songbookFolder('/Music/Rove', 'Fly Away')).toBe('/Music/Rove/Fly Away')
  })

  it('refuses anything that could reach outside it', () => {
    for (const bad of ['', '.', '..', '../Desktop', 'a/b', 'a\\b', 3, null]) {
      expect(songbookFolder('/Music/Rove', bad)).toBeNull()
    }
  })
})
