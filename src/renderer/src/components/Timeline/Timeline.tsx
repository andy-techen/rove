import { CSSProperties, DragEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { ClipGestureKind } from '../../state/editing/clipGestures'
import { TrackRole, VocalPart, sameGroup } from '../../state/song/project'
import { formatDuration } from '../../state/ui/format'
import { ChartPlace, barRange } from '../../state/chords/chart/chart'
import { indexForSlot } from '../../state/tabs/tabOrder'
import {
  ClipRef,
  clipsInBox,
  includesClip,
  fittingShift,
  laneShiftTo,
  shiftLanes
} from '../../state/editing/clipSets'
import { useShortcuts } from '../../state/commands/shortcuts'
import { ChordCellView, LaneView } from '../../state/song/selectors'
import { MenuTarget } from '../../state/commands/contextMenu'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { cx } from '../ui/cx'
import { ClipView, GesturePhase } from './ClipView'
import { TakeOfferBar } from './TakeOfferBar'
import { ClipBlockView } from './ClipBlockView'
import { AddChoice, AddTrackRow } from './AddTrackRow'
import { TrackHeader } from './TrackHeader'
import { SnapView } from '../../state/editing/snapping'
import { formatTick, minorStep } from './timelineMath'
import { useRevealNewTrack } from './useRevealNewTrack'
import { SelectMode, selectMode } from '../../state/editing/trackSelection'
import { MixChange, TrackMix } from './TrackMix'
import { LiveWaveform } from './Waveform'
import { PeakAccumulator } from './timelineMath'
import type { TakeOffer } from '../../state/transport/useTransport'
import { useTimelineView } from './useTimelineView'
import { DRAG_THRESHOLD_PX } from '../../state/ui/constants'
import { CLIP_HEIGHT, CLIP_INSET, LANE_HEIGHT, SNAP_PX } from './constants'
import './Timeline.css'

export interface LiveRecording {
  trackId: string
  /** Timeline position the take started at. */
  startSec: number
  /** Seconds recorded so far. */
  sec: number
  peaks: PeakAccumulator
  sampleRate: number
}

export type { ClipRef }

/** What dragging bar 1 can snap to, from the timeline as it's shown. */
export type BarDragSnap = Pick<SnapView, 'toleranceSec' | 'playheadSec'>

interface Props {
  tracks: LaneView[]
  /** Playhead position in seconds. */
  position: number
  /** Keep the playhead in view (while playing or recording). */
  follow: boolean
  /** Respond to zoom shortcuts (only the visible tab does). */
  keyboard: boolean
  onSeek(sec: number): void
  recording: LiveRecording | null
  /** False while saving, while a song is loading, or before the music is chosen. */
  canRecord: boolean
  onRecord(trackId: string): void
  onStop(): void
  onRestartTake(): void
  /** A just-recorded take whose timing Rove can fix (line up, sync); offered on its lane. */
  offer?: TakeOffer | null
  onApplyOffer?(): void
  onDismissOffer?(): void
  /** Tracks, clips and mix can be changed (not while recording or saving). */
  canEdit: boolean
  /** The singer chose to record without a backing track. */
  skipBacking: boolean
  onRecordWithoutMusic(): void
  onAddBacking(): void
  /** Adds an empty backing track to record music into (an instrument, a beat). */
  onAddRecordedBacking(): void
  /** Adds a chords track, which plays the chords the singer writes. */
  onAddChords(): void
  /** A chord on a chords lane was clicked: open its bar to change it. */
  onPickChord(trackId: string, place: ChartPlace): void
  /** A bar was dragged onto another on a chords lane: they trade places. */
  onSwapBars(trackId: string, from: number, to: number): void
  /**
   * The grip on an instrumental's first bar was dragged `deltaSec` along the timeline:
   * where every instrumental's bars start moves with it, snapping as `snap` allows.
   */
  onMoveBars(phase: GesturePhase, deltaSec: number, snap: BarDragSnap): void
  /** The grip was nudged with an arrow key: bar 1 a little earlier (-1) or later (1). */
  onNudgeBars(direction: -1 | 1): void
  /** The bar open in the Instrumental panel, outlined on its lane. */
  pickedChord?: { trackId: string; place: ChartPlace } | null
  onAddVocal(part: VocalPart): void
  onMix(trackId: string, change: MixChange): void
  /** Selected clips; the last is the one clicked most recently. */
  selectedClips: ClipRef[]
  /** A clip was pressed (null: clicked away); ⌘ or ⇧ adds it to the selection. */
  onSelect(clip: ClipRef | null, mode: SelectMode): void
  /** A box was dragged across the timeline: the clips it touches. */
  onSelectBox(clips: ClipRef[], add: boolean): void
  /** Selected tracks; the last is the one clicked most recently. */
  selectedTrackIds: string[]
  onSelectTrack(trackId: string, mode: SelectMode): void
  /** Right-click on a clip, an empty spot in a lane, or a track's name. */
  onContextMenu(target: MenuTarget, trackId: string, clip: ClipRef | null): void
  onClipGesture(
    clip: ClipRef,
    kind: ClipGestureKind,
    phase: GesturePhase,
    deltaSec: number,
    snap: SnapView,
    /** The lane under the pointer; moved clips drop into it when the drag ends. */
    overTrackId: string | null
  ): void
  /** Where a dragged clip has snapped, shown as a guide line; null when it hasn't. */
  snapAt: number | null
  /** Move a track to place `to` among the tracks of its kind (dragged by its name). */
  onMoveTrack(trackId: string, to: number): void
  /** The track whose name is being edited, if any. */
  renamingTrackId: string | null
  onRenaming(trackId: string | null): void
  onRenameTrack(trackId: string, name: string): void
  /** An empty spot in a lane was clicked: that track becomes where a paste lands. */
  onLaneClick(trackId: string): void
}

const LAYOUT = {
  '--lane-height': `${LANE_HEIGHT}px`,
  '--clip-inset': `${CLIP_INSET}px`
} as CSSProperties

export function Timeline({
  tracks,
  position,
  follow,
  keyboard,
  onSeek,
  recording,
  canRecord,
  onRecord,
  onStop,
  onRestartTake,
  offer,
  onApplyOffer,
  onDismissOffer,
  canEdit,
  skipBacking,
  onRecordWithoutMusic,
  onAddBacking,
  onAddRecordedBacking,
  onAddChords,
  onPickChord,
  pickedChord = null,
  onSwapBars,
  onMoveBars,
  onNudgeBars,
  onAddVocal,
  onMix,
  selectedClips,
  onSelect,
  onSelectBox,
  selectedTrackIds,
  onSelectTrack,
  onContextMenu,
  onClipGesture,
  snapAt,
  onMoveTrack,
  renamingTrackId,
  onRenaming,
  onRenameTrack,
  onLaneClick
}: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const {
    areaRef,
    sectionRef,
    scrollbarRef,
    areaWidth,
    pxPerSec,
    scrollX,
    contentWidth,
    zoomed,
    ticks,
    tickStep,
    minorTicks,
    x,
    secAt,
    zoomIn,
    playheadVisible,
    toPlayhead,
    zoomOut,
    onScrollbar
  } = useTimelineView({
    clipEnds: tracks.flatMap((track) => [
      ...track.clips.map((c) => c.start + c.duration),
      ...(track.chords ?? []).map((c) => c.end)
    ]),
    recordingEnd: recording ? recording.startSec + recording.sec : 0,
    position,
    follow,
    keyboard
  })
  // The music group: files, recordings and chords, in the singer's order.
  const backingTracks = tracks.filter((track) => track.role !== 'vocal')
  const vocalTracks = tracks.filter((track) => track.role === 'vocal')
  const lanesRef = useRef<HTMLDivElement>(null)
  const backingChoices: AddChoice[] = [
    { key: 'file', label: t('timeline.addBacking'), icon: 'folder', onPick: onAddBacking },
    {
      key: 'record',
      label: t('timeline.recordBacking'),
      icon: 'mic',
      onPick: onAddRecordedBacking
    },
    {
      key: 'chords',
      label: t('timeline.addInstrumental'),
      icon: 'instrumental',
      onPick: onAddChords
    }
  ]
  useRevealNewTrack(
    lanesRef,
    tracks.map((track) => track.id)
  )
  /**
   * Drags the playhead: from the ruler, or by grabbing the line itself. Follows the
   * pointer until release, even outside the timeline.
   */
  const scrub = (e: React.PointerEvent<HTMLElement>): void => {
    const area = areaRef.current
    if (e.button !== 0 || !area || pxPerSec <= 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture?.(e.pointerId)
    const seekTo = (clientX: number): void =>
      onSeek(Math.max(0, secAt(clientX - area.getBoundingClientRect().left)))
    seekTo(e.clientX)
    const move = (ev: PointerEvent): void => seekTo(ev.clientX)
    const end = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }
  const playhead = <div className="playhead" style={{ left: x(position) }} onPointerDown={scrub} />
  // Faint lines through the lanes at each labelled time, for lining up edits.
  const tickPx = tickStep * pxPerSec
  const grid = {
    ...LAYOUT,
    '--grid-px': `${tickPx}px`,
    '--grid-offset': `${tickPx > 0 ? -(scrollX % tickPx) : 0}px`
  } as CSSProperties

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.closest('button, .playhead') || pxPerSec <= 0) return
    onSeek(secAt(e.clientX - e.currentTarget.getBoundingClientRect().left))
    if (!target.closest('.clip')) onSelect(null, 'only')
  }

  // The track being dragged by its name, and the gap among its kind it would drop into
  // (0 is above the first). Tracks only move within their own group.
  const [drag, setDrag] = useState<{
    id: string
    role: TrackRole
    from: number
    slot: number | null
  } | null>(null)
  const endDrag = (): void => setDrag(null)
  const dropSlot =
    drag && drag.slot !== null && indexForSlot(drag.from, drag.slot) !== drag.from
      ? drag.slot
      : null

  // Dragging across empty timeline space draws a box; the clips it touches are selected.
  const [box, setBox] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
    areaLeft: number
    add: boolean
    moved: boolean
  } | null>(null)
  const boxEnded = useRef(false)
  // Dragging a bar on a chords lane onto another swaps the two; `over` is where it'd land.
  const chordDrag = useRef<{ trackId: string; bar: number } | null>(null)
  // Where the pointer went down on a bars grip, and whether it has moved far enough to drag.
  const barsDrag = useRef<{ x0: number; moved: boolean } | null>(null)

  const barSnap = (): BarDragSnap => ({ toleranceSec: SNAP_PX / pxPerSec, playheadSec: position })
  /** The grip on an instrumental's first bar: drag it, or nudge it with the arrow keys. */
  const barsGrip = (startSec: number): ReactNode => (
    <Tooltip text={t('timeline.moveBarsHelp')}>
      <button
        type="button"
        className="bars-grip"
        aria-label={t('timeline.moveBars')}
        // Runtime geometry: on bar 1's left edge.
        style={{ left: x(startSec) }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          barsDrag.current = { x0: e.clientX, moved: false }
        }}
        onPointerMove={(e) => {
          const d = barsDrag.current
          if (!d || pxPerSec <= 0) return
          if (!d.moved) {
            if (Math.abs(e.clientX - d.x0) < DRAG_THRESHOLD_PX) return
            d.moved = true
            onMoveBars('start', 0, barSnap())
          }
          onMoveBars('move', (e.clientX - d.x0) / pxPerSec, barSnap())
        }}
        onPointerUp={(e) => {
          const d = barsDrag.current
          barsDrag.current = null
          if (d?.moved && pxPerSec > 0) onMoveBars('end', (e.clientX - d.x0) / pxPerSec, barSnap())
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          e.stopPropagation()
          onNudgeBars(e.key === 'ArrowLeft' ? -1 : 1)
        }}
      />
    </Tooltip>
  )
  const [chordDrop, setChordDrop] = useState<{ trackId: string; bar: number } | null>(null)
  useEffect(() => {
    // Cleared after the click that ends the drag has been handled.
    const end = (): void => {
      setTimeout(() => {
        chordDrag.current = null
        setChordDrop(null)
      })
    }
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
  }, [])
  const boxHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (e.button !== 0 || !canEdit || target.closest('.clip, button, .playhead')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const { clientX: x, clientY: y } = e
      const areaLeft = e.currentTarget.getBoundingClientRect().left
      setBox({ x0: x, y0: y, x1: x, y1: y, areaLeft, add: selectMode(e) !== 'only', moved: false })
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!box) return
      const moved =
        box.moved || Math.hypot(e.clientX - box.x0, e.clientY - box.y0) >= DRAG_THRESHOLD_PX
      setBox({ ...box, x1: e.clientX, y1: e.clientY, moved })
    },
    onPointerUp: () => {
      if (!box) return
      setBox(null)
      if (!box.moved) return
      boxEnded.current = true
      const [top, bottom] = [Math.min(box.y0, box.y1), Math.max(box.y0, box.y1)]
      const lanesUnder = [...(lanesRef.current?.querySelectorAll('[data-track]') ?? [])]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.bottom > top && r.top < bottom
        })
        .map((el) => (el as HTMLElement).dataset.track ?? '')
      const sec = (x: number): number => secAt(x - box.areaLeft)
      onSelectBox(clipsInBox(tracks, lanesUnder, sec(box.x0), sec(box.x1)), box.add)
    },
    onPointerCancel: () => setBox(null)
  }

  // Clips dragged up or down lift into the lane they'd drop into, this far away in px.
  const [liftY, setLiftY] = useState<number | null>(null)
  const laneTop = (trackId: string): number =>
    lanesRef.current
      ?.querySelector(`[data-track="${CSS.escape(trackId)}"]`)
      ?.getBoundingClientRect().top ?? 0
  const clipGesture = (
    clip: ClipRef,
    kind: ClipGestureKind,
    phase: GesturePhase,
    deltaSec: number,
    free: boolean,
    clientY: number
  ): void => {
    // The lane the clips would drop into: the nearest of their kind to the pointer, as
    // far as every dragged clip can go.
    let target = clip.trackId
    if (kind === 'move' && phase !== 'start') {
      const wanted = laneShiftTo({ tracks }, clip.trackId, nearestLaneOfKind(clip.trackId, clientY))
      const shift = fittingShift({ tracks }, selectedClips, wanted ?? 0)
      target = shiftLanes({ tracks }, [clip], shift)?.[0].trackId ?? clip.trackId
    }
    if (kind === 'move') {
      if (phase === 'start') setLiftY(0)
      else if (phase === 'end') setLiftY(null)
      else setLiftY(laneTop(target) - laneTop(clip.trackId))
    }
    onClipGesture(
      clip,
      kind,
      phase,
      deltaSec,
      {
        toleranceSec: SNAP_PX / pxPerSec,
        gridSec: minorStep(tickStep),
        playheadSec: position,
        free
      },
      target
    )
  }

  /** The lane of the same kind as `trackId` closest to this height on screen. */
  const nearestLaneOfKind = (trackId: string, clientY: number): string | null => {
    const role = tracks.find((t) => t.id === trackId)?.role
    let nearest: string | null = null
    let best = Infinity
    for (const track of tracks.filter((t) => t.role === role)) {
      const r = lanesRef.current
        ?.querySelector(`[data-track="${CSS.escape(track.id)}"]`)
        ?.getBoundingClientRect()
      if (!r) continue
      const away = Math.max(r.top - clientY, clientY - r.bottom, 0)
      if (away < best) [nearest, best] = [track.id, away]
    }
    return nearest
  }

  /** One bar inside a chord block: click to open it, drag onto another bar to swap. */
  const chordCell = (trackId: string, name: string, c: ChordCellView): ReactNode => {
    const label = t('timeline.changeChord', {
      chord: !name ? t('chords.noChordHere') : c.carried ? t('chords.keep', { chord: name }) : name,
      bar: c.place.bar + 1
    })
    const [first, last] = pickedChord ? barRange(pickedChord.place) : [-1, -1]
    const picked =
      pickedChord?.trackId === trackId &&
      c.place.bar >= first &&
      c.place.bar <= last &&
      (last > first || pickedChord.place.slot === c.place.slot)
    return (
      <button
        type="button"
        key={`${c.place.bar}:${c.place.slot}`}
        className={cx(
          'chord-cell',
          canEdit && 'editable',
          c.carried && 'chord-cell-kept',
          picked && 'chord-cell-picked',
          chordDrop?.trackId === trackId && chordDrop.bar === c.place.bar && 'chord-cell-drop'
        )}
        aria-label={label}
        aria-pressed={picked}
        title={label}
        // Runtime geometry: its share of the block, by how long it plays.
        style={{ flexGrow: c.end - c.start }}
        onClick={(e) => {
          // Shift-click picks every bar from the open one to this one.
          if (e.shiftKey && pickedChord?.trackId === trackId) {
            onPickChord(trackId, { bar: pickedChord.place.bar, slot: 0, last: c.place.bar })
            return
          }
          // Straight to the bar, so you hear what you're about to change.
          onSeek(c.start)
          onPickChord(trackId, c.place)
        }}
        onPointerDown={(e) => {
          if (e.button === 0 && canEdit) chordDrag.current = { trackId, bar: c.place.bar }
        }}
        onPointerEnter={(e) => {
          const drag = chordDrag.current
          if (!drag || drag.trackId !== trackId || e.buttons !== 1) return
          setChordDrop(c.place.bar === drag.bar ? null : { trackId, bar: c.place.bar })
        }}
        onPointerUp={() => {
          const drag = chordDrag.current
          if (drag?.trackId === trackId && drag.bar !== c.place.bar)
            onSwapBars(trackId, drag.bar, c.place.bar)
        }}
      />
    )
  }

  const lane = (track: LaneView, index: number, group: LaneView[]): ReactNode => {
    const isRecording = recording?.trackId === track.id
    const isChords = track.role === 'chords'
    const clipKind = track.role === 'vocal' ? 'vocal' : 'backing'
    const inDragGroup = !!drag && sameGroup(drag.role, track.role)
    const dragHandlers = {
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!drag || !inDragGroup) return
        e.preventDefault()
        const box = e.currentTarget.getBoundingClientRect()
        const slot = index + (e.clientY > box.top + box.height / 2 ? 1 : 0)
        if (slot !== drag.slot) setDrag({ ...drag, slot })
      },
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        if (drag && inDragGroup && drag.slot !== null)
          onMoveTrack(drag.id, indexForSlot(drag.from, drag.slot))
        endDrag()
      }
    }
    return (
      <div
        key={track.id}
        data-track={track.id}
        className={cx(
          'lane',
          selectedTrackIds.includes(track.id) && 'lane-selected',
          isRecording && 'lane-recording',
          track.muted && 'lane-muted',
          drag?.id === track.id && 'lane-dragging',
          inDragGroup && dropSlot === index && 'drop-before',
          inDragGroup && dropSlot === group.length && index === group.length - 1 && 'drop-after'
        )}
        {...dragHandlers}
      >
        <TrackHeader
          // Counted across every lane, music first, as ⌘1–⌘9 count them.
          place={(track.role === 'vocal' ? backingTracks.length : 0) + index + 1}
          role={track.role}
          draggable={canEdit && !recording}
          onDragStart={(e) => {
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
            setDrag({ id: track.id, role: track.role, from: index, slot: null })
          }}
          onDragEnd={endDrag}
          renaming={renamingTrackId === track.id}
          onStartRename={() => canEdit && onRenaming(track.id)}
          onRename={(name) => onRenameTrack(track.id, name)}
          onRenameDone={() => onRenaming(null)}
          name={track.name}
          detail={isRecording ? formatDuration(recording.sec) : track.detail}
          recording={isRecording}
          // An imported backing track is a single file already laid down: recording
          // on top of it would double what the singer is hearing, so hide the action.
          // The chords play themselves.
          recordDisabled={!canRecord || recording !== null || track.imported || isChords}
          recordDisabledReason={
            isChords
              ? t('track.cantRecordChords')
              : track.imported
                ? t('track.cantRecordImported')
                : undefined
          }
          selected={selectedTrackIds.includes(track.id)}
          onSelect={(mode) => onSelectTrack(track.id, mode)}
          onContextMenu={() => onContextMenu('track', track.id, null)}
          onRecord={() => onRecord(track.id)}
          onStop={onStop}
          onRestart={onRestartTake}
        />
        <div
          className="lane-area seekable"
          {...boxHandlers}
          onClick={(e) => {
            // The click that ends a box selection doesn't also seek or pick the lane.
            if (boxEnded.current) {
              boxEnded.current = false
              return
            }
            if (chordDrop) return
            seekFromClick(e)
            const target = e.target as HTMLElement
            if (!target.closest('.clip, button, .playhead')) onLaneClick(track.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            const clip = (e.target as HTMLElement).closest<HTMLElement>('[data-clip-id]')
            const clipId = clip?.dataset.clipId
            if (clipId) return onContextMenu('clip', track.id, { trackId: track.id, clipId })
            // Pasting from this menu lands where the click was.
            seekFromClick(e)
            onContextMenu('lane', track.id, null)
          }}
        >
          {track.blocks.map((b) => {
            const first = { trackId: track.id, clipId: b.clipIds[0] }
            return (
              <ClipBlockView
                key={b.clipIds[0]}
                block={b}
                kind={clipKind}
                pxPerSec={pxPerSec}
                scrollX={scrollX}
                selected={includesClip(selectedClips, first)}
                liftY={includesClip(selectedClips, first) ? liftY : null}
                editable={canEdit && !isRecording}
                onSelect={(mode) => onSelect(first, mode)}
                onGesture={(kind, phase, delta, free, clientY) =>
                  clipGesture(first, kind, phase, delta, free, clientY)
                }
              />
            )
          })}
          {track.clips.map((c) => (
            <ClipView
              key={c.id}
              clip={c}
              kind={clipKind}
              pxPerSec={pxPerSec}
              scrollX={scrollX}
              viewWidth={areaWidth}
              height={CLIP_HEIGHT}
              selected={includesClip(selectedClips, { trackId: track.id, clipId: c.id })}
              liftY={
                includesClip(selectedClips, { trackId: track.id, clipId: c.id }) ? liftY : null
              }
              editable={canEdit && !isRecording}
              onSelect={(mode) => onSelect({ trackId: track.id, clipId: c.id }, mode)}
              onGesture={(kind, phase, delta, free, clientY) =>
                clipGesture({ trackId: track.id, clipId: c.id }, kind, phase, delta, free, clientY)
              }
            />
          ))}
          {canEdit && onApplyOffer && offer?.trackId === track.id && (
            <TakeOfferBar
              offer={offer}
              onApply={onApplyOffer}
              onDismiss={() => onDismissOffer?.()}
            />
          )}
          {canEdit && track.chords?.[0] && barsGrip(track.chords[0].start)}
          {track.chords?.map((block) => (
            <div
              key={`${block.cells[0].place.bar}:${block.cells[0].place.slot}`}
              className="clip chord-block"
              // Runtime geometry: where this chord plays on the timeline.
              style={{ left: x(block.start), width: (block.end - block.start) * pxPerSec }}
            >
              {block.cells.map((c) => chordCell(track.id, block.name, c))}
              <span className="chord-block-name">{block.name}</span>
            </div>
          ))}
          {isRecording && (
            <div
              className="clip clip-recording"
              style={{ left: x(recording.startSec), width: recording.sec * pxPerSec }}
            >
              <LiveWaveform
                peaks={recording.peaks}
                sampleRate={recording.sampleRate}
                pxPerSec={pxPerSec}
                height={CLIP_HEIGHT}
                viewFrom={Math.max(0, -x(recording.startSec))}
                viewWidth={areaWidth}
              />
            </div>
          )}
          {playhead}
          {snapAt !== null && <div className="snap-guide" style={{ left: x(snapAt) }} />}
        </div>
        <TrackMix
          name={track.name}
          volume={track.volume}
          startVolume={track.startVolume}
          pan={track.pan}
          muted={track.muted}
          locked={!canEdit}
          onMix={(change) => onMix(track.id, change)}
        />
      </div>
    )
  }

  return (
    <section className="timeline" aria-label={t('timeline.label')} ref={sectionRef} style={grid}>
      <div className="lane ruler-lane">
        <div className="lane-header">
          <span className="zoom-buttons">
            <IconButton
              icon="zoomOut"
              iconSize="secondary"
              className="zoom-button"
              label={t('timeline.zoomOut')}
              title={shortcuts.label(t('timeline.zoomOut'), 'zoomOut')}
              disabled={!zoomed}
              onClick={zoomOut}
            />
            <IconButton
              icon="zoomIn"
              iconSize="secondary"
              className="zoom-button"
              label={t('timeline.zoomIn')}
              title={shortcuts.label(t('timeline.zoomIn'), 'zoomIn')}
              onClick={zoomIn}
            />
            <IconButton
              icon="locate"
              iconSize="secondary"
              className="zoom-button"
              label={t('timeline.toPlayhead')}
              title={shortcuts.label(t('timeline.toPlayhead'), 'toPlayhead')}
              disabled={playheadVisible}
              onClick={toPlayhead}
            />
          </span>
        </div>
        {/* Seeking from the ruler keeps the selected clip, so you can place the playhead and split. */}
        <div className="lane-area ruler seekable" ref={areaRef} onPointerDown={scrub}>
          {minorTicks.map((tick) => (
            <span key={tick} className="tick-minor" style={{ left: x(tick) }} />
          ))}
          {ticks.map((tick) => (
            <span key={tick} className="tick" style={{ left: x(tick) }}>
              {formatTick(tick, tickStep)}
            </span>
          ))}
          {playhead}
        </div>
        <div className="mix-cell" />
      </div>

      {/* Only the lanes scroll, so the ruler, scrollbar and polish panel stay put. */}
      <div className="timeline-lanes" ref={lanesRef}>
        {box?.moved && (
          <div
            className="select-box"
            // Runtime geometry: the box being dragged, in window coordinates.
            style={
              {
                '--box-left': `${Math.min(box.x0, box.x1)}px`,
                '--box-top': `${Math.min(box.y0, box.y1)}px`,
                '--box-width': `${Math.abs(box.x1 - box.x0)}px`,
                '--box-height': `${Math.abs(box.y1 - box.y0)}px`
              } as CSSProperties
            }
          />
        )}
        {backingTracks.length > 0 ? (
          <>
            {backingTracks.map(lane)}
            <AddTrackRow
              label={t('timeline.addBackingRow')}
              disabled={!canEdit}
              choices={backingChoices}
            />
          </>
        ) : (
          <div className="lane">
            <div className="lane-header">
              <div className="lane-heading">
                <span className="lane-name">{t('timeline.backingTrack')}</span>
                {skipBacking && <span className="lane-detail">{t('timeline.noMusic')}</span>}
              </div>
            </div>
            <div className="lane-area seekable" onClick={seekFromClick}>
              <div className="lane-empty row">
                <Button
                  size="sm"
                  variant={skipBacking ? 'quiet' : 'primary'}
                  disabled={!canEdit}
                  onClick={onAddBacking}
                >
                  {t('timeline.addBacking')}
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={!canEdit}
                  onClick={onAddRecordedBacking}
                >
                  {t('timeline.recordBacking')}
                </Button>
                <Button size="sm" variant="quiet" disabled={!canEdit} onClick={onAddChords}>
                  {t('timeline.addInstrumental')}
                </Button>
                {!skipBacking && (
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={!canEdit}
                    onClick={onRecordWithoutMusic}
                  >
                    {t('timeline.recordWithoutMusic')}
                  </Button>
                )}
              </div>
              {playhead}
            </div>
            <div className="mix-cell" />
          </div>
        )}

        {vocalTracks.map(lane)}
        <AddTrackRow
          label={t('timeline.addVocal')}
          disabled={!canEdit}
          choices={(['lead', 'harmony'] as const).map((part) => ({
            key: part,
            label: t(part === 'lead' ? 'timeline.addLead' : 'timeline.addHarmony'),
            icon: part,
            onPick: () => onAddVocal(part)
          }))}
        />
      </div>

      {zoomed && (
        <div className="lane scroll-lane">
          <div className="lane-header" />
          <div
            className="timeline-scrollbar"
            ref={scrollbarRef}
            onScroll={(e) => onScrollbar(e.currentTarget.scrollLeft)}
          >
            <div className="timeline-scroll-content" style={{ width: contentWidth }} />
          </div>
          <div className="mix-cell" />
        </div>
      )}
    </section>
  )
}
