import {
  CSSProperties,
  ReactNode,
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { t } from '@shared/copy'
import { Guides, Position, alignTo, placeBlock, stepSize } from '../../audio/export/videoLayout'
import {
  LINE_HEIGHT,
  MARGIN,
  TextBox,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VideoOptions,
  WEIGHT_WORDS,
  WORDS_SIZES,
  drawVideoFrame,
  layoutWords
} from '../../audio/export/videoFrame'
import { SongLyrics } from '../../state/lyrics/lyrics'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { previewTime, sceneFor, useDrawing } from './videoHooks'

// An arrow key moves words this share of the frame; Shift, further.
const NUDGE = 0.02
const NUDGE_FAR = 0.1
const ARROWS: Record<string, Position> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }
}
// Screen pixels a press must travel before it's a drag rather than a click to edit.
const DRAG_START_PX = 4
// Room around words that still grabs them, in video pixels. The field being typed in gets
// a letter's width spare, so it wraps where the video will.
const GRAB_PAD = 24
// An empty set of words, or one jsdom can't measure, is this many letters wide.
const EMPTY_LETTERS = 3
const FRAME = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, margin: MARGIN }
// Words this near the top get their colour and remove bar below them instead of above.
const BAR_BELOW_TOP = 0.12
// Long enough for a title and a dedication, short enough to stay a few lines on a phone.
const WORDS_MAX_LENGTH = 120

// How near (in video pixels) words must come to a line before they're pulled onto it:
// about six screen pixels at the editor's usual size.
const SNAP_DISTANCE = 24
const NO_GUIDES: Guides = { x: null, y: null }

const unit = (n: number): number => Math.min(1, Math.max(0, n))

interface Rect {
  /** Centre, in video pixels. */
  x: number
  top: number
  width: number
  height: number
}

/** Where a set of words sits, measured as the video draws it. */
function rectOf(ctx: CanvasRenderingContext2D | null, box: TextBox): Rect {
  const layout = ctx && layoutWords(ctx, box)
  if (layout) return layout
  const width = box.size * EMPTY_LETTERS
  const height = box.size * LINE_HEIGHT
  const { x, top } = placeBlock(box.position, width, height, FRAME)
  return { x, top, width, height }
}

/** A rect as the CSS custom properties the overlay places itself with, as frame fractions. */
function placement(rect: Rect, pad: number, extraWidth = 0): CSSProperties {
  const width = Math.min(rect.width + extraWidth, VIDEO_WIDTH - MARGIN * 2)
  return {
    '--left': (rect.x - width / 2 - pad) / VIDEO_WIDTH,
    '--top': (rect.top - pad) / VIDEO_HEIGHT,
    '--width': (width + pad * 2) / VIDEO_WIDTH,
    '--height': (rect.height + pad * 2) / VIDEO_HEIGHT
  } as CSSProperties
}

interface Props {
  value: VideoOptions
  image: ImageBitmap | null
  lyrics: SongLyrics | null
  snap: boolean
  selected: string | null
  editing: string | null
  /** The colour words take when the singer hasn't picked one. */
  autoInk: string
  onSelect(id: string | null): void
  onEdit(id: string | null): void
  onAdd(position: Position): void
  onChange(id: string, change: Partial<TextBox>): void
  onRemove(id: string): void
  /** Tools down the side of the picture, as in a phone's story editor. */
  tools: ReactNode
}

/**
 * The picture at full height, where words are typed in place, clicked to change and
 * dragged to move, as in a phone's story editor. The video's own drawing shows them;
 * an invisible layer on top makes each one something to click, focus and drag.
 */
