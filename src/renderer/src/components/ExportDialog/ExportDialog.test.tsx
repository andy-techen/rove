import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import type { SongLyrics } from '../../state/lyrics/lyrics'
import type { ExportState } from '../../state/song/useExport'
import { DEFAULT_LYRICS_STYLE, DEFAULT_TEXT_POSITION } from '../../audio/export/videoFrame'
import {
  MARGIN,
  VIDEO_WIDTH,
  LYRICS_SIZES,
  WORDS_SIZE,
  WORDS_SIZES
} from '../../audio/export/constants'
import { DEFAULT_FONT, FontId } from '../../audio/export/videoFonts'
import { Align, stepSize } from '../../audio/export/videoLayout'
import { fireMenu } from '../../test/fakeApi'
import { ExportDialog } from '.'

const renderDialog = (
  state: ExportState = { status: 'idle' },
  lyrics: SongLyrics | null = null
) => {
  const props = {
    state,
    lyrics,
    onStart: vi.fn(),
    onReveal: vi.fn(),
    onShare: vi.fn(),
    onExportProject: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn()
  }
  render(<ExportDialog {...props} />)
  return props
}

const timedLyrics = (): SongLyrics => ({
  title: 'Song',
  offsetSec: 0,
  lines: [{ time: 1, text: 'Hello there' }]
})

const chooseVideo = () =>
  userEvent.click(screen.getByRole('radio', { name: new RegExp(t('export.formats.mp4')) }))

const start = () => userEvent.click(screen.getByRole('button', { name: t('export.start') }))

const openEditor = () =>
  userEvent.click(screen.getByRole('button', { name: t('export.video.edit') }))

const finishEditing = () =>
  userEvent.click(screen.getByRole('button', { name: t('export.video.done') }))

/** Adds a set of words in the picture editor and types into it. */
const wordsField = () => screen.getByRole('textbox', { name: t('export.video.wordsField') })

const wordsOnPicture = (text: string) =>
  screen.getByRole('button', { name: t('export.video.wordsOnPicture', { text }) })

/** Adds words to the picture, types them, and finishes with Esc. */
const addWords = async (text: string) => {
  await userEvent.click(screen.getByRole('button', { name: t('export.video.addWords') }))
  if (text) await userEvent.type(wordsField(), text)
  await userEvent.keyboard('{Escape}')
}

const alignButton = (side: Align) =>
  screen.getByRole('button', {
    name: t('export.video.align', { side: t(`export.video.aligns.${side}`) })
  })

const videoOf = (props: ReturnType<typeof renderDialog>) => props.onStart.mock.calls[0][0].video

