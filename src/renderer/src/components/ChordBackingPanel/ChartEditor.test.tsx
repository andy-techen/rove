import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import { ChordChart } from '../../state/song/project'
import { chartFromText } from '../../state/chords/chordText'
import { chordsInKey } from '../../state/chords/keyChords'
import { chordName } from '../../state/chords/noteNames'
import { ChartEditor } from './ChartEditor'

const chartOf = (text: string): ChordChart => ({
  bpm: 100,
  beatsPerBar: 4,
  startSec: 0,
  bars: chartFromText(text).bars
})

/** The editor with its chart kept in state, as the song would keep it. */
function renderEditor(text = '| C | % | % | % |') {
  const onBars = vi.fn()
  const onTempo = vi.fn()
  const onPreview = vi.fn()
  function Harness() {
    const [chart, setChart] = useState(chartOf(text))
    const [place, setPlace] = useState({ bar: 0, slot: 0 })
    return (
      <ChartEditor
        chart={chart}
        playingBar={-1}
        suggestions={{ label: t('chords.inKey'), chords: chordsInKey({ tonic: 0, mode: 'major' }) }}
        locked={false}
        onBars={(bars: Chord[][]) => {
          onBars(bars)
          setChart({ ...chart, bars })
        }}
        onTempo={onTempo}
        onBeats={vi.fn()}
        onPreview={onPreview}
        place={place}
        onPlace={setPlace}
      />
    )
  }
  render(<Harness />)
  const lastBars = () =>
    onBars.mock.lastCall![0].map((bar: Chord[]) => bar.map(chordName).join(' '))
  return { onTempo, onPreview, lastBars }
}

const picker = () => within(screen.getByRole('region', { name: /^Chord for bar/ }))
const bar = (n: number) => screen.getByRole('button', { name: new RegExp(`^Bar ${n}:`) })

describe('ChartEditor', () => {
  it('fills a bar from the chords in the key, plays it, and moves on', async () => {
    const { lastBars, onPreview } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.click(picker().getByRole('button', { name: 'Am' }))
    expect(lastBars()).toEqual(['C', 'Am', '', ''])
    expect(onPreview).toHaveBeenCalledWith({ root: 9, quality: 'minor' })
    expect(bar(3)).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers every kind of chord on the root you choose', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.click(picker().getByRole('button', { name: t('chords.onRoot', { note: 'D' }) }))
    await userEvent.click(picker().getByRole('button', { name: 'D7' }))
    expect(lastBars()[1]).toBe('D7')
  })

  it('finds a chord by its typed name', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.type(picker().getByRole('searchbox'), 'Bbmaj7{Enter}')
    expect(lastBars()[1]).toBe('B♭maj7')
  })

  it('shares a bar between two chords', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(bar(1))
    await userEvent.click(picker().getByRole('button', { name: t('chords.split') }))
    await userEvent.click(picker().getByRole('button', { name: 'G' }))
    expect(lastBars()[0]).toBe('C G')
  })

  it('lets a bar carry the chord before it on', async () => {
    const { lastBars } = renderEditor('C G Am F')
    await userEvent.click(bar(3))
    await userEvent.click(picker().getByRole('button', { name: t('chords.carryOn') }))
    expect(lastBars()).toEqual(['C', 'G', '', 'F'])
  })

  it('moves between bars with the arrow keys', async () => {
    renderEditor()
    await userEvent.click(bar(1))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(bar(3)).toHaveFocus()
    expect(picker().getByText(t('chords.barNumber', { n: 3 }))).toBeInTheDocument()
  })

  it('fills bars from a pasted chart', () => {
    const { lastBars } = renderEditor('C')
    fireEvent.paste(bar(1), { clipboardData: { getData: () => '| G | D | Em | C |' } })
    expect(lastBars()).toEqual(['G', 'D', 'Em', 'C'])
  })

  it('takes a typed tempo', async () => {
    const { onTempo } = renderEditor()
    const tempo = screen.getByRole('textbox', { name: t('chords.tempoLabel') })
    await userEvent.clear(tempo)
    await userEvent.type(tempo, '72{Enter}')
    expect(onTempo).toHaveBeenCalledWith(72)
  })
})
