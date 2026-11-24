import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { BarBeat, BeatChart, BeatPart, PadDrum } from '../../state/song/project'
import { BeatsEditor } from './BeatsEditor'

// No Web Audio here: the loop is stood in for, and says where a tap would land.
const loop = { counting: true, at: 0 }
vi.mock('../../audio/music/beatLoop', () => ({
  startBeatLoop: () => ({
    tapAt: () => ({ counting: loop.counting, at: loop.at }),
    stop: () => {}
  })
}))
vi.mock('../../audio/engine/engine', () => ({
  getAudioContext: () => ({ resume: async () => {} })
}))

/** The editor with its drums kept in state, as the song would keep them. */
function renderEditor(start: BarBeat[] = ['main', 'main', 'main', 'main']) {
  const onParts = vi.fn()
  const onRemove = vi.fn()
  const onPreviewDrum = vi.fn()
  const onHear = vi.fn()
  function Harness() {
    const [beats, setBeats] = useState<BeatChart>({ groove: 'pop', parts: start })
    const [place, setPlace] = useState({ bar: 0, slot: 0 })
    return (
      <BeatsEditor
        beats={beats}
        beatsPerBar={4}
        secPerBeat={0.5}
        playingBar={-1}
        locked={false}
        onParts={(parts) => {
          onParts(parts)
          setBeats({ ...beats, parts })
        }}
        onMyBeat={(beat, parts) => {
          const mine = [...(beats.mine ?? []).filter((b) => b.n !== beat.n), beat]
          setBeats({ ...beats, mine, parts: parts ?? beats.parts })
        }}
        onPreviewDrum={onPreviewDrum}
        onHear={onHear}
        onDeleteBeat={(n) => {
          const mine = beats.mine ?? []
          const at = mine.findIndex((b) => b.n === n)
          const instead = mine[at - 1] ?? mine[at + 1]
          const next: BarBeat = instead ? `mine-${instead.n}` : 'main'
          setBeats({
            ...beats,
            parts: beats.parts.map((p) => (p === `mine-${n}` ? next : p)),
            mine: mine.filter((b) => b.n !== n)
          })
        }}
        onRemove={onRemove}
        place={place}
        onPlace={setPlace}
      />
    )
  }
  render(<Harness />)
  return { onParts, onRemove, onPreviewDrum, onHear, lastParts: () => onParts.mock.lastCall![0] }
}

const hitName = (drum: PadDrum, beat: number) =>
  t('beats.hitLabel', { drum: t(`beats.${drum}`), beat })
const hit = (drum: PadDrum, beat: number) =>
  screen.getByRole('button', { name: hitName(drum, beat) })
const bar = (n: number) => screen.getByRole('button', { name: new RegExp(`^Bar ${n}:`) })
const part = (name: BeatPart) =>
  within(screen.getByRole('group', { name: t('beats.parts') })).getByRole('button', {
    name: t(`beats.${name}`)
  })

