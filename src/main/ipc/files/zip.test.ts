import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readZip, writeZip } from './zip'

const scratch = () => mkdtemp(path.join(tmpdir(), 'rove-zip-'))

async function zipOf(files: Record<string, string>) {
  const dir = await scratch()
  const entries = []
  for (const [name, text] of Object.entries(files)) {
    const source = path.join(dir, name.replace(/\//g, '_'))
    await writeFile(source, text)
    entries.push({ name, source })
  }
  const archive = path.join(dir, 'song.rove')
  await writeZip(archive, entries)
  return archive
}

describe('zip', () => {
  it('reads back what it wrote, by name', async () => {
    const zip = await readZip(await zipOf({ 'project.json': '{}', 'audio/take-001.wav': 'RIFF' }))
    expect(zip.entries.map((e) => e.name)).toEqual(['project.json', 'audio/take-001.wav'])
    expect((await zip.read(zip.entries[1])).toString()).toBe('RIFF')
    await zip.close()
  })

  it('keeps names with accents and spaces', async () => {
    const zip = await readZip(await zipOf({ 'audio/backing-Café del Mar.mp3': 'x' }))
    expect(zip.entries[0].name).toBe('audio/backing-Café del Mar.mp3')
    await zip.close()
  })

  it('leaves no partial file beside the archive', async () => {
    const archive = await zipOf({ 'project.json': '{}' })
    expect((await readdir(path.dirname(archive))).filter((n) => n.includes('song'))).toEqual([
      'song.rove'
    ])
  })

  it('refuses a file that is not a zip', async () => {
    const file = path.join(await scratch(), 'not.rove')
    await writeFile(file, 'hello, this is not a zip file at all')
    await expect(readZip(file)).rejects.toThrow()
  })

  it('notices a damaged entry', async () => {
    const archive = await zipOf({ 'project.json': '{"name":"Song"}' })
    const bytes = await readFile(archive)
    bytes[bytes.indexOf('Song')] = 'X'.charCodeAt(0)
    await writeFile(archive, bytes)
    const zip = await readZip(archive)
    await expect(zip.read(zip.entries[0])).rejects.toThrow()
    await zip.close()
  })
})
