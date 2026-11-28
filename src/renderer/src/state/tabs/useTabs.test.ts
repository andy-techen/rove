import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { useTabs } from './useTabs'

const imported = { dir: '/songs/Sunset', name: 'Sunset', manifest: { name: 'Sunset' } }

async function openTabs() {
  const hook = renderHook(() => useTabs(true))
  await waitFor(() => expect(hook.result.current.tabs).toHaveLength(1))
  return hook
}

const song = (name: string) => ({ dir: `/songs/${name}`, name, manifest: { name } })

describe('useTabs opening and closing', () => {
  it('starts a song at first launch, when the Songbook is empty', async () => {
    const { result } = await openTabs()
    expect(window.api.createSong).toHaveBeenCalledOnce()
    expect(result.current.activeId).toBe(result.current.tabs[0].id)
  })

  it('opens nothing at launch when no songs were left open', async () => {
    vi.mocked(window.api.listSongs).mockResolvedValueOnce([
      { folder: 'Sunset', name: 'Sunset', modifiedAt: 0 }
    ])
    const { result } = renderHook(() => useTabs(true))
    await waitFor(() => expect(result.current.restored).toBe(true))
    expect(result.current.tabs).toEqual([])
    expect(window.api.createSong).not.toHaveBeenCalled()
  })

  it('closes the last song and remembers that none are open', async () => {
    const { result } = await openTabs()
    act(() => result.current.close(result.current.tabs[0].id))
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeId).toBeNull()
    await waitFor(() => expect(window.api.rememberTabs).toHaveBeenLastCalledWith([], null))
  })

  it('moves to the song before when the open one closes', async () => {
    vi.mocked(window.api.restoreTabs).mockResolvedValueOnce({
      songs: [song('One'), song('Two')],
      activeSong: '/songs/Two'
    })
    const { result } = renderHook(() => useTabs(true))
    await waitFor(() => expect(result.current.tabs).toHaveLength(2))
    act(() => result.current.close(result.current.activeId!))
    expect(result.current.tabs.map((tab) => tab.initial.name)).toEqual(['One'])
    expect(result.current.activeId).toBe(result.current.tabs[0].id)
  })
})

describe('useTabs importing a project', () => {
  it('opens the imported song in a new tab and brings it to the front', async () => {
    vi.mocked(window.api.importSongFile).mockResolvedValueOnce(imported)
    const { result } = await openTabs()
    await act(() => result.current.importSongFile())
    expect(result.current.tabs).toHaveLength(2)
    const active = result.current.tabs.find((tab) => tab.id === result.current.activeId)
    expect(active?.initial).toEqual(imported)
  })

  it('keeps the tabs as they were when the singer cancels', async () => {
    const { result } = await openTabs()
    await act(() => result.current.importSongFile())
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('says so when the file is not a project', async () => {
    vi.mocked(window.api.importSongFile).mockRejectedValueOnce(new Error('bad'))
    const { result } = await openTabs()
    await act(() => result.current.importSongFile())
    expect(result.current.error).toBe(t('songFile.importFailed'))
  })
})
