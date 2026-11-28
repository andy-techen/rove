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
import { Align, Edges, Guides, Position, alignTo, placeBlock } from '../../audio/export/videoLayout'
import {
  LINE_HEIGHT,
  MARGIN,
  TextBox,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VideoOptions,
  WEIGHT_WORDS,
  drawVideoFrame,
  layoutWords,
  LyricsStyle,
  clampLyrics,
  fitLyrics,
  layoutLyrics,
  resizeLyrics,
  resizeWords,
  lyricsArea
} from '../../audio/export/videoFrame'
import { fontFamilyOf } from '../../audio/export/videoFonts'
import { SongLyrics } from '../../state/lyrics/lyrics'
import { EdgeHandles, Side } from './EdgeHandles'
import { LyricsBar } from './LyricsBar'
import { previewTime, sceneFor, fontsOnThisMachine, useDrawing } from './videoHooks'
import { WordsBar } from './WordsBar'

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
  /** How far the field being typed in moves down to sit where the video draws the words. */
  nudge?: number
}

// Which way the field being typed in grows: words typed into left-aligned lines run right.
const TYPING_ROOM: Record<Align, number> = { left: 1, center: 0, right: -1 }

/** What `selected` holds while the lyrics are chosen; words have random ids. */
export const LYRICS_SELECTED = 'lyrics'

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
  onLyricsChange(change: Partial<LyricsStyle>): void
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
  onLyricsChange,
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
  const fonts = fontsOnThisMachine()
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

  const lyricsShown = value.lyrics && lyrics !== null
  const lyricsChosen = lyricsShown && selected === LYRICS_SELECTED
  /** Where the lyrics sit in `style`: both lines, however they wrap. */
  const lyricsRectFor = (style: LyricsStyle): Rect => {
    const measured = lyrics && measure && layoutLyrics(measure, lyrics, style, previewTime(lyrics))
    return measured && measured.height ? measured : lyricsArea(style)
  }

  /**
   * Where something dragged (words, or the lyrics: `id`) lands: pulled onto the centre
   * lines and the other words and lyrics when close. `rectAt` says where it would sit.
   */
  const aligned = (
    id: string,
    position: Position,
    rectAt: (position: Position) => Rect,
    free: boolean
  ): Position => {
    const at = inFrame(position)
    if (!snap || free) {
      setGuides(NO_GUIDES)
      return at
    }
    const others = value.texts.filter((b) => b.id !== id).map((b) => rectOf(measure, b))
    if (lyricsShown && id !== LYRICS_SELECTED) others.push(lyricsRectFor(value.lyricsStyle))
    const pull = alignTo(rectAt(at), others, FRAME, SNAP_DISTANCE)
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

  /** A press on words or the lyrics (`id`), which sit at `position`: chooses them. */
  const onPressDown = (e: PointerEvent<HTMLDivElement>, id: string, position: Position): void => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const point = pointOf(e)
    press.current = {
      id,
      start: { x: e.clientX, y: e.clientY },
      offset: { x: position.x - point.x, y: position.y - point.y },
      moved: false
    }
    onSelect(id)
  }

  const onWordsMove = (e: PointerEvent<HTMLDivElement>): void => {
    const held = press.current
    if (!held) return
    const travelled = Math.hypot(e.clientX - held.start.x, e.clientY - held.start.y)
    if (!held.moved && travelled < DRAG_START_PX) return
    held.moved = true
    setDragging(true)
    const point = pointOf(e)
    const wanted = { x: point.x + held.offset.x, y: point.y + held.offset.y }
    // ⌘ while dragging places things freely, as in design tools.
    if (held.id === LYRICS_SELECTED) {
      const rectAt = (at: Position): Rect =>
        lyricsRectFor({ ...value.lyricsStyle, position: lyricsWithin(at) })
      const at = aligned(held.id, lyricsWithin(wanted), rectAt, e.metaKey)
      onLyricsChange({ position: lyricsWithin(at) })
      return
    }
    const box = value.texts.find((b) => b.id === held.id)
    if (!box) return
    const rectAt = (at: Position): Rect => rectOf(measure, { ...box, position: at })
    onChange(held.id, { position: aligned(held.id, wanted, rectAt, e.metaKey) })
  }

  const onWordsUp = (): void => {
    const held = press.current
    press.current = null
    setDragging(false)
    setGuides(NO_GUIDES)
    if (held && !held.moved && held.id !== LYRICS_SELECTED) onEdit(held.id)
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
    const moved = nudged(e, box.position)
    if (!moved) return
    onSelect(box.id)
    onChange(box.id, { position: inFrame(moved) })
  }

  /** Where an arrow key moves something at `position`, or null for any other key. */
  const nudged = (e: KeyboardEvent, position: Position): Position | null => {
    const step = ARROWS[e.key]
    if (!step) return null
    e.preventDefault()
    const by = e.shiftKey ? NUDGE_FAR : NUDGE
    return { x: position.x + step.x * by, y: position.y + step.y * by }
  }

  /** Lyrics moved to `position`, kept where their lines still have room. */
  const lyricsWithin = (position: Position): Position =>
    clampLyrics({ ...value.lyricsStyle, position: inFrame(position) })

  /** Which side of which box (words, or the lyrics) is being dragged to set its width. */
  const resizing = useRef<{ id: string; side: Side } | null>(null)
  const edgesOf = (rect: Rect): Edges => ({
    left: rect.x - rect.width / 2,
    right: rect.x + rect.width / 2
  })
  /** Moves one side of a box (words, or the lyrics: `id`) to `to`, in video pixels. */
  const resizeTo = (id: string, side: Side, to: number): void => {
    if (id === LYRICS_SELECTED) {
      onLyricsChange(resizeLyrics(value.lyricsStyle, edgesOf(lyricsRect), side, to))
      return
    }
    const box = value.texts.find((b) => b.id === id)
    if (box) onChange(id, resizeWords(box, edgesOf(rectOf(measure, box)), side, to))
  }
  const rectFor = (id: string): Rect | null => {
    if (id === LYRICS_SELECTED) return lyricsRect
    const box = value.texts.find((b) => b.id === id)
    return box ? rectOf(measure, box) : null
  }

  const onEdgeDown = (e: PointerEvent<HTMLDivElement>, id: string, side: Side): void => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    resizing.current = { id, side }
    setDragging(true)
  }
  const onEdgeMove = (e: PointerEvent<HTMLDivElement>): void => {
    const held = resizing.current
    if (!held) return
    // The grip sits on the box's padded outline, so the lines' edge is a pad inside it.
    const pad = held.side === 'left' ? GRAB_PAD : -GRAB_PAD
    resizeTo(held.id, held.side, pointOf(e).x * VIDEO_WIDTH + pad)
  }
  const onEdgeUp = (): void => {
    resizing.current = null
    setDragging(false)
  }
  const onEdgeKey = (e: KeyboardEvent, id: string, side: Side): void => {
    const step = ARROWS[e.key]
    const rect = rectFor(id)
    if (!step?.x || !rect) return
    e.preventDefault()
    const by = (e.shiftKey ? NUDGE_FAR : NUDGE) * VIDEO_WIDTH * step.x
    resizeTo(id, side, edgesOf(rect)[side] + by)
  }

  const onLyricsKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(LYRICS_SELECTED)
      return
    }
    const moved = nudged(e, value.lyricsStyle.position)
    if (!moved) return
    onSelect(LYRICS_SELECTED)
    onLyricsChange({ position: lyricsWithin(moved) })
  }

  const chosen = value.texts.find((box) => box.id === selected)
  const chosenRect = chosen && rectOf(measure, chosen)
  // Both lines, however they wrap, so it's clear the setting covers all the lyrics.
  const lyricsRect = lyricsRectFor(value.lyricsStyle)

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
                      // Words that fit their lines get a letter's room to type into, on the
                      // side the lines run to; sized words wrap where the video will.
                      ...(box.width === null
                        ? placement(
                            { ...rect, x: rect.x + (TYPING_ROOM[box.align] * box.size) / 2 },
                            0,
                            box.size
                          )
                        : placement(rect, 0)),
                      '--words-align': box.align,
                      '--words-size': box.size,
                      '--words-font': fontFamilyOf(box.font),
                      '--words-nudge': rect.nudge ?? 0,
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
                  onBlur={(e) => {
                    // Picking a colour for the words isn't finishing them; a click on the
                    // picture still does.
                    if (!(e.relatedTarget as Element | null)?.closest('.picture-words-bar')) {
                      onEdit(null)
                    }
                  }}
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
                onPointerDown={(e) => onPressDown(e, box.id, box.position)}
                onPointerMove={onWordsMove}
                onPointerUp={onWordsUp}
                onPointerCancel={onWordsUp}
                onKeyDown={(e) => onWordsKey(e, box)}
              />
            )
          })}

          {lyricsShown && (
            <div
              className="picture-words"
              role="button"
              tabIndex={0}
              aria-label={t('export.video.lyricsOnPicture')}
              data-selected={selected === LYRICS_SELECTED ? '' : undefined}
              style={placement(lyricsRect, GRAB_PAD)}
              onPointerDown={(e) => onPressDown(e, LYRICS_SELECTED, value.lyricsStyle.position)}
              onPointerMove={onWordsMove}
              onPointerUp={onWordsUp}
              onPointerCancel={onWordsUp}
              onKeyDown={onLyricsKey}
            />
          )}
          {lyricsChosen && (
            <EdgeHandles
              placement={placement(lyricsRect, GRAB_PAD)}
              label={(side) => t(`export.video.lyricsEdges.${side}`)}
              onDown={(e, side) => onEdgeDown(e, LYRICS_SELECTED, side)}
              onMove={onEdgeMove}
              onUp={onEdgeUp}
              onKey={(e, side) => onEdgeKey(e, LYRICS_SELECTED, side)}
              onFit={() => onLyricsChange(fitLyrics(value.lyricsStyle))}
            />
          )}
          {lyricsChosen && !dragging && (
            <LyricsBar
              style={value.lyricsStyle}
              autoInk={autoInk}
              top={lyricsRect.top / VIDEO_HEIGHT}
              placement={placement(lyricsRect, GRAB_PAD)}
              fonts={fonts}
              onChange={onLyricsChange}
            />
          )}

          {chosen && chosenRect && chosen.id !== editing && (
            <EdgeHandles
              placement={placement(chosenRect, GRAB_PAD)}
              label={(side) => t(`export.video.wordsEdges.${side}`)}
              onDown={(e, side) => onEdgeDown(e, chosen.id, side)}
              onMove={onEdgeMove}
              onUp={onEdgeUp}
              onKey={(e, side) => onEdgeKey(e, chosen.id, side)}
              onFit={() => onChange(chosen.id, { width: null })}
            />
          )}
          {chosen && chosenRect && !dragging && (
            <WordsBar
              key={chosen.id}
              box={chosen}
              top={chosenRect.top / VIDEO_HEIGHT}
              placement={placement(chosenRect, GRAB_PAD)}
              autoInk={autoInk}
              fonts={fonts}
              onChange={(change) => onChange(chosen.id, change)}
              onRemove={() => onRemove(chosen.id)}
            />
          )}
        </div>
        <div className="picture-stage-tools">{tools}</div>
      </div>
    </div>
  )
}
