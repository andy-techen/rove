import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { MusicSettings } from '../../state/song/project'
import { MusicPanel } from '.'

function renderPanel(music: Partial<MusicSettings> = {}, over = {}) {
  const props = {
    trackName: 'Backing 1',
    music: {
      speed: 1,
      semitones: 0,
      bassDb: 0,
      brightnessDb: 0,
      clickOn: false,
      click: 0.7,
      ...music
    },
    bpm: 100,
    songKey: null,
    locked: false,
    onSpeed: vi.fn(),
    onSemitones: vi.fn(),
    onTone: vi.fn(),
    onClick: vi.fn(),
    onClickOn: vi.fn(),
    canClick: true,
    onReset: vi.fn(),
    ...over
  }
  render(<MusicPanel {...props} />)
  return props
}

const bpmField = (): HTMLElement => screen.getByRole('textbox', { name: t('music.typeBpm') })

describe('MusicPanel', () => {
  it('shows the tempo as it plays now', () => {
    renderPanel({ speed: 1.1, semitones: 0 })
    expect(bpmField()).toHaveValue('110')
  })

  it('speeds the music up to a typed tempo', async () => {
    const { onSpeed } = renderPanel()
    await userEvent.type(bpmField(), '120{Enter}')
    expect(onSpeed).toHaveBeenCalledWith(1.2)
  })

  it('shows the speed as a percentage when the tempo is unknown', () => {
    renderPanel({ speed: 0.9, semitones: 0 }, { bpm: null })
    expect(screen.getByRole('textbox', { name: t('music.typeSpeed') })).toHaveValue('90')
  })

  it('moves the key with its knob, as one undo step per turn', () => {
    const { onSemitones } = renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: t('music.key') }), {
      target: { value: '2' }
    })
    expect(onSemitones).toHaveBeenCalledWith(2, 'music-key')
  })

  it('names the key beside the Key knob, with no separate note', () => {
    renderPanel({ speed: 1, semitones: 2 }, { songKey: { tonic: 2, mode: 'major' } })
    expect(screen.getByText('D major')).toBeInTheDocument()
    expect(screen.queryByText(/^Now in/)).not.toBeInTheDocument()
  })

  it('goes back to the original speed and key', async () => {
    const { onReset } = renderPanel({ speed: 1.1, semitones: -2 })
    await userEvent.click(screen.getByRole('button', { name: t('music.reset') }))
    expect(onReset).toHaveBeenCalled()
  })

  it('puts the speed back on its own, leaving the key', async () => {
    const { onSpeed, onSemitones } = renderPanel({ speed: 1.2, semitones: 2 })
    await userEvent.click(screen.getByRole('button', { name: t('music.resetSpeed') }))
    expect(onSpeed).toHaveBeenCalledWith(1)
    expect(onSemitones).not.toHaveBeenCalled()
  })

  it('takes a typed key change', async () => {
    const { onSemitones } = renderPanel()
    await userEvent.type(screen.getByRole('textbox', { name: t('music.typeKey') }), '−3{Enter}')
    expect(onSemitones).toHaveBeenCalledWith(-3)
  })

  it('turns the bass down, as one undo step per turn', () => {
    const { onTone } = renderPanel()
    fireEvent.change(screen.getByRole('slider', { name: t('music.bass') }), {
      target: { value: '-3' }
    })
    expect(onTone).toHaveBeenCalledWith({ bassDb: -3 }, 'music-bassDb')
  })

  it('switches the metronome on, and sets how loud it is', async () => {
    const { onClickOn, onClick } = renderPanel()
    await userEvent.click(screen.getByRole('switch', { name: t('music.clickOn') }))
    expect(onClickOn).toHaveBeenCalledWith(true)
    fireEvent.change(screen.getByRole('slider', { name: t('music.click') }), {
      target: { value: '40' }
    })
    expect(onClick).toHaveBeenCalledWith(0.4, 'music-click')
  })

  it('offers no click when there is no beat to follow', () => {
    renderPanel({}, { canClick: false })
    expect(screen.getByRole('slider', { name: t('music.click') })).toBeDisabled()
  })
})
