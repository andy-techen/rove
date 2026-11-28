import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { showSnack } from '../ui/snackbar'
import { exportSongFile } from './songFile'

vi.mock('../ui/snackbar', () => ({ showSnack: vi.fn() }))

const openSong = (saveNow = vi.fn(async () => {})) => ({ dir: '/songs/Sunset', saveNow })

describe('exportSongFile', () => {
  it('saves the latest edits before writing the project file, then says so', async () => {
    const order: string[] = []
    const song = openSong(vi.fn(async () => void order.push('save')))
    vi.mocked(window.api.exportSongFile).mockImplementation(async () => {
      order.push('export')
      return '/Documents/Sunset.rove'
    })
    await exportSongFile(song)
    expect(window.api.exportSongFile).toHaveBeenCalledWith('/songs/Sunset')
    expect(order).toEqual(['save', 'export'])
    expect(showSnack).toHaveBeenCalledWith(t('songFile.exported'))
  })

  it('says nothing when the singer cancels', async () => {
    vi.mocked(window.api.exportSongFile).mockResolvedValueOnce(null)
    await exportSongFile(openSong())
    expect(showSnack).not.toHaveBeenCalled()
  })

  it('says when the project could not be written', async () => {
    vi.mocked(window.api.exportSongFile).mockRejectedValueOnce(new Error('disk full'))
    await exportSongFile(openSong())
    expect(showSnack).toHaveBeenCalledWith(t('songFile.exportFailed'))
  })
})