describe('ExportDialog', () => {
  it('exports a WAV ready for streaming unless told otherwise', async () => {
    const props = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: t('export.start') }))
    expect(props.onStart).toHaveBeenCalledWith({ format: 'wav', loudness: 'streaming' })
  })

  it('exports an MP3 as mixed when chosen', async () => {
    const props = renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(t('export.formats.mp3')) }))
    await userEvent.click(screen.getByRole('radio', { name: t('export.loudnessOptions.asMixed') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.start') }))
    expect(props.onStart).toHaveBeenCalledWith({ format: 'mp3', loudness: 'asMixed' })
  })

  it('shows how far along it is and how long is left while working', () => {
    renderDialog({
      status: 'working',
      stage: { stage: 'encoding', progress: 0.42 },
      timeLeft: { kind: 'min', count: 2 }
    })
    const bar = screen.getByRole('progressbar', { name: t('export.stages.encoding') })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByText(t('export.timeLeft.min', { count: 2 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('export.start') })).toBeDisabled()
  })

  it('names the saved file and its folder, and offers to show it in Finder', async () => {
    const props = renderDialog({ status: 'done', filePath: '/Music/My Song.wav' })
    expect(screen.getByText('My Song.wav')).toBeInTheDocument()
    expect(screen.getByText(t('export.savedIn', { folder: 'Music' }))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('export.reveal') }))
    expect(props.onReveal).toHaveBeenCalled()
  })

  it('goes back to exporting when an option changes after saving', async () => {
    const props = renderDialog({ status: 'done', filePath: '/Music/My Song.wav' })
    await chooseVideo()
    expect(props.onReset).toHaveBeenCalled()
  })

  it('offers to share the saved file, to send it to a phone with AirDrop', async () => {
    const props = renderDialog({ status: 'done', filePath: '/Music/My Song.mp4' })
    await userEvent.click(screen.getByRole('button', { name: t('export.share') }))
    expect(props.onShare).toHaveBeenCalled()
  })

  it('exports a video on a blank background, with no words or lyrics, unless told otherwise', async () => {
    const props = renderDialog()
    await chooseVideo()
    await start()
    expect(props.onStart).toHaveBeenCalledWith({
      format: 'mp4',
      loudness: 'streaming',
      video: {
        background: { kind: 'blank', id: 'goldenHour' },
        texts: [],
        lyrics: false,
        lyricsStyle: DEFAULT_LYRICS_STYLE
      }
    })
  })

  it('only offers the picture editor for a video', async () => {
    renderDialog()
    expect(screen.queryByRole('button', { name: t('export.video.edit') })).not.toBeInTheDocument()
    await chooseVideo()
    await openEditor()
    expect(screen.getByRole('dialog', { name: t('export.video.editorTitle') })).toBeInTheDocument()
  })

  it('puts the singer’s own picture on the video', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    const picture = new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText(t('export.video.choosePicture')), picture)
    await finishEditing()
    await start()
    expect(videoOf(props).background).toEqual({ kind: 'picture', file: picture })
  })

  it('switches back to an offered background after picking a picture', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    const picture = new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText(t('export.video.choosePicture')), picture)
    await userEvent.click(
      screen.getByRole('radio', { name: t('export.video.backgrounds.evening') })
    )
    await finishEditing()
    await start()
    expect(videoOf(props).background).toEqual({ kind: 'blank', id: 'evening' })
  })

  it('puts the video on a colour the singer picks', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    fireEvent.input(screen.getByLabelText(t('export.video.pickColour')), {
      target: { value: '#336699' }
    })
    await finishEditing()
    await start()
    expect(videoOf(props).background).toEqual({ kind: 'colour', colour: '#336699' })
  })

  it('adds several sets of words, each over more than one line', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('For Mum{Enter}with love')
    await addWords('Live from my room')
    await finishEditing()
    await start()
    expect(videoOf(props).texts.map((box: { text: string }) => box.text)).toEqual([
      'For Mum\nwith love',
      'Live from my room'
    ])
  })

  it('drops words left empty', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('')
    await finishEditing()
    await start()
    expect(videoOf(props).texts).toEqual([])
  })

  it('changes words when they’re clicked on the picture', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    await userEvent.type(wordsField(), ' there{Escape}')
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].text).toBe('Hi there')
  })

  it('colours and removes words from the bar beside them', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Keep')
    await addWords('Drop')
    await userEvent.click(wordsOnPicture('Keep'))
    fireEvent.input(screen.getByLabelText(t('export.video.wordsColour')), {
      target: { value: '#ffffff' }
    })
    await userEvent.click(wordsOnPicture('Drop'))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.removeWords') }))
    await finishEditing()
    await start()
    expect(videoOf(props).texts).toEqual([
      expect.objectContaining({ text: 'Keep', colour: '#ffffff' })
    ])
  })

  it('makes words larger and smaller from the bar beside them', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    const larger = screen.getByRole('button', { name: t('export.video.larger') })
    await userEvent.click(larger)
    await userEvent.click(larger)
    await userEvent.click(screen.getByRole('button', { name: t('export.video.smaller') }))
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].size).toBe(stepSize(WORDS_SIZE, WORDS_SIZES, 1))
  })

  it('sets words in a font picked from the bar beside them', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    const fontName = (id: FontId) => t(`export.video.fonts.${id}`)
    const fontButton = screen.getByRole('button', {
      name: t('export.video.font', { name: fontName(DEFAULT_FONT) })
    })
    await userEvent.click(fontButton)
    expect(fontButton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: fontName('typewriter') }))
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].font).toBe('typewriter')
  })

  it('picks a font for new words before typing them', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.addWords') }))
    await userEvent.click(
      screen.getByRole('button', {
        name: t('export.video.font', { name: t(`export.video.fonts.${DEFAULT_FONT}`) })
      })
    )
    await userEvent.click(screen.getByRole('button', { name: t('export.video.fonts.typewriter') }))
    await userEvent.keyboard('Hi{Escape}')
    await finishEditing()
    await start()
    expect(videoOf(props).texts).toEqual([
      expect.objectContaining({ text: 'Hi', font: 'typewriter' })
    ])
  })

  it('narrows words by moving their right edge in', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    await userEvent.keyboard('{Escape}')
    screen.getByRole('separator', { name: t('export.video.wordsEdges.right') }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].width).toBeLessThan(VIDEO_WIDTH - MARGIN * 2)
  })

  it('undoes and redoes changes to the picture one at a time', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    await userEvent.keyboard('{Escape}')
    const larger = screen.getByRole('button', { name: t('export.video.larger') })
    await userEvent.click(larger)
    await userEvent.click(larger)
    fireMenu('undo')
    fireMenu('undo')
    fireMenu('redo')
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].size).toBe(stepSize(WORDS_SIZE, WORDS_SIZES, 1))
  })

  it('moves the words in small steps with the arrow keys', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    wordsOnPicture('Hi').focus()
    await userEvent.keyboard('{ArrowDown}')
    await finishEditing()
    await start()
    const { y } = videoOf(props).texts[0].position
    expect(y).toBeGreaterThan(DEFAULT_TEXT_POSITION.y)
    expect(y).toBeLessThan(DEFAULT_TEXT_POSITION.y + 0.05)
  })

  it('shows the lyrics on the video when switched on', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await finishEditing()
    await start()
    expect(videoOf(props).lyrics).toBe(true)
  })

  it('sets the lyrics in a font picked from the lyrics on the picture', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    await userEvent.click(
      screen.getByRole('button', {
        name: t('export.video.font', { name: t(`export.video.fonts.${DEFAULT_FONT}`) })
      })
    )
    await userEvent.click(screen.getByRole('button', { name: t('export.video.fonts.kaiti') }))
    await finishEditing()
    await start()
    expect(videoOf(props).lyricsStyle.font).toBe('kaiti')
  })

  it('makes the lyrics larger and smaller from the bar above them', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    const larger = screen.getByRole('button', { name: t('export.video.lyricsLarger') })
    await userEvent.click(larger)
    await userEvent.click(larger)
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsSmaller') }))
    await finishEditing()
    await start()
    expect(videoOf(props).lyricsStyle.size).toBe(
      stepSize(DEFAULT_LYRICS_STYLE.size, LYRICS_SIZES, 1)
    )
  })

  it('moves the lyrics with the arrow keys', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }).focus()
    await userEvent.keyboard('{ArrowUp}')
    await finishEditing()
    await start()
    const { position } = videoOf(props).lyricsStyle
    expect(position.y).toBeLessThan(DEFAULT_LYRICS_STYLE.position.y)
    expect(position.x).toBe(DEFAULT_LYRICS_STYLE.position.x)
  })

  it('lines the lyrics up on the right, against the right margin', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    await userEvent.click(alignButton('center'))
    await finishEditing()
    await start()
    const { align, position } = videoOf(props).lyricsStyle
    expect(align).toBe('right')
    expect(position.x).toBe((VIDEO_WIDTH - MARGIN) / VIDEO_WIDTH)
  })

  it('lines words up left, centre or right from the bar beside them', async () => {
    const props = renderDialog()
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    await userEvent.click(alignButton('center'))
    await userEvent.click(alignButton('right'))
    await finishEditing()
    await start()
    expect(videoOf(props).texts[0].align).toBe('left')
  })

  it('narrows the lyrics by moving their right edge in', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    screen.getByRole('separator', { name: t('export.video.lyricsEdges.right') }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    await finishEditing()
    await start()
    expect(videoOf(props).lyricsStyle.width).toBeLessThan(VIDEO_WIDTH - MARGIN * 2)
  })

  it('fits the lyrics to the frame again when an edge is double-clicked', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    const edge = screen.getByRole('separator', { name: t('export.video.lyricsEdges.left') })
    edge.focus()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.dblClick(edge)
    await finishEditing()
    await start()
    const { width, position } = videoOf(props).lyricsStyle
    expect(width).toBeNull()
    expect(position.x).toBe(DEFAULT_LYRICS_STYLE.position.x)
  })

  it('colours the lyrics from the bar above them', async () => {
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    fireEvent.input(screen.getByLabelText(t('export.video.lyricsColour')), {
      target: { value: '#ffffff' }
    })
    await finishEditing()
    await start()
    expect(videoOf(props).lyricsStyle.colour).toBe('#ffffff')
  })

  it('offers a colour picked for words again for the lyrics', async () => {
    localStorage.clear()
    const props = renderDialog({ status: 'idle' }, timedLyrics())
    await chooseVideo()
    await openEditor()
    await addWords('Hi')
    await userEvent.click(wordsOnPicture('Hi'))
    fireEvent.change(screen.getByLabelText(t('export.video.wordsColour')), {
      target: { value: '#123456' }
    })
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyrics') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.video.lyricsOnPicture') }))
    await userEvent.click(
      screen.getByRole('button', { name: t('export.video.recentColour', { colour: '#123456' }) })
    )
    await finishEditing()
    await start()
    expect(videoOf(props).lyricsStyle.colour).toBe('#123456')
  })

  it('can’t show lyrics that have no timing', async () => {
    renderDialog({ status: 'idle' }, { ...timedLyrics(), lines: [{ time: null, text: 'Hi' }] })
    await chooseVideo()
    await openEditor()
    expect(screen.getByRole('button', { name: t('export.video.lyrics') })).toBeDisabled()
  })

  it('exports the whole project as one file when Rove project is the format', async () => {
    const { onExportProject, onStart } = renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(t('songFile.formatName')) }))
    expect(screen.queryByText(t('export.loudness'))).not.toBeInTheDocument()
    await start()
    expect(onExportProject).toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
  })
})
