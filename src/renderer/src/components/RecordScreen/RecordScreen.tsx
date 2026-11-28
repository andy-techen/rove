import { useCallback, useEffect, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '@shared/songs/project'
import { getAudioContext } from '../../audio/engine/engine'
import { useTrackNumberKeys } from '../../state/commands/trackKeys'
import { useSongCommands } from '../../state/commands/useSongCommands'
import { anyGrouped, isOneGroup } from '../../state/editing/clipSets'
import { tracksActedOn } from '../../state/editing/trackSelection'
import { useSongClipboard } from '../../state/editing/useSongClipboard'
import { usePlan } from '../../state/license/useFeature'
import { useChordBacking } from '../../state/chords/instruments/useChordBacking'
import { useChords } from '../../state/chords/heard/useChords'
import { useProcessedAudio } from '../../state/processing/processedAudio'
import { useSongKey } from '../../state/processing/songKey'
import { useAutoPolish } from '../../state/processing/useAutoPolish'
import { useVocalRemoval } from '../../state/processing/useVocalRemoval'
import { musicOf, withTrackChanges } from '../../state/song/project'
import {
  canExportSong,
  canLineUpClip,
  canSyncHarmonyClip,
  hasMusicChoice,
  selectLanes
} from '../../state/song/selectors'
import { exportSongFile } from '../../state/song/songFile'
import { useExport } from '../../state/song/useExport'
import { useSong } from '../../state/song/useSong'
import { canChangeLyrics, canStartRecording, recordTarget } from '../../state/transport/recordGate'
import { useBeat } from '../../state/transport/useBeat'
import { Microphone } from '../../state/transport/useMicrophone'
import { useTransport } from '../../state/transport/useTransport'
import { grownBy, useBottomPanelHeight } from '../../state/ui/sidePanels'
import { ExportDialog } from '../ExportDialog'
import { Timeline } from '../Timeline'
import { TabInfo, TopBar } from '../TopBar'
import { Button } from '../ui/Button'
import { BottomPanel } from './BottomPanel'
import { SidePanels } from './SidePanels'
import { TransportBar } from './TransportBar'
import { beatControls, songTiming } from './songTiming'
import { useBeatPlayer } from './useBeatPlayer'
import { useContextMenu } from './useContextMenu'
import { useDrags } from './useDrags'
import { useInstrumentals } from './useInstrumentals'
import { useSongEdits } from './useSongEdits'
import { useSongSelection } from './useSongSelection'
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
  const plan = usePlan()
  const { processed, waiting } = useProcessedAudio(open?.data, audio, songKey, plan)
  const { beat, file: beatFile } = useBeat(open?.data, audio)
  const chordBacking = useChordBacking(open?.data)
  const timing = songTiming(open?.data, beatFile, beat)
  // Null until the singer chooses: then lyrics show whenever the song has some.
  const [lyricsChoice, setLyricsChoice] = useState<boolean | null>(null)
  const lyricsOpen = lyricsChoice ?? !!open?.data.lyrics
  const [chordsOpen, setChordsOpen] = useState(false)
  const bottom = useBottomPanelHeight()
  const setBottomHeight = bottom.setHeight
  // A panel that grew (Polish's Advanced) gets the height to show it all, if it was short.
  const growBottomPanel = useCallback(
    (missingPx: number) => setBottomHeight((height) => grownBy(height, missingPx)),
    [setBottomHeight]
  )
  const songChords = useChords(open?.data, audio)
  const transport = useTransport(song, mic.source, {
    latencySec: mic.latencySec,
    hearSelf: mic.hearSelf,
    onLinedUp: mic.learnLatency,
    processed,
    parts: chordBacking.parts,
    waiting: waiting || chordBacking.waiting,
    metronome: {
      grid: timing.grid,
      level: open && musicOf(open.data).clickOn ? musicOf(open.data).click : 0
    }
  })
  const { mode, position, live } = transport
  const selection = useSongSelection(open)
  const { selectedClips, selectedTrackIds, selectedTrackId, oneClip } = selection
  // Polish follows the selected track, or the first vocal until one is picked.
  const polishTrack =
    open?.data.tracks.find((track) => track.id === selectedTrackId) ??
    open?.data.tracks.find((track) => track.role === 'vocal')
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null)
  const exporter = useExport(song, chordBacking.parts)
  const [exportOpen, setExportOpen] = useState(false)
  const hearBeat = useBeatPlayer()

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
  // Auto polish listens only when asked, for the vocal the Polish panel shows.
  const autoPolish = useAutoPolish(
    open?.data,
    audio,
    polishTrack?.role === 'vocal' ? polishTrack.id : undefined,
    (next) => song.edit(next)
  )
  const canEdit = (idle || mode === 'playing') && !busy && !!open
  const lanes = open ? selectLanes(open.data, audio, processed) : []
  const canRecord = canStartRecording({
    mode,
    hasMusic: hasMusicChoice(open?.data, skipBacking),
    recorderReady: transport.recorderReady,
    hasPendingTake: transport.hasPendingTake,
    busy,
    waiting
  })

  const canExport = canEdit && canExportSong(open?.data) && !chordBacking.waiting
  const openExport = (): void => {
    if (!canExport) return
    // A finished export's result makes way for the next one.
    if (exporter.state.status !== 'working') exporter.reset()
    setExportOpen(true)
  }
  const exportProject = (): void => {
    if (open) void exportSongFile({ dir: open.dir, saveNow: song.saveNow })
  }

  const instrumentals = useInstrumentals({
    song,
    canEdit,
    selection,
    chordsTracks: timing.chordsTracks,
    timeKeeper: timing.timeKeeper,
    songKey,
    musicTempo: timing.musicTempo,
    position
  })
  const { chart, chartLine } = instrumentals
  const edits = useSongEdits({
    song,
    canEdit,
    selection,
    panelTrack: polishTrack,
    place: instrumentals.place,
    removeBars: instrumentals.removeBars,
    position
  })
  const { canSplit, deletion } = edits
  const clipboard = useSongClipboard({
    song,
    canEdit,
    selectedClips,
    selectedTrackId,
    panelTrack: polishTrack,
    place: instrumentals.place,
    onPlace: instrumentals.setPlace,
    position,
    seek: transport.seek,
    onPastedClips: (pasted) => {
      selection.setClips(pasted)
      selection.setDeleteFocus('clip')
    },
    remove: edits.remove
  })
  const drags = useDrags({
    song,
    canEdit,
    selection,
    processed,
    musicTempo: timing.musicTempo
  })

  const kindOfSelected = open?.data.tracks.filter(
    (t) => t.role === open.data.tracks.find((s) => s.id === selectedTrackId)?.role
  )
  const selectedVocal = open?.data.tracks.find(
    (t) => t.id === selectedTrackId && t.role === 'vocal'
  )
  const placeOfSelected = kindOfSelected?.findIndex((t) => t.id === selectedTrackId) ?? -1
  const showMenu = useContextMenu(() =>
    open
      ? {
          canEdit,
          selectedClips: selectedClips.length,
          anyGrouped: anyGrouped(open.data, selectedClips),
          oneGroup: isOneGroup(open.data, selectedClips),
          canPaste: clipboard.canPaste,
          canSplit,
          canMoveUp: placeOfSelected > 0,
          canMoveDown: placeOfSelected >= 0 && placeOfSelected < (kindOfSelected?.length ?? 0) - 1,
          canLineUp: oneClip !== null && canLineUpClip(open.data, oneClip),
          canSyncHarmony: oneClip !== null && canSyncHarmonyClip(open.data, oneClip),
          vocalPart: selectedVocal ? (selectedVocal.part ?? 'lead') : null
        }
      : null
  )

  useSongCommands(active, {
    song,
    transport,
    canEdit,
    recordTrackId: canRecord ? recordTarget(lanes, selectedTrackId) : null,
    trackOrder: lanes.map((lane) => lane.id),
    selectedTrackId,
    oneClip,
    // Navigation follows the selected clip's track, else the selected track, else every track.
    navTrack: selection.selected?.trackId ?? selectedTrackId,
    copy: clipboard.copy,
    cut: clipboard.cut,
    paste: clipboard.paste,
    split: edits.split,
    remove: edits.remove,
    group: edits.group,
    ungroup: edits.ungroup,
    nudgeTrack: edits.nudgeTrack,
    renameTrack: () => {
      if (canEdit && selectedTrackId) setRenamingTrackId(selectedTrackId)
    },
    removeSelectedTracks: () => edits.removeTracks(selectedTrackIds),
    selectOnlyTrack: selection.selectOnlyTrack,
    deselect: selection.deselect,
    selectAll: selection.selectAll,
    openExport,
    toggleLyrics: () => setLyricsChoice(!lyricsOpen),
    toggleChords: () => setChordsOpen((v) => !v)
  })

  useTrackNumberKeys((number) => {
    const lane = lanes[number - 1]
    if (active && lane) selection.selectOnlyTrack(lane.id)
  })

  const { panelShown, hidePanel } = selection
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
            beat={open ? beatControls(open.data, timing, !canEdit, song.edit) : null}
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
            onSplit={edits.split}
            onDelete={edits.remove}
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
            onRestartTake={() => void transport.restartTake()}
            offer={transport.offer}
            onApplyOffer={transport.applyOffer}
            onDismissOffer={transport.dismissOffer}
            canEdit={canEdit}
            skipBacking={skipBacking}
            onRecordWithoutMusic={song.recordWithoutMusic}
            onAddBacking={song.addBackingTrack}
            onAddRecordedBacking={() => void song.addRecordedBacking()}
            onAddChords={instrumentals.startChords}
            onPickChord={instrumentals.pickChord}
            onSwapBars={instrumentals.swapBars}
            onMoveBars={drags.onMoveBars}
            onNudgeBars={drags.onNudgeBars}
            pickedChord={
              panelShown && polishTrack?.role === 'chords'
                ? { trackId: polishTrack.id, place: instrumentals.place }
                : null
            }
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
            onSelect={selection.selectClip}
            onSelectBox={selection.selectBox}
            selectedTrackIds={
              selectedTrackIds.length ? selectedTrackIds : polishTrack ? [polishTrack.id] : []
            }
            onSelectTrack={(trackId, how) =>
              selection.selectTrack(
                trackId,
                how,
                lanes.map((lane) => lane.id)
              )
            }
            snapAt={drags.snapAt}
            onMoveTrack={edits.moveTrackTo}
            renamingTrackId={renamingTrackId}
            onRenaming={setRenamingTrackId}
            onRenameTrack={edits.renameTrack}
            onContextMenu={(target, trackId, clip) => {
              selection.selectForMenu(target, trackId, clip)
              showMenu(target)
            }}
            onLaneClick={(trackId) => selection.showTrack(trackId, null)}
            onClipGesture={drags.onClipGesture}
          />

          {panelShown && polishTrack && open && (
            <BottomPanel
              track={polishTrack}
              project={open.data}
              edit={song.edit}
              locked={!canEdit}
              idle={idle}
              plan={plan}
              height={bottom.height}
              onHeight={bottom.setHeight}
              onGrow={growBottomPanel}
              onHide={hidePanel}
              bpm={beat?.bpm ?? null}
              songKey={songKey}
              vocalRemoval={vocalRemoval}
              autoPolish={autoPolish}
              instrumentals={instrumentals}
              pasteNote={clipboard.pasteNote}
              onPasteChords={() => void clipboard.pasteChords()}
              hearBeat={hearBeat}
            />
          )}
        </main>

        {open && (lyricsOpen || chordsOpen) && (
          <SidePanels
            project={open.data}
            edit={song.edit}
            lyricsOpen={lyricsOpen}
            chordsOpen={chordsOpen}
            onCloseLyrics={() => setLyricsChoice(false)}
            onCloseChords={() => setChordsOpen(false)}
            lyricsLocked={!canChangeLyrics(mode, busy)}
            position={position}
            onSeek={transport.seek}
            chords={chart ? (chartLine?.chords ?? []) : songChords.chords}
            hasMusic={songChords.hasMusic}
            fromChart={!!chart}
          />
        )}
      </div>

      {exportOpen && (
        <ExportDialog
          state={exporter.state}
          lyrics={song.song?.data.lyrics ?? null}
          onStart={(options) => void exporter.start(options)}
          onReveal={exporter.reveal}
          onShare={exporter.share}
          onExportProject={() => {
            setExportOpen(false)
            exportProject()
          }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
