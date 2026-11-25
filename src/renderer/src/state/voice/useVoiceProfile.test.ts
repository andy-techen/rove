import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceCacheEntry } from '@shared/voice'
import { summariseInWorker } from '../../audio/voice'
import { sungEntry } from './testEntries'
import { useVoiceProfile } from './useVoiceProfile'

vi.mock('../../audio/voice', () => ({ summariseInWorker: vi.fn() }))

const cached = sungEntry('Cached', '2026-07-01')
const fresh = sungEntry('Fresh', '2026-08-01')
const cacheOf = ({ ref, summary }: typeof cached): VoiceCacheEntry => ({
  folder: ref.folder,
  file: ref.file,
  offsetSec: ref.offsetSec,
  durationSec: ref.durationSec,
  summary
})

const ready = async () => {
  const { result } = renderHook(() => useVoiceProfile())
  await waitFor(() => expect(result.current.status).toBe('ready'))
  return result.current
}

describe('useVoiceProfile', () => {
  beforeEach(() => {
    vi.mocked(summariseInWorker).mockResolvedValue(fresh.summary)
    vi.mocked(window.api.voice.listTakes).mockResolvedValue([cached.ref, fresh.ref])
    vi.mocked(window.api.voice.loadCache).mockResolvedValue([cacheOf(cached)])
  })

  it('listens only to clips it has not heard before', async () => {
    expect(await ready()).toEqual({ status: 'ready', entries: [cached, fresh] })
    expect(window.api.voice.readTake).toHaveBeenCalledTimes(1)
    expect(window.api.voice.readTake).toHaveBeenCalledWith('Fresh', fresh.ref.file)
  })

  it('saves the cache with only the clips that still exist', async () => {
    const gone = sungEntry('Deleted', '2026-06-01')
    vi.mocked(window.api.voice.loadCache).mockResolvedValue([cacheOf(cached), cacheOf(gone)])
    await ready()
    expect(window.api.voice.saveCache).toHaveBeenCalledWith([cacheOf(cached), cacheOf(fresh)])
  })

  it('leaves out a take it cannot read, keeping the rest', async () => {
    vi.mocked(window.api.voice.readTake).mockRejectedValue(new Error('gone'))
    expect(await ready()).toEqual({ status: 'ready', entries: [cached] })
  })
})