export function PictureStage({
  value,
  image,
  lyrics,
  snap,
  selected,
  editing,
  autoInk,
  onSelect,
  onEdit,
  onAdd,
  onChange,
  onRemove,
  tools
}: Props): React.JSX.Element {
  // Measures words exactly as the video draws them (null in jsdom).
  const measure = useMemo(() => document.createElement('canvas').getContext('2d'), [])
  const press = useRef<{ id: string; start: Position; offset: Position; moved: boolean } | null>(
    null
  )
  const [dragging, setDragging] = useState(false)
  const [guides, setGuides] = useState<Guides>(NO_GUIDES)
  const words = useRef(new Map<string, HTMLDivElement>())
  const lastEdited = useRef<string | null>(null)

  const canvas = useDrawing(
    (ctx) =>
      drawVideoFrame(
        ctx,
        sceneFor(value, image, lyrics),
        previewTime(lyrics),
        editing ?? undefined
      ),
    [value, image, lyrics, editing]
  )

  // After typing, focus goes back to the words just changed, so the keyboard stays there.
  useEffect(() => {
    if (editing) lastEdited.current = editing
    else if (lastEdited.current) {
      words.current.get(lastEdited.current)?.focus()
      lastEdited.current = null
    }
  }, [editing])

  const inFrame = (position: Position): Position => ({ x: unit(position.x), y: unit(position.y) })

  /** Where dragged words land: pulled onto the centre lines and other words when close. */
  const aligned = (box: TextBox, position: Position, free: boolean): Position => {
    const at = inFrame(position)
    if (!snap || free) {
      setGuides(NO_GUIDES)
      return at
    }
    const others = value.texts.filter((b) => b.id !== box.id).map((b) => rectOf(measure, b))
    const pull = alignTo(rectOf(measure, { ...box, position: at }), others, FRAME, SNAP_DISTANCE)
    setGuides(pull.guides)
    return inFrame({ x: at.x + pull.dx / VIDEO_WIDTH, y: at.y + pull.dy / VIDEO_HEIGHT })
  }

  const frameRect = (e: PointerEvent<HTMLElement>): DOMRect =>
    (e.currentTarget.closest('.picture-stage-frame') ?? e.currentTarget).getBoundingClientRect()
  const pointOf = (e: PointerEvent<HTMLElement>): Position => {
    const box = frameRect(e)
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height }
  }

  const onFrameDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget && !(e.target instanceof HTMLCanvasElement)) return
    // Otherwise the press would move focus off the words it's about to open for typing.
    e.preventDefault()
    // A click on empty picture finishes what's being typed; otherwise it adds words there.
    if (editing) onEdit(null)
    else onAdd(inFrame(pointOf(e)))
  }

  const onWordsDown = (e: PointerEvent<HTMLDivElement>, box: TextBox): void => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const point = pointOf(e)
    press.current = {
      id: box.id,
      start: { x: e.clientX, y: e.clientY },
      offset: { x: box.position.x - point.x, y: box.position.y - point.y },
      moved: false
    }
    onSelect(box.id)
  }

  const onWordsMove = (e: PointerEvent<HTMLDivElement>): void => {
    const held = press.current
    if (!held) return
    const travelled = Math.hypot(e.clientX - held.start.x, e.clientY - held.start.y)
    if (!held.moved && travelled < DRAG_START_PX) return
    held.moved = true
    setDragging(true)
    const point = pointOf(e)
    const box = value.texts.find((b) => b.id === held.id)
    if (!box) return
    const wanted = { x: point.x + held.offset.x, y: point.y + held.offset.y }
    // ⌘ while dragging places words freely, as in design tools.
    onChange(held.id, { position: aligned(box, wanted, e.metaKey) })
  }

  const onWordsUp = (): void => {
    const held = press.current
    press.current = null
    setDragging(false)
    setGuides(NO_GUIDES)
    if (held && !held.moved) onEdit(held.id)
  }

  const onWordsKey = (e: KeyboardEvent, box: TextBox): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEdit(box.id)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(box.id)
      return
    }
    const step = ARROWS[e.key]
    if (!step) return
    e.preventDefault()
    onSelect(box.id)
    const by = e.shiftKey ? NUDGE_FAR : NUDGE
    const { x, y } = box.position
    onChange(box.id, { position: inFrame({ x: x + step.x * by, y: y + step.y * by }) })
  }

  const chosen = value.texts.find((box) => box.id === selected)
  const chosenRect = chosen && rectOf(measure, chosen)

  return (
    <div className="picture-stage">
      <div className="picture-stage-wrap">
        <div
          className="picture-stage-frame"
          style={{ '--video-width': VIDEO_WIDTH } as CSSProperties}
          onPointerDown={onFrameDown}
        >
          <canvas
            ref={canvas}
            className="picture-stage-canvas"
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            role="img"
            aria-label={t('export.video.preview')}
          />
          {guides.x !== null && (
            <div
              className="picture-guide picture-guide-across"
              aria-hidden="true"
              style={{ '--at': guides.x / VIDEO_WIDTH } as CSSProperties}
            />
          )}
          {guides.y !== null && (
            <div
              className="picture-guide picture-guide-down"
              aria-hidden="true"
              style={{ '--at': guides.y / VIDEO_HEIGHT } as CSSProperties}
            />
          )}

          {value.texts.map((box) => {
            const rect = rectOf(measure, box)
            const colour = box.colour ?? autoInk
            if (box.id === editing) {
              return (
                <textarea
                  key={box.id}
                  className="picture-words-field"
                  aria-label={t('export.video.wordsField')}
                  style={
                    {
                      ...placement(rect, 0, box.size),
                      '--words-size': box.size,
                      '--words-weight': WEIGHT_WORDS,
                      '--words-line': LINE_HEIGHT,
                      '--words-colour': colour
                    } as CSSProperties
                  }
                  // The singer just asked to type here.
                  autoFocus
                  maxLength={WORDS_MAX_LENGTH}
                  value={box.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onChange(box.id, { text: e.target.value })}
                  onBlur={() => onEdit(null)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Escape') return
                    // Esc finishes typing; it shouldn't also close the editor.
                    e.preventDefault()
                    e.stopPropagation()
                    onEdit(null)
                  }}
                />
              )
            }
            return (
              <div
                key={box.id}
                ref={(el) => {
                  if (el) words.current.set(box.id, el)
                  else words.current.delete(box.id)
                }}
                className="picture-words"
                role="button"
                tabIndex={0}
                aria-label={t('export.video.wordsOnPicture', { text: box.text })}
                data-selected={box.id === selected ? '' : undefined}
                style={placement(rect, GRAB_PAD)}
                onPointerDown={(e) => onWordsDown(e, box)}
                onPointerMove={onWordsMove}
                onPointerUp={onWordsUp}
                onPointerCancel={onWordsUp}
                onKeyDown={(e) => onWordsKey(e, box)}
              />
            )
          })}

          {chosen && chosenRect && !dragging && (
            <div
              className="picture-words-bar"
              data-below={chosenRect.top / VIDEO_HEIGHT < BAR_BELOW_TOP ? '' : undefined}
              style={placement(chosenRect, GRAB_PAD)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Tooltip text={t('export.video.wordsColour')}>
                <label
                  className="picture-swatch picture-swatch-colour"
                  style={{ '--swatch-colour': chosen.colour ?? autoInk } as CSSProperties}
                >
                  <input
                    type="color"
                    className="visually-hidden"
                    aria-label={t('export.video.wordsColour')}
                    value={chosen.colour ?? autoInk}
                    onInput={(e) => onChange(chosen.id, { colour: e.currentTarget.value })}
                    onChange={(e) => onChange(chosen.id, { colour: e.target.value })}
                  />
                </label>
              </Tooltip>
              <IconButton
                icon="textSmaller"
                iconSize="secondary"
                label={t('export.video.smaller')}
                disabled={chosen.size <= WORDS_SIZES[0]}
                onClick={() =>
                  onChange(chosen.id, { size: stepSize(chosen.size, WORDS_SIZES, -1) })
                }
              />
              <IconButton
                icon="textLarger"
                iconSize="secondary"
                label={t('export.video.larger')}
                disabled={chosen.size >= WORDS_SIZES[WORDS_SIZES.length - 1]}
                onClick={() => onChange(chosen.id, { size: stepSize(chosen.size, WORDS_SIZES, 1) })}
              />
              <IconButton
                icon="delete"
                iconSize="secondary"
                label={t('export.video.removeWords')}
                onClick={() => onRemove(chosen.id)}
              />
            </div>
          )}
        </div>
        <div className="picture-stage-tools">{tools}</div>
      </div>
    </div>
  )
}
