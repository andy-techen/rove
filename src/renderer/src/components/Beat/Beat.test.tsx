import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Beat } from '.'

function renderBeat({ available = true, withTempo = true, withMusic = false } = {}) {
  const click = { on: false, level: 0.5, available, onOn: vi.fn(), onLevel: vi.fn() }
  const tempo = {
    value: { bpm: 100, beatsPerBar: 4 as const, startSec: 0 },
    onTempo: vi.fn(),
    onBeats: vi.fn(),
    onMatchMusic: withMusic ? vi.fn() : undefined
  }
  render(<Beat click={click} tempo={withTempo ? tempo : null} locked={false} />)
  return { click, tempo }
}

const open = () => userEvent.click(screen.getByRole('button', { name: t('beat.open') }))

describe('Beat', () => {
  it('matches the tempo to the music file', async () => {
    const { tempo } = renderBeat({ withMusic: true })
    await open()
    await userEvent.click(screen.getByRole('button', { name: t('beat.matchMusic') }))
    expect(tempo.onMatchMusic).toHaveBeenCalled()
  })

  it('offers no match without a music file', async () => {
    renderBeat()
    await open()
    expect(screen.queryByRole('button', { name: t('beat.matchMusic') })).not.toBeInTheDocument()
  })

  it('switches the metronome on, and sets how loud it is', async () => {
    const { click } = renderBeat()
    await open()
    await userEvent.click(screen.getByRole('button', { name: t('music.clickOn') }))
    expect(click.onOn).toHaveBeenCalledWith(true)
    fireEvent.change(screen.getByRole('slider', { name: t('beat.clickLevel') }), {
      target: { value: '40' }
    })
    expect(click.onLevel).toHaveBeenCalledWith(0.4, 'music-click')
  })

  it('offers no click when there is no beat to follow', async () => {
    renderBeat({ available: false, withTempo: false })
    await open()
    expect(screen.getByRole('button', { name: t('music.clickOn') })).toBeDisabled()
    expect(screen.getByText(t('music.clickNoBeat'))).toBeInTheDocument()
  })

  it('sets the song tempo by typing or scrolling', async () => {
    const { tempo } = renderBeat()
    await open()
    const field = screen.getByRole('textbox', { name: t('chords.tempoLabel') })
    await userEvent.clear(field)
    await userEvent.type(field, '72{Enter}')
    expect(tempo.onTempo).toHaveBeenCalledWith(72)
    fireEvent.wheel(field, { deltaY: -40 })
    expect(tempo.onTempo).toHaveBeenLastCalledWith(101)
  })

  it('switches the count to three', async () => {
    const { tempo } = renderBeat()
    await open()
    await userEvent.click(screen.getByRole('button', { name: t('chords.countOf', { n: 3 }) }))
    expect(tempo.onBeats).toHaveBeenCalledWith(3)
  })

  it('shows tempo only once the song has an instrumental', async () => {
    renderBeat({ withTempo: false })
    await open()
    expect(screen.queryByRole('textbox', { name: t('chords.tempoLabel') })).toBeNull()
  })

  it('closes with Escape', async () => {
    renderBeat()
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: t('beat.title') })).toBeNull()
  })
})
