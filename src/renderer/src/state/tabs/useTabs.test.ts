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
