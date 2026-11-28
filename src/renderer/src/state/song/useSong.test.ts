import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeApi } from '../../test/fakeApi'
import { createProject, withTrackChanges } from './project'
import { useSong } from './useSong'

const SAVE_WAIT_MS = 1000

let api: ReturnType<typeof createFakeApi>
beforeEach(() => {
  api = createFakeApi()
  window.api = api
})
afterEach(() => vi.useRealTimers())

async function openSong() {
  const manifest = createProject('Summer Demo', 48000)
  const hook = renderHook(() =>
    useSong({ dir: '/songs/Summer Demo', name: 'Summer Demo', manifest })
  )
  await waitFor(() => expect(hook.result.current.song).not.toBeNull())
  return hook
}

const lastSaved = () =>
  vi.mocked(api.writeManifest).mock.lastCall?.[1] as ReturnType<typeof createProject>

describe('useSong', () => {
  it('saves an edit to project.json shortly after it happens', async () => {
    const { result } = await openSong()
    const trackId = result.current.song!.data.tracks[0].id
    act(() =>
      result.current.edit(withTrackChanges(result.current.song!.data, trackId, { muted: true }))
    )
    await waitFor(() => expect(lastSaved().tracks[0].muted).toBe(true), { timeout: SAVE_WAIT_MS })
  })

  it('reports saving while a change is pending, then when it was saved', async () => {
    const { result } = await openSong()
    const trackId = result.current.song!.data.tracks[0].id
    act(() =>
      result.current.edit(withTrackChanges(result.current.song!.data, trackId, { pan: 0.5 }))
    )
    expect(result.current.saveState).toEqual({ status: 'saving' })
    await waitFor(() => expect(result.current.saveState?.status).toBe('saved'), {
      timeout: SAVE_WAIT_MS
    })
  })

  it('undoes a whole slider drag in one step, and redoes it', async () => {
    const { result } = await openSong()
    const trackId = result.current.song!.data.tracks[0].id
    for (const volume of [0.8, 0.6, 0.4]) {
      act(() =>
        result.current.edit(
          withTrackChanges(result.current.song!.data, trackId, { volume }),
          'drag'
        )
      )
    }
    act(() => result.current.undo())
    expect(result.current.song!.data.tracks[0].volume).toBe(1)
    act(() => result.current.redo())
    expect(result.current.song!.data.tracks[0].volume).toBe(0.4)
  })

  it('renames the song and its folder', async () => {
    const { result } = await openSong()
    await act(() => result.current.renameSong('Night Drive'))
    expect(result.current.song).toMatchObject({
      dir: '/songs/Night Drive',
      data: { name: 'Night Drive' }
    })
    expect(lastSaved().name).toBe('Night Drive')
  })
})
