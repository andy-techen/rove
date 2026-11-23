import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { ChordSegment } from '../../audio/music/chords'
import { ChordsPanel } from '.'

const chords: ChordSegment[] = [
  { start: 0, end: 2, chord: { root: 0, quality: 'major' } },
  { start: 2, end: 4, chord: { root: 7, quality: 'major' } },
  { start: 4, end: 6, chord: { root: 9, quality: 'minor' } }
]

function renderPanel(props: Partial<Parameters<typeof ChordsPanel>[0]> = {}) {
  const all = { chords, hasMusic: true, position: 2.5, onSeek: vi.fn(), onClose: vi.fn(), ...props }
  render(<ChordsPanel {...all} />)
  return all
}

describe('ChordsPanel', () => {
  it('shows the chord playing now and the one coming next', () => {
    renderPanel()
    expect(screen.getByRole('status')).toHaveTextContent(`${t('chords.now')}G`)
    expect(screen.getByRole('status')).toHaveTextContent(`${t('chords.next')}Am`)
  })

  it('jumps to a chord when it is clicked', async () => {
    const { onSeek } = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: /^Am/ }))
    expect(onSeek).toHaveBeenCalledWith(4)
  })

  it('says it is still listening', () => {
    renderPanel({ chords: null })
    expect(screen.getByText(t('chords.listening'))).toBeInTheDocument()
  })

  it('asks for music when there is none', () => {
    renderPanel({ chords: null, hasMusic: false })
    expect(screen.getByText(t('chords.noMusic'))).toBeInTheDocument()
  })

  it('shows how to hold the chord playing now on a guitar', () => {
    renderPanel()
    expect(screen.getByRole('img', { name: t('chords.grip', { chord: 'G' }) })).toBeInTheDocument()
  })

  it('offers to write the chords', async () => {
    const onWrite = vi.fn()
    renderPanel({ onWrite })
    await userEvent.click(screen.getByRole('button', { name: t('chords.write') }))
    expect(onWrite).toHaveBeenCalled()
  })

  it('follows the chords you wrote, and opens them for editing', async () => {
    const onEditing = vi.fn()
    const editor = {
      chart: { bpm: 100, beatsPerBar: 4 as const, startSec: 0, bars: [] },
      playingBar: -1,
      suggestions: { label: '', chords: [] },
      locked: false,
      onBars: vi.fn(),
      onTempo: vi.fn(),
      onBeats: vi.fn(),
      onPreview: vi.fn()
    }
    renderPanel({ fromChart: true, hasMusic: false, editor, onEditing })
    expect(screen.getByRole('status')).toHaveTextContent(`${t('chords.now')}G`)
    await userEvent.click(screen.getByRole('button', { name: t('chords.edit') }))
    expect(onEditing).toHaveBeenCalledWith(true)
  })
})
