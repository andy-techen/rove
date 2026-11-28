import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeAtomically } from './writeAtomically'

const scratch = () => mkdtemp(path.join(tmpdir(), 'rove-write-'))

describe('writeAtomically', () => {
  it('writes the file whole', async () => {
    const file = path.join(await scratch(), 'state.json')
    await writeAtomically(file, '{"a":1}')
    expect(await readFile(file, 'utf8')).toBe('{"a":1}')
  })

  it('survives two writes of the same file at once, leaving one whole and no temp files', async () => {
    const dir = await scratch()
    const file = path.join(dir, 'voice.json')
    await Promise.all([writeAtomically(file, '"first"'), writeAtomically(file, '"second"')])
    expect(['"first"', '"second"']).toContain(await readFile(file, 'utf8'))
    expect(await readdir(dir)).toEqual(['voice.json'])
  })

  it('writes bytes as they are', async () => {
    const file = path.join(await scratch(), 'song.wav')
    await writeAtomically(file, new Uint8Array([0, 1, 255]))
    expect([...(await readFile(file))]).toEqual([0, 1, 255])
  })
})
