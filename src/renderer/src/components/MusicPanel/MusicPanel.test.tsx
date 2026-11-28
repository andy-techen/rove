import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Mock, describe, expect, it, vi } from 'vitest'
import { CopyKey, t } from '@shared/copy'
import { MusicSettings } from '../../state/song/project'
import type { VocalsState } from '../../state/processing/useVocalRemoval'
import { keyName, noteWithOctave } from '../../state/chords/theory/noteNames'
import { Snackbar } from '../ui/Snackbar'
import { MusicPanel } from '.'
import { formatSigned } from './musicFormat'

const vocalsIn = (state: VocalsState) => ({
  state,
  onRemove: vi.fn(),
  onCancel: vi.fn(),
  onPutBack: vi.fn()
})

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
    onReset: vi.fn(),
    vocals: vocalsIn({ state: 'with' }),
    onHide: vi.fn(),
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

  it('shows just the key when it is unchanged, and the shift once it moves', () => {
    const key = { tonic: 8, mode: 'major' as const }
    renderPanel({ speed: 1, semitones: 0 }, { songKey: key })
    expect(screen.getByText('A♭ major')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: t('music.typeKey') })).not.toBeInTheDocument()
    cleanup()
    renderPanel({ speed: 1, semitones: 2 }, { songKey: { tonic: 10, mode: 'major' } })
    expect(screen.getByText('B♭ major')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: t('music.typeKey') })).toHaveValue('+2')
  })

  it.each<{
    does: string
    button: CopyKey
    music?: Partial<MusicSettings>
    vocals?: VocalsState
    spy: (props: ReturnType<typeof renderPanel>) => Mock
  }>([
    {
      does: 'goes back to the original speed and key',
      button: 'music.reset',
      music: { speed: 1.1, semitones: -2 },
      spy: (props) => props.onReset
    },
    {
      does: 'removes the vocals from the music on request',
      button: 'music.removeVocals',
      spy: (props) => props.vocals.onRemove
    },
    {
      does: 'restores the vocals once they are removed',
      button: 'music.restoreVocals',
      vocals: { state: 'removed' },
      spy: (props) => props.vocals.onPutBack
    }
  ])('$does', async ({ button, music, vocals, spy }) => {
    const props = renderPanel(music, vocals && { vocals: vocalsIn(vocals) })
    await userEvent.click(screen.getByRole('button', { name: t(button) }))
    expect(spy(props)).toHaveBeenCalled()
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

  it('shows how far removing the vocals has got, and can stop it', async () => {
    const { vocals } = renderPanel({}, { vocals: vocalsIn({ state: 'removing', progress: 0.4 }) })
    expect(screen.getByRole('progressbar', { name: t('music.removingVocals') })).toHaveAttribute(
      'aria-valuenow',
      '40'
    )
    await userEvent.click(screen.getByRole('button', { name: t('music.stopRemovingVocals') }))
    expect(vocals.onCancel).toHaveBeenCalled()
  })

  describe('a key that suits your voice', () => {
    const suggestion = { semitones: -3, sung: { low: 57, high: 69 }, zone: { low: 52, high: 65 } }
    const tip = t('music.suitsYouHigh', {
      shift: formatSigned(-3),
      note: noteWithOctave(69),
      low: noteWithOctave(52),
      high: noteWithOctave(65)
    })

    it('moves the key there when picked, and says so', async () => {
      render(<Snackbar />)
      const songKey = { tonic: 7, mode: 'major' as const }
      const { onSemitones } = renderPanel({}, { keySuggestion: suggestion, songKey })
      await userEvent.click(screen.getByRole('button', { name: tip }))
      expect(onSemitones).toHaveBeenCalledWith(-3)
      const key = keyName({ tonic: 4, mode: 'major' })
      expect(screen.getByText(t('music.suitsYouTaken', { key }))).toBeInTheDocument()
    })

    it('is not offered without one', () => {
      renderPanel()
      expect(screen.queryByRole('button', { name: tip })).not.toBeInTheDocument()
    })
  })
})
