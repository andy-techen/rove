import { CSSProperties, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '../../../../preload/index.d'
import { getAudioContext } from '../../audio/engine/engine'
import { Command, onCommand, typingIn } from '../../state/commands/commands'
import { GestureStart, applyClipGesture } from '../../state/editing/clipGestures'
import { snapGesture } from '../../state/editing/snapping'
import {
  Clip,
  deleteClip,
  findClip,
  pasteClip,
  polishOf,
  splitClip,
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
  withoutTracks
} from '../../state/song/project'
import {
  canExportSong,
  canSplitAt,
  edgeAfter,
  edgeBefore,
  hasMusicChoice,
  selectLanes,
  songEnd
} from '../../state/song/selectors'
import { Microphone } from '../../state/transport/useMicrophone'
import {
  DeleteFocus,
  deletionOf,
  selectTracks,
  tracksActedOn
} from '../../state/editing/trackSelection'
import { useExport } from '../../state/song/useExport'
import { bufferFor, useProcessedAudio } from '../../state/processing/processedAudio'
import { useSongKey } from '../../state/processing/songKey'
import { useBeat } from '../../state/transport/useBeat'
import { useChords } from '../../state/chords/useChords'
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
  onNew
}: Props): React.JSX.Element {
  const song = useSong(initial)
  const { song: open, audio, skipBacking, busy } = song
  const songKey = useSongKey(open?.data, audio)
  const { processed, waiting } = useProcessedAudio(open?.data, audio, songKey)
  const { beat, file: beatFile } = useBeat(open?.data, audio)
  const grid = open && beatFile ? clickGrid(open.data, beatFile, beat) : null
  // Null until the singer chooses: then lyrics show whenever the song has some.
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const [lyricsChoice, setLyricsChoice] = useState<boolean | null>(null)
  const lyricsOpen = lyricsChoice ?? !!open?.data.lyrics
  const [chordsOpen, setChordsOpen] = useState(false)
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
    waiting,
    metronome: { grid, level: open && musicOf(open.data).clickOn ? musicOf(open.data).click : 0 }
  })
  const { mode, position, live } = transport
  const [selected, setSelected] = useState<ClipRef | null>(null)
  // Selected tracks, most recently clicked last: polish, paste and navigation follow it.
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const selectedTrackId = selectedTrackIds.at(-1) ?? null
  // Whether Delete acts on the clicked clip or the selected tracks.
  const [deleteFocus, setDeleteFocus] = useState<DeleteFocus>(null)
  const exporter = useExport(song)
  const [exportOpen, setExportOpen] = useState(false)
  const gesture = useRef<(GestureStart & { key: string }) | null>(null)
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
  const selectedClip =
    open && selected ? findClip(open.data, selected.trackId, selected.clipId) : undefined
  const canSplit = canEdit && canSplitAt(selectedClip, position)
  const canRecord =
    hasMusicChoice(open?.data, skipBacking) &&
    transport.recorderReady &&
    idle &&
    !transport.hasPendingTake &&
    !busy &&
    !waiting

  const canExport = canEdit && canExportSong(open?.data)
  const openExport = (): void => {
    if (!canExport) return
    // A finished export's result makes way for the next one.
    if (exporter.state.status !== 'working') exporter.reset()
    setExportOpen(true)
  }

  const split = (): void => {
    if (open && selected && canSplit) {
      song.edit(splitClip(open.data, selected.trackId, selected.clipId, position))
    }
  }
  const canRemoveTrack = idle && !busy && !!open
  const removeTracks = (removed: string[]): void => {
    if (!open || !canRemoveTrack) return
    song.edit(withoutTracks(open.data, removed))
    if (selected && removed.includes(selected.trackId)) setSelected(null)
    setSelectedTrackIds((ids) => ids.filter((id) => !removed.includes(id)))
    setDeleteFocus(null)
  }
  const deletion = deletionOf(deleteFocus, selectedClip ? selected : null, selectedTrackIds)
  const remove = (): void => {
    if (!open || !deletion) return
    if (deletion.kind === 'tracks') return removeTracks(deletion.trackIds)
    if (!canEdit) return
    song.edit(deleteClip(open.data, deletion.clip.trackId, deletion.clip.clipId))
    setSelected(null)
    setDeleteFocus(null)
  }

  // Copied clips stay within this song, whose folder holds the audio they point at.
  const [clipboard, setClipboard] = useState<{
    trackId: string
    clip: Omit<Clip, 'id' | 'start'>
  } | null>(null)
  const copy = (): void => {
    if (!selected || !selectedClip) return
    const { file, offset, duration, fadeIn, fadeOut } = selectedClip
    setClipboard({ trackId: selected.trackId, clip: { file, offset, duration, fadeIn, fadeOut } })
  }
  const paste = (): void => {
    if (!open || !clipboard || !canEdit) return
    const trackId = selectedTrackId ?? clipboard.trackId
    const { clip } = clipboard
    const pasted = pasteClip(open.data, trackId, clip, position)
    song.edit(pasted.project)
    setSelected({ trackId, clipId: pasted.clipId })
    // Landing at the end of the paste means pasting again lays copies end to end.
    transport.seek(position + clip.duration)
  }
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
      case 'deselect':
        setSelected(null)
        setSelectedTrackIds([])
        setDeleteFocus(null)
        break
      case 'selectAll':
        if (!open) break
        setSelected(null)
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
            canUndo={canEdit && song.canUndo}
            canRedo={canEdit && song.canRedo}
            canSplit={canSplit}
            canDelete={deletion?.kind === 'tracks' ? canRemoveTrack : canEdit && !!deletion}
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
            selected={selectedClip ? selected : null}
            onSelect={(clip) => {
              setSelected(clip)
              if (!clip) return
              setSelectedTrackIds([clip.trackId])
              setDeleteFocus('clip')
            }}
            selectedTrackIds={
              selectedTrackIds.length ? selectedTrackIds : polishTrack ? [polishTrack.id] : []
            }
            onSelectTrack={(trackId, mode) => {
              setSelected(null)
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
            onClipGesture={(ref, kind, phase, delta, snap) => {
              if (!open) return
              if (phase === 'start') {
                const clip = findClip(open.data, ref.trackId, ref.clipId)
                if (!clip) return
                gesture.current = {
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
              song.edit(applyClipGesture(g, kind, snapped.deltaSec), g.key)
              setSnapAt(phase === 'end' ? null : snapped.at)
              if (phase === 'end') gesture.current = null
            }}
          />

          {polishTrack?.role === 'backing' && open && (
            <MusicPanel
              trackName={polishTrack.name}
              music={musicOf(open.data)}
              bpm={beat?.bpm ?? null}
              songKey={songKey}
              locked={!canEdit}
              onSpeed={(speed, key) => song.edit(withMusicSpeed(open.data, speed), key)}
              onSemitones={(n, key) => song.edit(withMusicPitch(open.data, n), key)}
              onTone={(tone, key) => song.edit(withMusicTone(open.data, tone), key)}
              onClick={(level, key) => song.edit(withClick(open.data, level), key)}
              onClickOn={(on) => song.edit(withClickOn(open.data, on))}
              canClick={grid !== null}
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

          {polishTrack?.role === 'vocal' && open && (
            <PolishPanel
              key={polishTrack.id}
              trackName={polishTrack.name}
              part={polishTrack.part ?? 'lead'}
              polish={polishOf(polishTrack)}
              locked={!canEdit}
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
                  chords={songChords.chords}
                  hasMusic={songChords.hasMusic}
                  position={position}
                  onSeek={transport.seek}
                  onClose={() => setChordsOpen(false)}
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
