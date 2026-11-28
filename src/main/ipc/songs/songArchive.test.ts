import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { archiveEntryOk, archiveFilesOf, packSong, unpackSong } from './songArchive'
import { writeZip } from '../files/zip'

const scratch = () => mkdtemp(path.join(tmpdir(), 'rove-archive-'))

const clip = (file: string, extra = {}) => ({
  id: file,
  file,
  start: 0,
  offset: 0,
  duration: 1,
  ...extra
})
const manifest = (name: string, files: string[], extra = {}) => ({
  version: 2,
  name,
  sampleRate: 48000,
  tracks: [{ id: 't', role: 'vocal', clips: files.map((f) => clip(f, extra)) }]
})

async function song(root: string, folder: string, m: object, audio: Record<string, string>) {
  const dir = path.join(root, folder)
  await mkdir(path.join(dir, 'audio'), { recursive: true })
  await writeFile(path.join(dir, 'project.json'), JSON.stringify(m))
  for (const [name, text] of Object.entries(audio)) await writeFile(path.join(dir, name), text)
  return dir
}

async function archiveOf(entries: Record<string, string>) {
  const dir = await scratch()
  const list = []
  for (const [name, text] of Object.entries(entries)) {
    const source = path.join(dir, String(list.length))
    await writeFile(source, text)
    list.push({ name, source })
  }
  const archive = path.join(dir, 'song.rove')
  await writeZip(archive, list)
  return archive
}

describe('archiveEntryOk', () => {
  it('allows the project file and files directly in audio/', () => {
    expect(archiveEntryOk('project.json')).toBe(true)
    expect(archiveEntryOk('audio/take-001.wav')).toBe(true)
  })

  it.each([
    '../project.json',
    '/etc/passwd',
    'audio/../project.json',
    'audio/sub/take.wav',
    'audio\\take.wav',
    'audio/',
    'audio/..',
    'audio/.hidden.wav',
    'C:/take.wav',
    'notes.txt',
    'audio/take\0.wav'
  ])('refuses %j', (name) => {
    expect(archiveEntryOk(name)).toBe(false)
  })
})

describe('archiveFilesOf', () => {
  it('lists every file the clips play and the songs kept behind instrumentals, once each', () => {
    const m = manifest('Song', ['audio/take-001.wav', 'audio/take-001.wav'])
    m.tracks.push({
      id: 'b',
      role: 'backing',
      clips: [clip('audio/song (no vocals).wav', { withVocals: 'audio/backing-song.mp3' })]
    })
    expect(archiveFilesOf(m)).toEqual([
      'audio/take-001.wav',
      'audio/song (no vocals).wav',
      'audio/backing-song.mp3'
    ])
  })

  it('leaves out paths that reach outside the audio folder', () => {
    expect(archiveFilesOf(manifest('Song', ['../secret.wav', 'audio/ok.wav']))).toEqual([
      'audio/ok.wav'
    ])
  })

  it('is empty for something that is not a project', () => {
    expect(archiveFilesOf(null)).toEqual([])
    expect(archiveFilesOf({ tracks: 'no' })).toEqual([])
  })
})

describe('packSong and unpackSong', () => {
  it('moves a song to another songs folder whole', async () => {
    const from = await scratch()
    const m = manifest('My Song', ['audio/take-001.wav'])
    const dir = await song(from, 'My Song', m, { 'audio/take-001.wav': 'voice' })
    const archive = path.join(await scratch(), 'My Song.rove')
    await packSong(dir, archive)

    const to = await scratch()
    const opened = await unpackSong(archive, to)
    expect(opened).toBe(path.join(to, 'My Song'))
    expect(JSON.parse(await readFile(path.join(opened, 'project.json'), 'utf8'))).toEqual(m)
    expect(await readFile(path.join(opened, 'audio/take-001.wav'), 'utf8')).toBe('voice')
  })

  it('leaves out files the song no longer plays', async () => {
    const dir = await song(await scratch(), 'S', manifest('S', ['audio/take-002.wav']), {
      'audio/take-001.wav': 'old',
      'audio/take-002.wav': 'new'
    })
    const archive = path.join(await scratch(), 'S.rove')
    await packSong(dir, archive)
    const opened = await unpackSong(archive, await scratch())
    expect(await readdir(path.join(opened, 'audio'))).toEqual(['take-002.wav'])
  })

  it('never replaces a song that is already there', async () => {
    const root = await scratch()
    await song(root, 'Song', manifest('Song', []), {})
    const archive = await archiveOf({ 'project.json': JSON.stringify(manifest('Song', [])) })
    const opened = await unpackSong(archive, root)
    expect(opened).toBe(path.join(root, 'Song 2'))
    expect((await readdir(root)).sort()).toEqual(['Song', 'Song 2'])
  })

  it('skips files in the archive the project does not play', async () => {
    const archive = await archiveOf({
      'project.json': JSON.stringify(manifest('S', ['audio/a.wav'])),
      'audio/a.wav': 'a',
      'audio/extra.wav': 'extra'
    })
    const opened = await unpackSong(archive, await scratch())
    expect(await readdir(path.join(opened, 'audio'))).toEqual(['a.wav'])
  })

  it.each(['../escape.wav', '/tmp/escape.wav', 'audio/../../escape.wav'])(
    'refuses an archive holding %j, creating nothing',
    async (name) => {
      const archive = await archiveOf({
        'project.json': JSON.stringify(manifest('S', [])),
        [name]: 'bad'
      })
      const root = await scratch()
      await expect(unpackSong(archive, root)).rejects.toThrow()
      expect(await readdir(root)).toEqual([])
    }
  )

  it('refuses an archive without a project', async () => {
    const root = await scratch()
    await expect(unpackSong(await archiveOf({ 'audio/a.wav': 'a' }), root)).rejects.toThrow()
    expect(await readdir(root)).toEqual([])
  })

  it('refuses a project file that is not a song', async () => {
    const root = await scratch()
    const archive = await archiveOf({ 'project.json': '{"hello": true}' })
    await expect(unpackSong(archive, root)).rejects.toThrow()
    expect(await readdir(root)).toEqual([])
  })
})
