import { CSSProperties, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '../../../../preload/index.d'
import { getAudioContext } from '../../audio/engine/engine'
import { Command, onCommand, typingIn } from '../../state/commands/commands'
import { MenuTarget, contextMenu } from '../../state/commands/contextMenu'
import { GestureStart, applyClipGesture } from '../../state/editing/clipGestures'
import { snapGesture } from '../../state/editing/snapping'
import {
  CopiedClips,
  anyGrouped,
  copyClips,
  deleteClips,
  groupClips,
  includesClip,
  canSplitClips,
  isOneGroup,
  splitClips,
  laneShiftTo,
  moveClips,
  shiftLanes,
  pasteClips,
  pickClip,
  ungroupClips,
  withGroupmates
} from '../../state/editing/clipSets'
import {
  moveTrack,
  withTrackName,
  findClip,
  polishOf,
  withTrackChanges,
  nudgeLyrics,
  musicOf,
  withClick,
  withClickOn,
  withMusicPitch,
  withMusicSpeed,
  withMusicTone,
  withLyrics,
  withTrackPolish,
  withoutTracks,
  chordsTrackOf,
  withChartBars,
  withChartBeats,
  withChartTempo,
  withChordBacking
} from '../../state/song/project'
import {
  canExportSong,
  edgeAfter,
  edgeBefore,
  hasMusicChoice,
  pasteTarget,
  selectLanes,
  songEnd
} from '../../state/song/selectors'
import { Microphone } from '../../state/transport/useMicrophone'
import {
  DeleteFocus,
  SelectMode,
  deletionOf,
  selectTracks,
  tracksActedOn
} from '../../state/editing/trackSelection'
import { useExport } from '../../state/song/useExport'
import { bufferFor, useProcessedAudio } from '../../state/processing/processedAudio'
import { useVocalRemoval } from '../../state/processing/useVocalRemoval'
import { useSongKey } from '../../state/processing/songKey'
import { useBeat } from '../../state/transport/useBeat'
import { useChords } from '../../state/chords/useChords'
import { useChordBacking } from '../../state/chords/useChordBacking'
import { chartClickGrid, chartTimeline, transposeChord } from '../../state/chords/chart'
import { chordsInKey, keyOfChart } from '../../state/chords/keyChords'
import { previewChord } from '../../state/chords/preview'
import { transposeKey } from '../../audio/pitch/key'
import { PANEL_MIN_HEIGHT, SIDE_WIDTH, useSidePanelSize } from '../../state/ui/sidePanels'
import { useElementHeight } from '../../state/ui/useElementHeight'
import { clickGrid } from '../../state/transport/metronome'
import { useSong } from '../../state/song/useSong'
import { useTransport } from '../../state/transport/useTransport'
import { ExportDialog } from '../ExportDialog'
import { ChordsPanel } from '../ChordsPanel'
import { LyricsPanel } from '../LyricsPanel'
import { MusicPanel } from '../MusicPanel'
import { PolishPanel } from '../PolishPanel'
import { ClipRef, Timeline } from '../Timeline'
import { TabInfo, TopBar } from '../TopBar'
import { Button } from '../ui/Button'
import { Splitter } from '../ui/Splitter'
import { cx } from '../ui/cx'
import { TransportBar } from './TransportBar'
import './RecordScreen.css'

interface Props {
  /** The song this tab opened with. */
  initial: ChosenProject
  /** The visible tab: it alone plays, records and responds to the keyboard and menu. */
  active: boolean
  tabs: TabInfo[]
  tabId: string
  mic: Microphone
  /** Tells the app this tab's song name and folder (both change on rename). */
  onInfo(info: { name: string; dir: string }): void
  onSwitch(tabId: string): void
  onMove(tabId: string, toIndex: number): void
  onClose(tabId: string): void
  onNew(): void
  onSongbook(): void
}

/** One open song: its tab bar, transport, timeline and polish panel. */
export function RecordScreen({
  initial,
  active,
  tabs,
  tabId,
  mic,
  onInfo,
  onSwitch,
  onMove,
  onClose,
  onNew,
  onSongbook
}: Props): React.JSX.Element {
  const song = useSong(initial)
  const { song: open, audio, skipBacking, busy } = song
  const songKey = useSongKey(open?.data, audio)
  const { processed, waiting } = useProcessedAudio(open?.data, audio, songKey)
  const { beat, file: beatFile } = useBeat(open?.data, audio)
  const chordBacking = useChordBacking(open?.data)
  const chart = open?.data.chart ?? null
  const chartLine = open ? chartTimeline(open.data) : null
  const playsChords = !!open && !!chordsTrackOf(open.data)
  // A chords track keeps time with its chart, which knows where every bar starts.
  const grid =
    playsChords && chartLine
      ? chartClickGrid(chartLine)
      : open && beatFile
        ? clickGrid(open.data, beatFile, beat)
        : null
  // Null until the singer chooses: then lyrics show whenever the song has some.
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const [lyricsChoice, setLyricsChoice] = useState<boolean | null>(null)
  const lyricsOpen = lyricsChoice ?? !!open?.data.lyrics
  const [chordsOpen, setChordsOpen] = useState(false)
  const [chordsEditing, setChordsEditing] = useState(false)
  const panels = useSidePanelSize()
  const sideRef = useRef<HTMLDivElement>(null)
  const sideHeight = useElementHeight(sideRef)
  // Lyrics take half the column until the divider is moved, and always leave chords room.
  const lyricsHeight = Math.max(
    PANEL_MIN_HEIGHT,
    Math.min(panels.lyricsHeight ?? sideHeight / 2, sideHeight - PANEL_MIN_HEIGHT)
  )
  const songChords = useChords(open?.data, audio)
  const transport = useTransport(song, mic.source, {
    latencySec: mic.latencySec,
    processed,
    parts: chordBacking.parts,
    waiting: waiting || chordBacking.waiting,
    metronome: { grid, level: open && musicOf(open.data).clickOn ? musicOf(open.data).click : 0 }
  })
  const { mode, position, live } = transport
  // Selected clips, the most recently clicked last: split and navigation follow it.
  const [selection, setSelection] = useState<ClipRef[]>([])
  // Selected tracks, most recently clicked last: polish, paste and navigation follow it.
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const [panelHiddenOn, setPanelHiddenOn] = useState<string[] | null>(null)
  const selectedTrackId = selectedTrackIds.at(-1) ?? null
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null)
  // Whether Delete acts on the clicked clip or the selected tracks.
  const [deleteFocus, setDeleteFocus] = useState<DeleteFocus>(null)
  const exporter = useExport(song, chordBacking.parts)
  const [exportOpen, setExportOpen] = useState(false)
  const gesture = useRef<
    (GestureStart & { key: string; together: ClipRef[]; laneShift: number }) | null
  >(null)
  const gestureCount = useRef(0)

  const name = open?.data.name
  const dir = open?.dir
  useEffect(() => {
    if (name && dir) onInfo({ name, dir })
  }, [name, dir, onInfo])

  // Switching to another song pauses this one.
  useEffect(() => {
    if (!active && mode === 'playing') transport.togglePlay()
  }, [active, mode, transport])

  const idle = mode === 'idle'
  const canEdit = (idle || mode === 'playing') && !busy && !!open
  // Clips can vanish under the selection (undo, a punch-in); only those still there count.
  const selectedClips = open
    ? selection.filter((ref) => findClip(open.data, ref.trackId, ref.clipId))
    : []
  const selected = selectedClips.at(-1) ?? null
  const selectedClip =
    selected && open ? findClip(open.data, selected.trackId, selected.clipId) : undefined
  const canSplit = canEdit && !!open && canSplitClips(open.data, selectedClips, position)
  const canRecord =
    hasMusicChoice(open?.data, skipBacking) &&
    transport.recorderReady &&
    idle &&
    !transport.hasPendingTake &&
    !busy &&
    !waiting

  const canExport = canEdit && canExportSong(open?.data) && !chordBacking.waiting
  const openExport = (): void => {
    if (!canExport) return
    // A finished export's result makes way for the next one.
    if (exporter.state.status !== 'working') exporter.reset()
    setExportOpen(true)
  }

  // The key the chart is written in: the music's (before Key moved it), else the key
  // its chords suggest. Picking chords offers the ones that fit it.
  const chartKey = open
    ? songKey
      ? transposeKey(songKey, -musicOf(open.data).semitones)
      : keyOfChart(chart?.bars ?? [])
    : null
  const suggestions = chartKey
    ? { label: t('chords.inKey'), chords: chordsInKey(chartKey) }
    : { label: t('chords.startWith'), chords: chordsInKey({ tonic: 0, mode: 'major' }) }

  /** Starts the chords: a chart to write them in and a track to play them, both shown. */
  const startChords = (): void => {
    if (!open || !canEdit) return
    const next = withChordBacking(open.data, suggestions.chords[0])
    song.edit(next)
    const track = chordsTrackOf(next)
    if (track) setSelectedTrackIds([track.id])
    setChordsOpen(true)
    setChordsEditing(true)
  }
  const barSec = chartLine ? chartLine.secPerBeat * chartLine.beatsPerBar : 0
  const playingBar =
    chartLine && position >= chartLine.startSec && position < chartLine.endSec
      ? Math.floor((position - chartLine.startSec) / barSec)
      : -1

  const split = (): void => {
    if (open && canSplit) song.edit(splitClips(open.data, selectedClips, position))
  }
  const removeTracks = (removed: string[]): void => {
    if (!open || !canEdit) return
    song.edit(withoutTracks(open.data, removed))
    setSelection((refs) => refs.filter((ref) => !removed.includes(ref.trackId)))
    setSelectedTrackIds((ids) => ids.filter((id) => !removed.includes(id)))
    setDeleteFocus(null)
  }
  const deletion = deletionOf(deleteFocus, selectedClip ? selected : null, selectedTrackIds)
  const remove = (): void => {
    if (!open || !deletion) return
    if (deletion.kind === 'tracks') return removeTracks(deletion.trackIds)
    if (!canEdit) return
    song.edit(deleteClips(open.data, selectedClips))
    setSelection([])
    setDeleteFocus(null)
  }

  // Copied clips stay within this song, whose folder holds the audio they point at.
  const [clipboard, setClipboard] = useState<CopiedClips | null>(null)
  const copy = (): void => {
    if (open && selectedClips.length) setClipboard(copyClips(open.data, selectedClips))
  }
  const paste = (): void => {
    if (!open || !clipboard || !canEdit) return
    const from = clipboard.items[0].trackId
    const target = pasteTarget(open.data, from, selectedTrackId)
    const { project, pasted } = pasteClips(open.data, clipboard, position, target)
    song.edit(project)
    setSelection(pasted)
    setDeleteFocus('clip')
    // Landing at the end of the paste means pasting again lays copies end to end.
    const span = Math.max(...clipboard.items.map((i) => i.at + i.clip.duration))
    transport.seek(position + span)
  }
  const group = (): void => {
    if (open && canEdit && selectedClips.length > 1) song.edit(groupClips(open.data, selectedClips))
  }
  const ungroup = (): void => {
    if (open && canEdit && anyGrouped(open.data, selectedClips))
      song.edit(ungroupClips(open.data, selectedClips))
  }
  const moveTrackTo = (trackId: string, to: number): void => {
    if (open && canEdit) song.edit(moveTrack(open.data, trackId, to))
  }
  /** Moves the selected track one place up or down among tracks of its kind. */
  const nudgeTrack = (by: -1 | 1): void => {
    const track = open?.data.tracks.find((t) => t.id === selectedTrackId)
    if (!open || !track) return
    const at = open.data.tracks.filter((t) => t.role === track.role).indexOf(track)
    moveTrackTo(track.id, at + by)
  }
  const selectClip = (clip: ClipRef | null, how: SelectMode): void => {
    if (!clip || !open) return setSelection([])
    // Pressing a clip that's already selected keeps the selection, so it can be
    // dragged together; ⌘ or ⇧ adds or removes clips.
    if (!(how === 'only' && includesClip(selectedClips, clip)))
      setSelection(pickClip(open.data, selectedClips, clip, how))
    setSelectedTrackIds([clip.trackId])
    setDeleteFocus('clip')
  }
  const kindOfSelected = open?.data.tracks.filter(
    (t) => t.role === open.data.tracks.find((s) => s.id === selectedTrackId)?.role
  )
  const placeOfSelected = kindOfSelected?.findIndex((t) => t.id === selectedTrackId) ?? -1

  // A right-click picks what it's on first; the menu waits for that render, so it shows
  // what can be done to the new selection.
  const menuFor = useRef<MenuTarget | null>(null)
  const [menuRequest, setMenuRequest] = useState(0)
  const showMenu = useRef<() => void>(() => {})
  useEffect(() => {
    showMenu.current = () => {
      const target = menuFor.current
      menuFor.current = null
      if (!target || !open) return
      void window.api.showContextMenu(
        contextMenu(target, {
          canEdit,
          selectedClips: selectedClips.length,
          anyGrouped: anyGrouped(open.data, selectedClips),
          oneGroup: isOneGroup(open.data, selectedClips),
          canPaste: clipboard !== null,
          canSplit,
          canMoveUp: placeOfSelected > 0,
          canMoveDown: placeOfSelected >= 0 && placeOfSelected < (kindOfSelected?.length ?? 0) - 1
        })
      )
    }
  })
  useEffect(() => showMenu.current(), [menuRequest])

  // Navigation follows the selected clip's track, else the selected track, else every track.
  const navTrack = selected?.trackId ?? selectedTrackId

  /** One entry point for every command, whether it came from a key or the menu bar. */
  const run = (action: Command): void => {
    // In a text field, editing commands act on the text, not the song.
    const typing = typingIn(document.activeElement)
    const textEdit = {
      undo: 'undo',
      redo: 'redo',
      cut: 'cut',
      copy: 'copy',
      paste: 'paste',
      selectAll: 'selectAll'
    } as const
    if (typing && action in textEdit) {
      void window.api.nativeEdit(textEdit[action as keyof typeof textEdit])
      return
    }
    switch (action) {
      case 'save':
        void song.saveNow()
        break
      case 'export':
        openExport()
        break
      case 'undo':
        if (canEdit) song.undo()
        break
      case 'redo':
        if (canEdit) song.redo()
        break
      case 'copy':
        copy()
        break
      case 'cut':
        copy()
        remove()
        break
      case 'paste':
        paste()
        break
      case 'split':
        split()
        break
      case 'deleteClip':
        remove()
        break
      case 'groupClips':
        group()
        break
      case 'ungroupClips':
        ungroup()
        break
      case 'moveTrackUp':
        nudgeTrack(-1)
        break
      case 'moveTrackDown':
        nudgeTrack(1)
        break
      case 'renameTrack':
        if (canEdit && selectedTrackId) setRenamingTrackId(selectedTrackId)
        break
      case 'removeTrack':
        removeTracks(selectedTrackIds)
        break
      case 'deselect':
        setSelection([])
        setSelectedTrackIds([])
        setDeleteFocus(null)
        break
      case 'selectAll':
        if (!open) break
        setSelection([])
        setSelectedTrackIds(open.data.tracks.map((track) => track.id))
        setDeleteFocus('tracks')
        break
      case 'playPause':
        transport.togglePlay()
        break
      case 'stopPlayback':
        transport.stopPlayback()
        break
      case 'goToStart':
        transport.seek(0)
        break
      case 'goToEnd':
        if (open) transport.seek(songEnd(open.data))
        break
      case 'previousEdge':
        if (open) transport.seek(edgeBefore(open.data, position, navTrack))
        break
      case 'nextEdge':
        if (open) transport.seek(edgeAfter(open.data, position, navTrack))
        break
      case 'toggleLyrics':
        setLyricsChoice(!lyricsOpen)
        break
      case 'toggleChords':
        setChordsOpen((v) => !v)
        break
    }
  }

  // The command handler reads the latest render through a ref.
  const command = useRef<(action: Command) => void>(() => {})
  useEffect(() => {
    command.current = (action) => {
      if (active) run(action)
    }
  })
  useEffect(() => onCommand((action) => command.current(action)), [])

  const lanes = open ? selectLanes(open.data, audio, processed) : []
  // Polish follows the selected track, or the first vocal until one is picked.
  const polishTrack =
    open?.data.tracks.find((track) => track.id === selectedTrackId) ??
    open?.data.tracks.find((track) => track.role === 'vocal')
  // Hiding the panel remembers the selection it closed on; picking a track or clip
  // (a new selection) brings it back.
  const panelShown = panelHiddenOn !== selectedTrackIds
  const hidePanel = (): void => setPanelHiddenOn(selectedTrackIds)
  const vocalRemoval = useVocalRemoval(
    song,
    polishTrack?.role === 'backing' ? polishTrack.id : null
  )
  const error = song.error ?? transport.error

  return (
    <div className="screen" hidden={!active}>
      <TopBar
        tabs={tabs}
        activeId={tabId}
        disabled={!canEdit && mode !== 'playing'}
        saveState={song.saveState}
        onRename={song.renameSong}
        onSwitch={onSwitch}
        onMove={onMove}
        onClose={onClose}
        onNew={onNew}
        onSongbook={onSongbook}
        onSave={() => void song.saveNow()}
        canExport={canExport}
        onExport={openExport}
      />

      <div className="screen-body">
        <main className="workspace">
          <TransportBar
            playing={mode === 'playing'}
            canPlay={transport.canPlay}
            canStop={transport.canStop}
            onStop={transport.stopPlayback}
            position={position}
            source={mic.source}
            inputError={mic.inputError}
            micPaused={mic.paused}
            onToggleMicPaused={() => mic.setPaused(!mic.paused)}
            masterVolume={transport.masterVolume}
            masterMuted={transport.masterMuted}
            onMasterVolume={transport.setMasterVolume}
            onToggleMasterMuted={transport.toggleMasterMuted}
            canUndo={canEdit && song.canUndo}
            canRedo={canEdit && song.canRedo}
            canSplit={canSplit}
            canDelete={canEdit && !!deletion}
            onTogglePlay={transport.togglePlay}
            onUndo={song.undo}
            onRedo={song.redo}
            onSplit={split}
            onDelete={remove}
            lyricsOpen={lyricsOpen}
            onToggleLyrics={() => setLyricsChoice(!lyricsOpen)}
            chordsOpen={chordsOpen}
            onToggleChords={() => setChordsOpen((v) => !v)}
          />

          <div className="transport-messages" aria-live="polite">
            {mode === 'saving' && <p className="muted">{t('transport.saving')}</p>}
            {transport.status && <p>{transport.status}</p>}
            {error && <p className="error">{error}</p>}
            {transport.hasPendingTake && (
              <div className="row">
                <Button size="sm" onClick={transport.retrySave}>
                  {t('transport.retrySave')}
                </Button>
                <Button size="sm" variant="secondary" onClick={transport.discardPending}>
                  {t('transport.discardTake')}
                </Button>
              </div>
            )}
          </div>

          <Timeline
            tracks={lanes}
            position={position}
            follow={mode === 'playing' || mode === 'recording'}
            keyboard={active}
            onSeek={transport.seek}
            recording={
              live
                ? {
                    trackId: live.trackId,
                    startSec: live.startSec,
                    sec: Math.max(0, position - live.startSec),
                    peaks: live.peaks,
                    sampleRate: getAudioContext().sampleRate
                  }
                : null
            }
            canRecord={canRecord}
            onRecord={(id) => void transport.record(id)}
            onStop={() => void transport.stop()}
            canEdit={canEdit}
            skipBacking={skipBacking}
            onRecordWithoutMusic={song.recordWithoutMusic}
            onAddBacking={song.addBackingTrack}
            onAddRecordedBacking={() => void song.addRecordedBacking()}
            onAddChords={startChords}
            onAddVocal={song.addVocalTrack}
            onMix={(trackId, change) => {
              if (!open) return
              const field = Object.keys(change).join()
              // Muting a selected track mutes the whole selection; sliders stay per track.
              const targets =
                field === 'muted' ? tracksActedOn(selectedTrackIds, trackId) : [trackId]
              const next = targets.reduce((p, id) => withTrackChanges(p, id, change), open.data)
              // A slider drag is one undo step; each mute click is its own.
              song.edit(next, field === 'muted' ? undefined : `mix:${trackId}:${field}`)
            }}
            selectedClips={selectedClips}
            onSelect={selectClip}
            onSelectBox={(clips, add) => {
              if (!open) return
              const picked = withGroupmates(open.data, clips)
              const kept = add ? selectedClips.filter((r) => !includesClip(picked, r)) : []
              setSelection([...kept, ...picked])
              setDeleteFocus(picked.length || kept.length ? 'clip' : null)
            }}
            selectedTrackIds={
              selectedTrackIds.length ? selectedTrackIds : polishTrack ? [polishTrack.id] : []
            }
            onSelectTrack={(trackId, mode) => {
              setSelection([])
              setDeleteFocus('tracks')
              setSelectedTrackIds((ids) =>
                selectTracks(
                  ids,
                  trackId,
                  mode,
                  lanes.map((lane) => lane.id)
                )
              )
            }}
            snapAt={snapAt}
            onMoveTrack={moveTrackTo}
            renamingTrackId={renamingTrackId}
            onRenaming={setRenamingTrackId}
            onRenameTrack={(trackId, name) => {
              if (open && canEdit) song.edit(withTrackName(open.data, trackId, name))
            }}
            onContextMenu={(target, trackId, clip) => {
              if (clip) selectClip(clip, 'only')
              else if (target === 'track') {
                // Right-clicking one of several selected tracks keeps them all selected.
                if (!selectedTrackIds.includes(trackId)) setSelectedTrackIds([trackId])
                setSelection([])
                setDeleteFocus('tracks')
              } else {
                setSelectedTrackIds([trackId])
                setDeleteFocus(null)
              }
              menuFor.current = target
              setMenuRequest((n) => n + 1)
            }}
            onLaneClick={(trackId) => {
              setSelectedTrackIds([trackId])
              setDeleteFocus(null)
            }}
            onClipGesture={(ref, kind, phase, delta, snap, overTrackId) => {
              if (!open) return
              if (phase === 'start') {
                const clip = findClip(open.data, ref.trackId, ref.clipId)
                if (!clip) return
                // Dragging one of several selected clips moves them all.
                const together =
                  kind !== 'move'
                    ? []
                    : selectedClips.length > 1 && includesClip(selectedClips, ref)
                      ? selectedClips
                      : [ref]
                gesture.current = {
                  together,
                  moving: together.flatMap((r) => findClip(open.data, r.trackId, r.clipId) ?? []),
                  laneShift: 0,
                  base: open.data,
                  trackId: ref.trackId,
                  clip,
                  fileSec:
                    bufferFor(audio, processed, ref.trackId, clip.file)?.duration ??
                    clip.offset + clip.duration,
                  // Each drag is its own undo step, however many moves it takes.
                  key: `clip-drag:${++gestureCount.current}`
                }
                return
              }
              const g = gesture.current
              if (!g) return
              const snapped = snapGesture(g, kind, delta, snap)
              if (!g.together.length) {
                song.edit(applyClipGesture(g, kind, snapped.deltaSec), g.key)
              } else {
                // The timeline shows the clips lifted into the lane they'd drop into;
                // they move there when the drag ends.
                const shift = laneShiftTo(g.base, g.trackId, overTrackId)
                if (shift !== null && shiftLanes(g.base, g.together, shift)) g.laneShift = shift
                const lanes = phase === 'end' ? g.laneShift : 0
                song.edit(moveClips(g.base, g.together, snapped.deltaSec, lanes), g.key)
                if (phase === 'end')
                  setSelection(shiftLanes(g.base, g.together, lanes) ?? g.together)
              }
              setSnapAt(phase === 'end' ? null : snapped.at)
              if (phase === 'end') gesture.current = null
            }}
          />

          {panelShown && polishTrack && polishTrack.role !== 'vocal' && open && (
            <MusicPanel
              trackName={polishTrack.name}
              music={musicOf(open.data)}
              bpm={polishTrack.role === 'chords' ? (chart?.bpm ?? null) : (beat?.bpm ?? null)}
              songKey={songKey}
              locked={!canEdit}
              onSpeed={(speed, key) => song.edit(withMusicSpeed(open.data, speed), key)}
              onSemitones={(n, key) => song.edit(withMusicPitch(open.data, n), key)}
              onTone={(tone, key) => song.edit(withMusicTone(open.data, tone), key)}
              onClick={(level, key) => song.edit(withClick(open.data, level), key)}
              onClickOn={(on) => song.edit(withClickOn(open.data, on))}
              canClick={grid !== null}
              vocals={
                polishTrack.role === 'backing'
                  ? {
                      state: vocalRemoval.vocals,
                      error: vocalRemoval.error,
                      onRemove: vocalRemoval.remove,
                      onCancel: vocalRemoval.cancel,
                      onPutBack: vocalRemoval.putBack
                    }
                  : undefined
              }
              onHide={hidePanel}
              onReset={() =>
                song.edit(
                  withMusicTone(withMusicPitch(withMusicSpeed(open.data, 1), 0), {
                    bassDb: 0,
                    brightnessDb: 0
                  })
                )
              }
            />
          )}

          {panelShown && polishTrack?.role === 'vocal' && open && (
            <PolishPanel
              key={polishTrack.id}
              trackName={polishTrack.name}
              part={polishTrack.part ?? 'lead'}
              polish={polishOf(polishTrack)}
              locked={!canEdit}
              onHide={hidePanel}
              onChange={(next, key) =>
                song.edit(
                  withTrackPolish(open.data, polishTrack.id, next),
                  key ? `${key}:${polishTrack.id}` : undefined
                )
              }
            />
          )}
        </main>

        {open && (lyricsOpen || chordsOpen) && (
          <div
            className="side-panels"
            ref={sideRef}
            // Runtime geometry: the sizes the singer dragged to.
            style={
              {
                '--side-width': `${panels.width}px`,
                '--lyrics-height': `${lyricsHeight}px`
              } as CSSProperties
            }
          >
            <Splitter
              className="side-panels-edge"
              label={t('sidePanels.width')}
              orientation="vertical"
              value={panels.width}
              min={SIDE_WIDTH.min}
              max={SIDE_WIDTH.max}
              perPixel={-1}
              onChange={panels.setWidth}
            />
            {lyricsOpen && (
              <div className={cx('side-panel-slot', chordsOpen && 'side-panel-top')}>
                <LyricsPanel
                  songName={open.data.name}
                  lyrics={open.data.lyrics}
                  position={position}
                  locked={!canEdit}
                  onSeek={transport.seek}
                  onChange={(lyrics) => song.edit(withLyrics(open.data, lyrics))}
                  onNudge={(bySec) => song.edit(nudgeLyrics(open.data, bySec), 'lyrics-offset')}
                  onClose={() => setLyricsChoice(false)}
                />
              </div>
            )}
            {lyricsOpen && chordsOpen && (
              <Splitter
                className="side-panels-split"
                label={t('sidePanels.split')}
                orientation="horizontal"
                value={lyricsHeight}
                min={PANEL_MIN_HEIGHT}
                max={Math.max(PANEL_MIN_HEIGHT, sideHeight - PANEL_MIN_HEIGHT)}
                perPixel={1}
                onChange={panels.setLyricsHeight}
              />
            )}
            {chordsOpen && (
              <div className="side-panel-slot">
                <ChordsPanel
                  chords={chart ? (chartLine?.chords ?? []) : songChords.chords}
                  hasMusic={songChords.hasMusic}
                  fromChart={!!chart}
                  position={position}
                  onSeek={transport.seek}
                  onClose={() => setChordsOpen(false)}
                  locked={!canEdit}
                  onWrite={startChords}
                  editing={chordsEditing}
                  onEditing={setChordsEditing}
                  editor={
                    chart && {
                      chart,
                      playingBar,
                      suggestions,
                      locked: !canEdit,
                      onBars: (bars) => song.edit(withChartBars(open.data, bars)),
                      onTempo: (bpm) => song.edit(withChartTempo(open.data, bpm)),
                      onBeats: (n) => song.edit(withChartBeats(open.data, n)),
                      // Heard as it will play: in the key the Key knob moved it to.
                      onPreview: (chord) =>
                        void previewChord(transposeChord(chord, musicOf(open.data).semitones))
                    }
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      {exportOpen && (
        <ExportDialog
          state={exporter.state}
          onStart={(options) => void exporter.start(options)}
          onReveal={exporter.reveal}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
