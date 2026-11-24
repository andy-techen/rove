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
function renderEditor(text = '| C | % | % | % |', beatsPerBar: 3 | 4 = 4) {
  const onBars = vi.fn()
  const onTempo = vi.fn()
  const onPreview = vi.fn()
  function Harness() {
    const [chart, setChart] = useState({ ...chartOf(text), beatsPerBar })
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

const picker = () => within(screen.getByRole('region', { name: /^Chord for / }))
const keyChord = (name: string) =>
  within(picker().getByRole('group', { name: t('chords.inKey') })).getByRole('button', { name })
const bar = (n: number) => screen.getByRole('button', { name: new RegExp(`^Bar ${n}:`) })

describe('ChartEditor', () => {
  it('fills a bar from the chords in the key, plays it, and moves on', async () => {
    const { lastBars, onPreview } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.click(keyChord('Am'))
    expect(lastBars()).toEqual(['C', 'Am', '', ''])
    expect(onPreview).toHaveBeenCalledWith({ root: 9, quality: 'minor' })
    expect(bar(3)).toHaveAttribute('aria-pressed', 'true')
  })

  it('fills a run of shift-clicked bars with one chord', async () => {
    const { lastBars } = renderEditor('| C | F | % | % |')
    const user = userEvent.setup()
    await user.click(bar(2))
    await user.keyboard('{Shift>}')
    await user.click(bar(4))
    await user.keyboard('{/Shift}')
    expect(picker().getByText(t('chords.barRange', { from: 2, to: 4 }))).toBeInTheDocument()
    await userEvent.click(keyChord('G'))
    expect(lastBars()).toEqual(['C', 'G', 'G', 'G'])
  })

  it('switches to all chords and picks one by its root', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(picker().getByRole('button', { name: t('chords.every') }))
    await userEvent.click(picker().getByRole('button', { name: t('chords.onRoot', { note: 'D' }) }))
    await userEvent.click(picker().getByRole('button', { name: 'D7' }))
    expect(lastBars()[0]).toBe('D7')
  })

  it('repeats a full line of bars, but not a part-filled one', async () => {
    const { lastBars } = renderEditor('| C | G | Am | F | D |')
    await userEvent.click(screen.getByRole('button', { name: t('chords.repeatLine') }))
    expect(lastBars()).toEqual(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'D'])
    await userEvent.click(bar(9))
    expect(screen.getByRole('button', { name: t('chords.repeatLine') })).toBeDisabled()
  })

  it('finds a chord by its typed name', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.type(picker().getByRole('searchbox'), 'Bbmaj7{Enter}')
    expect(lastBars()[1]).toBe('B♭maj7')
  })

  it('splits a bar into two boxes and moves on to the new one', async () => {
    const { lastBars } = renderEditor()
    await userEvent.click(bar(1))
    await userEvent.click(screen.getByRole('button', { name: t('chords.split') }))
    const half = t('chords.halfNumber', { n: 1, k: 2 })
    expect(picker().getByText(half)).toBeInTheDocument()
    await userEvent.click(keyChord('G'))
    expect(lastBars()[0]).toBe('C G')
  })

  it('merges a split bar back when both halves are the same chord', async () => {
    const { lastBars } = renderEditor('| C G | F |')
    const second = t('chords.halfLabel', { n: 1, k: 2, chord: 'G' })
    await userEvent.click(screen.getByRole('button', { name: second }))
    await userEvent.click(keyChord('C'))
    expect(lastBars()[0]).toBe('C')
  })

  it('lets a bar keep the chord before it playing', async () => {
    const { lastBars } = renderEditor('C G Am F')
    await userEvent.click(bar(3))
    await userEvent.click(screen.getByRole('button', { name: t('chords.keep', { chord: 'G' }) }))
    expect(lastBars()).toEqual(['C', 'G', '', 'F'])
    // Still named, so it doesn't look silent.
    expect(bar(3)).toHaveTextContent('G')
    expect(bar(3)).toHaveAccessibleName(
      t('chords.barLabel', { n: 3, chords: t('chords.keep', { chord: 'G' }) })
    )
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

  it('repeats a line of three bars in 3/4', async () => {
    const { lastBars } = renderEditor('| C | G | F | D |', 3)
    await userEvent.click(screen.getByRole('button', { name: t('chords.repeatLine') }))
    expect(lastBars()).toEqual(['C', 'G', 'F', 'C', 'G', 'F', 'D'])
  })

  it('nudges the tempo by scrolling over it', () => {
    const { onTempo } = renderEditor()
    const tempo = screen.getByRole('textbox', { name: t('chords.tempoLabel') })
    fireEvent.wheel(tempo, { deltaY: -40 })
    expect(onTempo).toHaveBeenLastCalledWith(101)
    fireEvent.wheel(tempo, { deltaY: 40 })
    expect(onTempo).toHaveBeenLastCalledWith(99)
  })

  it('takes a typed tempo', async () => {
    const { onTempo } = renderEditor()
    const tempo = screen.getByRole('textbox', { name: t('chords.tempoLabel') })
    await userEvent.clear(tempo)
    await userEvent.type(tempo, '72{Enter}')
    expect(onTempo).toHaveBeenCalledWith(72)
  })
})
