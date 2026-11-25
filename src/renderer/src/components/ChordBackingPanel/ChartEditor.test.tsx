import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import { ChordChart, ChordFeel, feelsOf } from '../../state/song/project'
import { chartFromText } from '../../state/chords/chordText'
import { chordsInKey } from '../../state/chords/keyChords'
import { chordName } from '../../state/chords/noteNames'
import { ChartEditor } from './ChartEditor'

const chartOf = (text: string): ChordChart => ({ bars: chartFromText(text).bars })

/** The editor with its chart kept in state, as the song would keep it. */
function renderEditor(
  text = '| C | % | % | % |',
  beatsPerBar: 3 | 4 = 4,
  instrument: 'guitar' | 'piano' = 'guitar',
  pasteNote: string | null = null
) {
  const onBars = vi.fn()
  const onPasteChords = vi.fn()
  const onPreview = vi.fn()
  const onRemove = vi.fn()
  function Harness() {
    const [chart, setChart] = useState<ChordChart>(chartOf(text))
    const [place, setPlace] = useState({ bar: 0, slot: 0 })
    return (
      <ChartEditor
        pasteNote={pasteNote}
        onPasteChords={onPasteChords}
        instrument={instrument}
        chart={chart}
        beatsPerBar={beatsPerBar}
        playingBar={-1}
        suggestions={{ label: t('chords.inKey'), chords: chordsInKey({ tonic: 0, mode: 'major' }) }}
        locked={false}
        onBars={(bars: Chord[][], feels?: ChordFeel[]) => {
          onBars(bars)
          setChart({ ...chart, bars, feels: feels ?? chart.feels })
        }}
        onFeel={(first, last, feel) =>
          setChart({
            ...chart,
            feels: feelsOf(chart).map((f, i) => (i >= first && i <= last ? feel : f))
          })
        }
        onPreview={onPreview}
        onRemove={onRemove}
        place={place}
        onPlace={setPlace}
      />
    )
  }
  render(<Harness />)
  const lastBars = () =>
    onBars.mock.lastCall![0].map((bar: Chord[]) => bar.map(chordName).join(' '))
  return { onPreview, onRemove, onPasteChords, lastBars }
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

  it('pastes chords copied from a website with the Paste chords button', async () => {
    const { onPasteChords } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('chords.pasteChords') }))
    expect(onPasteChords).toHaveBeenCalled()
  })

  it('says when there were no chords to paste', () => {
    renderEditor('| C |', 4, 'guitar', t('chords.pasteNone'))
    expect(screen.getByRole('status')).toHaveTextContent(t('chords.pasteNone'))
  })

  it('repeats a line of three bars in 3/4', async () => {
    const { lastBars } = renderEditor('| C | G | F | D |', 3)
    await userEvent.click(screen.getByRole('button', { name: t('chords.repeatLine') }))
    expect(lastBars()).toEqual(['C', 'G', 'F', 'C', 'G', 'F', 'D'])
  })

  it('fingerpicks just the bars you pick', async () => {
    renderEditor('| C | G | Am | F |')
    await userEvent.click(bar(2))
    await userEvent.click(screen.getByRole('button', { name: t('instrumental.pick') }))
    expect(screen.getByRole('button', { name: t('instrumental.pick') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('offers the piano its own feels, reading a strummed bar as Chords', async () => {
    renderEditor('| C | G | Am | F |', 4, 'piano')
    await userEvent.click(bar(1))
    expect(screen.queryByRole('button', { name: t('instrumental.pick') })).toBeNull()
    expect(screen.getByRole('button', { name: t('instrumental.chords') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: t('instrumental.flowing') }))
    expect(screen.getByRole('button', { name: t('instrumental.flowing') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('takes the picked bars out with the bin above them', async () => {
    const { onRemove } = renderEditor('| C | G | Am | F |')
    await userEvent.click(bar(3))
    await userEvent.click(screen.getByRole('button', { name: t('chords.deleteBars') }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('takes the picked bars out with Delete', async () => {
    const { onRemove } = renderEditor('| C | G | Am | F |')
    await userEvent.click(bar(2))
    await userEvent.keyboard('{Backspace}')
    expect(onRemove).toHaveBeenCalled()
  })

  it('picks and focuses a newly added bar', async () => {
    renderEditor('| C | G |')
    await userEvent.click(screen.getByRole('button', { name: t('chords.addBar') }))
    expect(bar(3)).toHaveAttribute('aria-pressed', 'true')
    expect(bar(3)).toHaveFocus()
  })
})
