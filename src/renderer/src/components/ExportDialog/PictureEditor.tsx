import { CSSProperties, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { Position, coverCrop } from '../../audio/export/videoLayout'
import {
  BACKGROUNDS,
  BACKGROUND_IDS,
  DEFAULT_TEXT_POSITION,
  FIRST_PICKED_COLOUR,
  TextBox,
  VideoOptions,
  WORDS_SIZE,
  inkOn
} from '../../audio/export/videoFrame'
import { DEFAULT_FONT } from '../../audio/export/videoFonts'
import { SongLyrics, isTimed } from '../../state/lyrics/lyrics'
import { Command, onCommand, typingIn } from '../../state/commands/commands'
import {
  History,
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory
} from '../../state/song/history'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { PictureStage } from './PictureStage'
import { Picture, sceneFor, useDrawing } from './videoHooks'
import './PictureEditor.css'

// Canvas pixels for the picture's swatch: sharp on a Retina screen at swatch size.
const THUMBNAIL_SIZE = 64
// Each new set of words starts a little lower than the last, so they don't stack up.
const NEW_WORDS_STEP = 1 / 6
const NEW_WORDS_LOWEST = 5 / 6

interface Props {
  value: VideoOptions
  onChange(value: VideoOptions): void
  picture: Picture
  lyrics: SongLyrics | null
  onClose(): void
}

/** A large view of the video's picture, with room to place words and pick colours. */
export function PictureEditor({
  value,
  onChange,
  picture,
  lyrics,
  onClose
}: Props): React.JSX.Element {
  const [snap, setSnap] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [pickedColour, setPickedColour] = useState(
    value.background.kind === 'colour' ? value.background.colour : FIRST_PICKED_COLOUR
  )
  const { background, texts } = value
  const timed = lyrics ? isTimed(lyrics) : false
  const [history, setHistory] = useState<History<VideoOptions>>(emptyHistory)

  /**
   * Changes the picture and remembers how it was, for undo. Changes sharing a `key` in a
   * row (one drag, the letters typed into one set of words) undo as a single step.
   */
  const change = (next: VideoOptions, key?: string): void => {
    setHistory((h) => pushHistory(h, value, key))
    onChange(next)
  }
  const travel = (step: typeof undoHistory): void => {
    const moved = step(history, value)
    if (!moved) return
    setHistory(moved.history)
    onChange(moved.value)
  }
  // ⌘Z and ⌘⇧Z step through the picture's changes while it's open. In a text field they
  // belong to the text (the song's command handler sends them there).
  const run = useRef<(command: Command) => void>(() => {})
  useEffect(() => {
    run.current = (command) => {
      if (typingIn(document.activeElement)) return
      if (command === 'undo') travel(undoHistory)
      if (command === 'redo') travel(redoHistory)
    }
  })
  useEffect(() => onCommand((command) => run.current(command)), [])
  const autoInk = inkOn(sceneFor(value, picture.image, null).background)

  const thumbnail = useDrawing(
    (ctx) => {
      const { image } = picture
      if (!image) return
      const { width, height } = ctx.canvas
      const crop = coverCrop(image.width, image.height, width, height)
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
    },
    [picture.image, picture.file]
  )

  const setTexts = (next: TextBox[], key?: string): void => change({ ...value, texts: next }, key)
  const updateText = (id: string, edit: Partial<TextBox>, key?: string): void =>
    setTexts(
      texts.map((box) => (box.id === id ? { ...box, ...edit } : box)),
      key && `${id}:${key}`
    )
  /** New words at `position`, ready to type into. */
  const addWordsAt = (position: Position): void => {
    const box: TextBox = {
      id: crypto.randomUUID(),
      text: '',
      colour: null,
      size: WORDS_SIZE,
      font: DEFAULT_FONT,
      align: 'center',
      width: null,
      position
    }
    // Adding words and typing them is one step, so undo takes away the words as typed.
    setTexts([...texts, box], `${box.id}:type`)
    setSelected(box.id)
    setEditing(box.id)
  }
  /** From the button: below the last words added, so they don't stack up. */
  const addWords = (): void => {
    const y = Math.min(NEW_WORDS_LOWEST, DEFAULT_TEXT_POSITION.y + texts.length * NEW_WORDS_STEP)
    addWordsAt({ x: DEFAULT_TEXT_POSITION.x, y })
  }
  /** Starts or finishes typing; words finished empty are dropped, as on a phone. */
  const edit = (id: string | null): void => {
    const finished = texts.find((box) => box.id === editing)
    if (id === editing) return
    if (finished && id !== finished.id && !finished.text.trim()) {
      setTexts(
        texts.filter((box) => box.id !== finished.id),
        `${finished.id}:type`
      )
      if (selected === finished.id) setSelected(null)
    }
    setEditing(id)
    if (id) setSelected(id)
  }
  const remove = (id: string): void => {
    setTexts(texts.filter((box) => box.id !== id))
    setSelected(null)
    setEditing(null)
  }
  const pickColour = (colour: string): void => {
    setPickedColour(colour)
    change({ ...value, background: { kind: 'colour', colour } }, 'background-colour')
  }
  const choosePicture = (chosen: File | undefined): void => {
    if (!chosen) return
    picture.choose(chosen)
    change({ ...value, background: { kind: 'picture', file: chosen } })
  }

  return (
    <Dialog
      title={t('export.video.editorTitle')}
      closeLabel={t('export.video.closeEditor')}
      sizeKey="pictureEditor"
      className="picture-editor"
      fill
      onClose={onClose}
    >
      <div className="picture-editor-body">
        <PictureStage
          value={value}
          image={picture.image}
          lyrics={lyrics}
          snap={snap}
          selected={selected}
          editing={editing}
          autoInk={autoInk}
          onSelect={setSelected}
          onEdit={edit}
          onAdd={addWordsAt}
          onChange={updateText}
          onRemove={remove}
          onLyricsChange={(edit, key) =>
            change(
              { ...value, lyricsStyle: { ...value.lyricsStyle, ...edit } },
              key && `lyrics:${key}`
            )
          }
          tools={
            <>
              <IconButton
                icon="text"
                label={t('export.video.addWords')}
                title={t('export.video.addWordsTip')}
                onClick={addWords}
              />
              <IconButton
                icon="snap"
                label={t('export.video.snap')}
                title={t('export.video.snapTip')}
                aria-pressed={snap}
                onClick={() => setSnap(!snap)}
              />
              <IconButton
                icon="lyrics"
                label={t('export.video.lyrics')}
                title={timed ? undefined : t('export.video.lyricsNeedTiming')}
                aria-pressed={value.lyrics && timed}
                disabled={!timed}
                onClick={() => change({ ...value, lyrics: !value.lyrics })}
              />
            </>
          }
        />
        <fieldset className="picture-swatches">
          <legend className="visually-hidden">{t('export.video.background')}</legend>
          {BACKGROUND_IDS.map((id) => (
            <Tooltip key={id} text={t(`export.video.backgrounds.${id}`)}>
              <label
                className="picture-swatch"
                style={
                  {
                    '--swatch-top': BACKGROUNDS[id].top,
                    '--swatch-bottom': BACKGROUNDS[id].bottom
                  } as CSSProperties
                }
              >
                <input
                  type="radio"
                  name="export-background"
                  className="visually-hidden"
                  aria-label={t(`export.video.backgrounds.${id}`)}
                  checked={background.kind === 'blank' && background.id === id}
                  onChange={() => change({ ...value, background: { kind: 'blank', id } })}
                />
              </label>
            </Tooltip>
          ))}
          <Tooltip text={t('export.video.pickColour')}>
            <label
              className="picture-swatch picture-swatch-colour"
              data-picked={background.kind === 'colour' ? '' : undefined}
              style={{ '--swatch-colour': pickedColour } as CSSProperties}
            >
              <input
                type="color"
                className="visually-hidden"
                aria-label={t('export.video.pickColour')}
                value={pickedColour}
                onInput={(e) => pickColour(e.currentTarget.value)}
                onChange={(e) => pickColour(e.target.value)}
              />
              <Icon name="contrast" size="secondary" />
            </label>
          </Tooltip>
          {picture.file && (
            <Tooltip text={t('export.video.yourPicture')}>
              <label className="picture-swatch">
                <canvas
                  ref={thumbnail}
                  className="picture-swatch-thumb"
                  width={THUMBNAIL_SIZE}
                  height={THUMBNAIL_SIZE}
                />
                <input
                  type="radio"
                  name="export-background"
                  className="visually-hidden"
                  aria-label={t('export.video.yourPicture')}
                  checked={background.kind === 'picture'}
                  onChange={() =>
                    picture.file &&
                    change({ ...value, background: { kind: 'picture', file: picture.file } })
                  }
                />
              </label>
            </Tooltip>
          )}
          <Tooltip text={t('export.video.choosePicture')}>
            <label className="picture-swatch picture-swatch-add">
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                aria-label={t('export.video.choosePicture')}
                onChange={(e) => {
                  choosePicture(e.target.files?.[0])
                  // Picking the same file again should still count as a choice.
                  e.target.value = ''
                }}
              />
              <Icon name="plus" size="secondary" />
            </label>
          </Tooltip>
        </fieldset>
      </div>

      <footer className="picture-editor-actions">
        <Button onClick={onClose}>{t('export.video.done')}</Button>
      </footer>
    </Dialog>
  )
}
