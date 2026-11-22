import { CSSProperties, DragEvent, ReactNode, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { ClipGestureKind } from '../../state/editing/clipGestures'
import { TrackRole, VocalPart, formatDuration } from '../../state/song/project'
import { indexForSlot } from '../../state/tabs/tabOrder'
import { ClipRef, clipsInBox, includesClip } from '../../state/editing/clipSets'
import { useShortcuts } from '../../state/commands/shortcuts'
import { LaneView } from '../../state/song/selectors'
import { MenuTarget } from '../../state/commands/contextMenu'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { cx } from '../ui/cx'
import { ClipView, GesturePhase } from './ClipView'
import { ClipBlockView } from './ClipBlockView'
import { AddTrackRow } from './AddTrackRow'
import { TrackHeader } from './TrackHeader'
import { SnapView } from '../../state/editing/snapping'
import { formatTick, minorStep } from './timelineMath'
import { useRevealNewTrack } from './useRevealNewTrack'
import { SelectMode, selectMode } from '../../state/editing/trackSelection'
import { MixChange, TrackMix } from './TrackMix'
import { LiveWaveform } from './Waveform'
import { PeakAccumulator } from './timelineMath'
import { useTimelineView } from './useTimelineView'
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
  /** Tracks, clips and mix can be changed (not while recording or saving). */
  canEdit: boolean
  /** The singer chose to record without a backing track. */
  skipBacking: boolean
  onRecordWithoutMusic(): void
  onAddBacking(): void
  /** Adds an empty backing track to record music into (an instrument, a beat). */
  onAddRecordedBacking(): void
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

// Small enough for the zoom buttons to sit inside the ruler's row.
const ZOOM_ICON_SIZE = 14
const LANE_HEIGHT = 72
// Pointer travel below this is a click on the timeline, not the start of a box.
const BOX_THRESHOLD_PX = 4
// Gap between a clip and the top and bottom of its lane.
const CLIP_INSET = 6
const CLIP_HEIGHT = LANE_HEIGHT - CLIP_INSET * 2
// A clip edge this close (on screen) to something worth lining up with snaps onto it.
const SNAP_PX = 8
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
  canEdit,
  skipBacking,
  onRecordWithoutMusic,
  onAddBacking,
  onAddRecordedBacking,
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
    zoomOut,
    onScrollbar
  } = useTimelineView({
    clipEnds: tracks.flatMap((track) => track.clips.map((c) => c.start + c.duration)),
    recordingEnd: recording ? recording.startSec + recording.sec : 0,
    position,
    follow,
    keyboard
  })
  const backingTracks = tracks.filter((track) => track.role === 'backing')
  const vocalTracks = tracks.filter((track) => track.role === 'vocal')
  const lanesRef = useRef<HTMLDivElement>(null)
  const backingChoices = [
    { key: 'file', label: t('timeline.fromFile'), onPick: onAddBacking },
    { key: 'record', label: t('timeline.recordNew'), onPick: onAddRecordedBacking }
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
        box.moved || Math.hypot(e.clientX - box.x0, e.clientY - box.y0) >= BOX_THRESHOLD_PX
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

  // While clips are dragged, they follow the pointer up and down (this far, in px) and
  // drop into the lane under it when let go.
  const [lift, setLift] = useState<{ y0: number; dy: number } | null>(null)
  const liftY = lift?.dy ?? null
  const clipGesture = (
    clip: ClipRef,
    kind: ClipGestureKind,
    phase: GesturePhase,
    deltaSec: number,
    free: boolean,
    clientY: number
  ): void => {
    if (kind === 'move') {
      if (phase === 'start') setLift({ y0: clientY, dy: 0 })
      else if (phase === 'move') setLift((l) => l && { ...l, dy: clientY - l.y0 })
      else setLift(null)
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
      trackAt(clientY)
    )
  }

  /** The track whose lane spans this height on screen, if any. */
  const trackAt = (clientY: number): string | null => {
    const lanes = [...(lanesRef.current?.querySelectorAll<HTMLElement>('[data-track]') ?? [])]
    const over = lanes.find((el) => {
      const r = el.getBoundingClientRect()
      return clientY >= r.top && clientY < r.bottom
    })
    return over?.dataset.track ?? null
  }

  const lane = (track: LaneView, index: number, group: LaneView[]): ReactNode => {
    const isRecording = recording?.trackId === track.id
    const sameGroup = drag?.role === track.role
    const dragHandlers = {
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!drag || !sameGroup) return
        e.preventDefault()
        const box = e.currentTarget.getBoundingClientRect()
        const slot = index + (e.clientY > box.top + box.height / 2 ? 1 : 0)
        if (slot !== drag.slot) setDrag({ ...drag, slot })
      },
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        if (drag && sameGroup && drag.slot !== null)
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
          isRecording && 'lane-recording',
          track.muted && 'lane-muted',
          drag?.id === track.id && 'lane-dragging',
          sameGroup && dropSlot === index && 'drop-before',
          sameGroup && dropSlot === group.length && index === group.length - 1 && 'drop-after'
        )}
        {...dragHandlers}
      >
        <TrackHeader
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
          role={track.role}
          recording={isRecording}
          recordDisabled={!canRecord || recording !== null}
          selected={selectedTrackIds.includes(track.id)}
          onSelect={(mode) => onSelectTrack(track.id, mode)}
          onContextMenu={() => onContextMenu('track', track.id, null)}
          onRecord={() => onRecord(track.id)}
          onStop={onStop}
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
                kind={track.role}
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
              kind={track.role}
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
              iconSize={ZOOM_ICON_SIZE}
              className="zoom-button"
              label={t('timeline.zoomOut')}
              title={shortcuts.label(t('timeline.zoomOut'), 'zoomOut')}
              disabled={!zoomed}
              onClick={zoomOut}
            />
            <IconButton
              icon="zoomIn"
              iconSize={ZOOM_ICON_SIZE}
              className="zoom-button"
              label={t('timeline.zoomIn')}
              title={shortcuts.label(t('timeline.zoomIn'), 'zoomIn')}
              onClick={zoomIn}
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
          label={t('timeline.addVocalRow')}
          disabled={!canEdit}
          choices={(['lead', 'harmony'] as const).map((part) => ({
            key: part,
            label: t(`timeline.${part}`),
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
