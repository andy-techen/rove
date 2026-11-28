import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { LyricsResult } from '@shared/online/lyrics'
import { SongLyrics } from '../../state/lyrics/lyrics'
import { LyricsPanel } from '.'

const timed: SongLyrics = {
  title: 'Song',
  artist: 'Singer',
  lines: [
    { time: 1, text: 'First line' },
    { time: 4, text: 'Second line' },
    { time: 8, text: 'Third line' }
  ],
  offsetSec: 0
}

const match: LyricsResult = {
  id: 1,
  title: 'Song',
  artist: 'Singer',
  album: 'Album',
  durationSec: 200,
  synced: '[00:01.00] Hello',
  plain: 'Hello'
}

function renderPanel(lyrics: SongLyrics | null, position = 0) {
  const props = {
    songName: 'Untitled Song',
    lyrics,
    position,
    locked: false,
    onSeek: vi.fn(),
    onChange: vi.fn(),
    onNudge: vi.fn(),
    onClose: vi.fn()
  }
  render(<LyricsPanel {...props} />)
  return props
}

const searchBox = (): HTMLElement =>
  screen.getByRole('searchbox', { name: t('lyrics.searchLabel') })

describe('LyricsPanel', () => {
  it('searches for what was typed and uses the match picked', async () => {
    vi.mocked(window.api.searchLyrics).mockResolvedValueOnce([match])
    const { onChange } = renderPanel(null)
    expect(searchBox()).toHaveValue('')
    await userEvent.type(searchBox(), 'Song Singer{Enter}')
    expect(window.api.searchLyrics).toHaveBeenCalledWith('Song Singer')
    await userEvent.click(await screen.findByRole('button', { name: /^Song/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Song' }))
  })

  it('says when the lyrics library cannot be reached', async () => {
    vi.mocked(window.api.searchLyrics).mockRejectedValueOnce(new Error('offline'))
    renderPanel(null)
    await userEvent.type(searchBox(), 'Song{Enter}')
    expect(await screen.findByText(t('lyrics.searchFailed'))).toBeInTheDocument()
  })

  it('marks the line being sung', () => {
    renderPanel(timed, 5)
    expect(screen.getByRole('button', { name: 'Second line' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('jumps to a line when it is clicked, following the timing nudge', async () => {
    const { onSeek } = renderPanel({ ...timed, offsetSec: 0.5 })
    await userEvent.click(screen.getByRole('button', { name: 'Third line' }))
    expect(onSeek).toHaveBeenCalledWith(8.5)
  })

  it('nudges the lyrics later', async () => {
    const { onNudge } = renderPanel(timed)
    await userEvent.click(screen.getByRole('button', { name: t('lyrics.later') }))
    expect(onNudge).toHaveBeenCalledWith(expect.any(Number))
    expect(vi.mocked(onNudge).mock.calls[0][0]).toBeGreaterThan(0)
  })

  it('explains that untimed lyrics will not follow along', () => {
    renderPanel({ title: 'Song', lines: [{ time: null, text: 'La la' }], offsetSec: 0 })
    expect(screen.getByText(t('lyrics.untimed'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'La la' })).toBeNull()
  })

  it('searches for other lyrics in place of the ones showing', async () => {
    vi.mocked(window.api.searchLyrics).mockResolvedValueOnce([{ ...match, id: 2, title: 'Other' }])
    const { onChange } = renderPanel(timed)
    await userEvent.click(screen.getByRole('button', { name: t('lyrics.change') }))
    await userEvent.type(searchBox(), 'Other{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: /Other/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Other' }))
  })

  it('starts the search with the song’s name', () => {
    render(
      <LyricsPanel
        songName="Golden Hour"
        lyrics={null}
        position={0}
        locked={false}
        onSeek={vi.fn()}
        onChange={vi.fn()}
        onNudge={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(searchBox()).toHaveValue('Golden Hour')
  })
})
