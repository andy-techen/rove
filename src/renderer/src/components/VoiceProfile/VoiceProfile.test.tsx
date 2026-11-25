import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import type { VoiceCacheEntry } from '@shared/voice'
import type { Entry } from '../../audio/voice'
import { sungEntry } from '../../state/voice/testEntries'
import { singingTime } from '../../state/voice/voiceText'
import { previewNote } from '../../state/chords/preview'
import { VoiceProfile } from '.'

vi.mock('../../state/chords/preview', () => ({ previewNote: vi.fn() }))

/** Songs already listened to, so the profile shows straight from the cache. */
function renderWith(entries: Entry[]) {
  const cache: VoiceCacheEntry[] = entries.map(({ ref, summary }) => ({
    folder: ref.folder,
    file: ref.file,
    offsetSec: ref.offsetSec,
    durationSec: ref.durationSec,
    summary
  }))
  vi.mocked(window.api.voice.listTakes).mockResolvedValue(entries.map((e) => e.ref))
  vi.mocked(window.api.voice.loadCache).mockResolvedValue(cache)
  render(<VoiceProfile />)
  return userEvent.setup()
}

const twoSongs = () => [
  sungEntry('Everyday', '2026-08-03', { sec: 120, notes: [50, 55, 57] }),
  sungEntry('Grow as we go', '2026-10-12', {
    sec: 120,
    notes: [48, 60, 67],
    landing: { 10: 7, 0: 3 }
  })
]

describe('VoiceProfile', () => {
  it('shows how much more singing it needs before the profile appears', async () => {
    renderWith([sungEntry('Everyday', '2026-08-03', { sec: 41 })])
    const progress = await screen.findByRole('progressbar', { name: t('voice.lockedLabel') })
    expect(progress).toHaveAttribute('aria-valuetext', singingTime(41))
    expect(screen.getByText(t('voice.locked', { minutes: 3 }))).toBeInTheDocument()
  })

  it('counts the songs, time recorded and takes it has listened to', async () => {
    // Each song's take records twice as long as it sings: 2 × 240 s.
    renderWith(twoSongs())
    await screen.findByText(t('voice.songs'))
    const card = (label: string) => screen.getByText(label).nextSibling
    expect(card(t('voice.songs'))).toHaveTextContent('2')
    expect(card(t('voice.recorded'))).toHaveTextContent(singingTime(480))
    expect(card(t('voice.takes'))).toHaveTextContent('2')
  })

  it('shows the lowest, highest and comfort zone across every song', async () => {
    renderWith(twoSongs())
    expect(await screen.findByRole('heading', { name: t('voice.range') })).toBeInTheDocument()
    expect(screen.getByText(t('voice.lowest')).nextSibling).toHaveTextContent('C3')
    expect(screen.getByText(t('voice.highest')).nextSibling).toHaveTextContent('G4')
  })

  it('plays a note on the piano when its name is clicked', async () => {
    const user = renderWith(twoSongs())
    const [highest] = await screen.findAllByRole('button', {
      name: t('voice.playNote', { note: 'G4' })
    })
    await user.click(highest)
    expect(previewNote).toHaveBeenCalledWith(67)
  })

  it('shows each song’s range when By song is pressed', async () => {
    const user = renderWith(twoSongs())
    await user.click(await screen.findByRole('button', { name: t('voice.bySong') }))
    const songs = screen.getByRole('list', { name: t('voice.songsChart') })
    expect(songs.querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(screen.getByRole('button', { name: t('voice.allSongs') })).toBeInTheDocument()
  })

  it('marks the month that reached a new high note', async () => {
    renderWith(twoSongs())
    expect(await screen.findByText(t('voice.newHigh', { note: 'G4' }))).toBeInTheDocument()
    expect(screen.getAllByText(t('voice.noSinging'))).toHaveLength(1)
  })

  it('says how many held notes land on the note', async () => {
    // 11 of 14 held notes (4 + 7) sit in the middle bin.
    renderWith(twoSongs())
    expect(await screen.findByText(t('voice.landedShare', { count: 8 }))).toBeInTheDocument()
  })
})