describe('BeatsEditor', () => {
  it('sets how busy the drums are in a bar', async () => {
    const { lastParts } = renderEditor()
    await userEvent.click(bar(4))
    await userEvent.click(part('fill'))
    expect(lastParts()).toEqual(['main', 'main', 'main', 'fill'])
    expect(part('fill')).toHaveAttribute('aria-pressed', 'true')
  })

  it('sets a run of shift-clicked bars at once', async () => {
    const { lastParts } = renderEditor()
    const user = userEvent.setup()
    await user.click(bar(1))
    await user.keyboard('{Shift>}')
    await user.click(bar(3))
    await user.keyboard('{/Shift}')
    await user.click(part('quiet'))
    expect(lastParts()).toEqual(['quiet', 'quiet', 'quiet', 'main'])
  })

  it('adds a bar that carries on like the one before', async () => {
    const { lastParts } = renderEditor(['main', 'big'])
    await userEvent.click(screen.getByRole('button', { name: t('chords.addBar') }))
    expect(lastParts()).toEqual(['main', 'big', 'big'])
    expect(bar(3)).toHaveFocus()
  })

  it('takes the picked bars out with Delete', async () => {
    const { onRemove } = renderEditor()
    await userEvent.click(bar(2))
    await userEvent.keyboard('{Backspace}')
    expect(onRemove).toHaveBeenCalled()
  })

  it('makes a beat of your own from the bar as it sounds, and plays it there', async () => {
    renderEditor()
    await userEvent.click(bar(2))
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    expect(bar(2)).toHaveAccessibleName(
      t('beats.barLabel', { n: 2, part: t('beats.mine', { n: 1 }) })
    )
    // Main's kick on one and three, on the pad.
    expect(hit('kick', 1)).toBeInTheDocument()
    expect(hit('kick', 3)).toBeInTheDocument()
  })

  it('adds a hit where you click a lane, on the sixteenth under the pointer', async () => {
    const { onPreviewDrum } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    const lane = screen.getByLabelText(t('beats.lane', { drum: t('beats.rim'), key: 'F' }))
    lane.getBoundingClientRect = () => ({ left: 0, width: 160 }) as DOMRect
    // A tenth of the way in: the bar's second sixteenth, a quarter of a beat in.
    fireEvent.click(lane, { clientX: 17 })
    expect(hit('rim', 1.25)).toBeInTheDocument()
    expect(onPreviewDrum).toHaveBeenCalledWith('rim')
  })

  it('takes a hit away when it’s clicked', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await userEvent.click(hit('kick', 3))
    expect(screen.queryByRole('button', { name: hitName('kick', 3) })).toBeNull()
  })

  it('records the drums you play on the keys, after counting in', async () => {
    const { onPreviewDrum } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await userEvent.keyboard('r')
    expect(screen.getByRole('button', { name: t('beats.stopRecording') })).toBeInTheDocument()
    loop.counting = false
    loop.at = 1.52
    await userEvent.keyboard('d')
    expect(onPreviewDrum).toHaveBeenCalledWith('clap')
    // Played a touch late, it lands on the sixteenth.
    expect(hit('clap', 2.5)).toBeInTheDocument()
    await userEvent.keyboard('r')
    expect(screen.getByRole('button', { name: t('beats.record') })).toBeInTheDocument()
  })

  it('plays drums from the keys without recording them', async () => {
    const { onPreviewDrum } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    fireEvent.keyDown(window, { key: ';', code: 'Semicolon' })
    expect(onPreviewDrum).toHaveBeenCalledWith('crash')
    expect(screen.queryByRole('button', { name: new RegExp(t('beats.crash')) })).toBeNull()
  })

  it('gives the pad the whole panel, and goes back to the bars', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await userEvent.click(screen.getByRole('button', { name: t('beats.expand') }))
    expect(screen.queryByRole('button', { name: /^Bar 1:/ })).not.toBeInTheDocument()
    expect(hit('snare', 2)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('beats.collapse') }))
    expect(bar(1)).toBeInTheDocument()
  })

  it('keeps your own beats in their own group, and lets you rename one', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    const yours = screen.getByRole('group', { name: t('beats.yours') })
    expect(
      within(yours).getByRole('button', { name: t('beats.mine', { n: 1 }) })
    ).toBeInTheDocument()
    await userEvent.dblClick(within(yours).getByRole('button', { name: t('beats.mine', { n: 1 }) }))
    // The field opens with the name selected, so typing replaces it.
    expect(screen.getByRole('textbox', { name: t('beats.nameLabel') })).toHaveFocus()
    await userEvent.keyboard('Chorus{Enter}')
    expect(within(yours).getByRole('button', { name: 'Chorus' })).toBeInTheDocument()
    expect(bar(1)).toHaveAccessibleName(t('beats.barLabel', { n: 1, part: 'Chorus' }))
  })

  it('plays the picked bar’s beat once, and can stop it early', async () => {
    const { onHear } = renderEditor(['quiet', 'main'])
    await userEvent.click(screen.getByRole('button', { name: t('beats.hear') }))
    expect(onHear).toHaveBeenLastCalledWith('quiet', expect.any(Function))
    await userEvent.click(screen.getByRole('button', { name: t('beats.stopHearing') }))
    expect(onHear).toHaveBeenLastCalledWith(null)
    // Once the bar has played, the button is ready to play it again.
    await userEvent.click(screen.getByRole('button', { name: t('beats.hear') }))
    act(() => onHear.mock.lastCall![1]())
    expect(screen.getByRole('button', { name: t('beats.hear') })).toBeInTheDocument()
  })

  it('deletes a beat of your own', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await userEvent.click(screen.getByRole('button', { name: t('beats.deleteBeat') }))
    expect(screen.queryByRole('button', { name: t('beats.mine', { n: 1 }) })).toBeNull()
  })

  it('finds a beat of your own by name from the search icon', async () => {
    // No layout here: the row says it's taller than it shows, as a full one would.
    const wide = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500)
    renderEditor()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await user.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await user.click(screen.getByRole('button', { name: t('beats.find') }))
    await user.keyboard('2')
    const yours = screen.getByRole('group', { name: t('beats.yours') })
    expect(
      within(yours)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual([t('beats.mine', { n: 2 })])
    wide.mockRestore()
  })

  it('moves to the beat before when one of your own is deleted', async () => {
    renderEditor()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await user.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await user.click(screen.getByRole('button', { name: t('beats.deleteBeat') }))
    expect(bar(1)).toHaveAccessibleName(
      t('beats.barLabel', { n: 1, part: t('beats.mine', { n: 1 }) })
    )
  })

  it('shows a built-in part on the pad to look at, to play and enlarge', async () => {
    renderEditor(['main', 'quiet'])
    await userEvent.click(bar(2))
    // Quiet: a soft kick on one and a rim on four.
    expect(hit('rim', 4)).toBeDisabled()
    expect(screen.getByRole('button', { name: t('beats.hear') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('beats.record') })).toBeNull()
    expect(screen.getByRole('button', { name: t('beats.expand') })).toBeInTheDocument()
  })

  it('clears your beat’s pad to start fresh', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: t('beats.newBeat') }))
    await userEvent.click(screen.getByRole('button', { name: t('beats.clear') }))
    expect(screen.queryByRole('button', { name: hitName('kick', 1) })).toBeNull()
    expect(screen.getByRole('button', { name: t('beats.clear') })).toBeDisabled()
  })
})
