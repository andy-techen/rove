import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveTake } from './voiceTakes'

const root = path.resolve('/Music/Rove')
const manifest = {
  version: 2,
  tracks: [
    { role: 'backing', clips: [{ file: 'audio/backing-song.mp3', offset: 0, duration: 0 }] },
    {
      role: 'vocal',
      part: 'harmony',
      clips: [{ file: 'audio/take-002.wav', offset: 0, duration: 3 }]
    }
  ]
}
const read = vi.fn(async () => manifest)

describe('resolveTake', () => {
  it('resolves a take that one of the song’s vocal clips plays', async () => {
    await expect(resolveTake(root, 'Fly Away', 'audio/take-002.wav', read)).resolves.toBe(
      path.join(root, 'Fly Away', 'audio', 'take-002.wav')
    )
  })

  it.each(['..', '../Desktop', 'a/b', 'a\\b', '', 7])('refuses the folder %j', async (folder) => {
    await expect(resolveTake(root, folder, 'audio/take-002.wav', read)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })

  it('refuses the backing track', async () => {
    await expect(resolveTake(root, 'Fly Away', 'audio/backing-song.mp3', read)).rejects.toThrow()
  })

  it('refuses a file no clip plays, even one in the audio folder', async () => {
    await expect(resolveTake(root, 'Fly Away', 'audio/take-009.wav', read)).rejects.toThrow()
  })

  it('refuses a clip file that points outside the audio folder', async () => {
    const sneaky = { version: 2, tracks: [{ role: 'vocal', clips: [{ file: '../project.json' }] }] }
    await expect(
      resolveTake(root, 'Fly Away', '../project.json', async () => sneaky)
    ).rejects.toThrow()
  })
})
