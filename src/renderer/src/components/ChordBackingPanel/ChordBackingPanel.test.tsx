import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { ChordBackingPanel } from '.'

function renderPanel() {
  render(
    <ChordBackingPanel
      trackName="Backing 2"
      chart={{ bpm: 100, beatsPerBar: 4, startSec: 0, bars: [[{ root: 0, quality: 'major' }]] }}
      playingBar={-1}
      suggestions={{ label: '', chords: [] }}
      locked={false}
      onBars={vi.fn()}
      onTempo={vi.fn()}
      onBeats={vi.fn()}
      onPreview={vi.fn()}
      place={{ bar: 0, slot: 0 }}
      onPlace={vi.fn()}
      onHide={vi.fn()}
    />
  )
}

describe('ChordBackingPanel', () => {
  it('names the instrumental by its track', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { name: new RegExp(t('instrumental.title')) })
    expect(heading).toHaveTextContent('Backing 2')
  })

  it('plays guitar, with piano and beats still to come', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: t('instrumental.guitar') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: t('instrumental.piano') })).toBeDisabled()
    expect(screen.getByRole('button', { name: t('instrumental.beats') })).toBeDisabled()
  })
})
