import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonStore } from './jsonStore'

let userData = ''
vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const parseCount = (raw: unknown): number =>
  typeof raw === 'object' && raw !== null && typeof (raw as { n?: unknown }).n === 'number'
    ? (raw as { n: number }).n
    : 0

const store = () => jsonStore('count.json', (raw) => ({ n: parseCount(raw) }), { n: -1 })

describe('jsonStore', () => {
  beforeEach(async () => {
    userData = await mkdtemp(path.join(tmpdir(), 'rove-store-'))
  })

  it('loads the fallback when there is no file yet', async () => {
    expect(await store().load()).toEqual({ n: -1 })
  })

  it('loads the fallback when the file is not JSON', async () => {
    await writeFile(path.join(userData, 'count.json'), '{ not json')
    expect(await store().load()).toEqual({ n: -1 })
  })

  it('reads back what it saved, through parse', async () => {
    await store().save({ n: 3 })
    expect(await store().load()).toEqual({ n: 3 })
  })

  it('cleans what it reads with parse', async () => {
    await writeFile(path.join(userData, 'count.json'), '{"n":"three"}')
    expect(await store().load()).toEqual({ n: 0 })
  })
})
