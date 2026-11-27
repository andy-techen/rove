import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '../../../../preload/index.d'
import { getAudioContext } from '../../audio/engine/engine'
import { Command, onCommand, typingIn } from '../../state/commands/commands'
import { useTrackNumberKeys } from '../../state/commands/trackKeys'
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
  chordsTracksOf,
  withChartBars,
  withSongBeats,
  withChartFeel,
  feelsOf,
  ChordFeel,
  withSongStart,
  withSongTempo,
  withTempoOfMusic,
  tempoOf,
  withChordBacking,
  instrumentOf,
  withBeatParts,
  withMyBeat,
  withPastedBeats,
  copyBeats,
  CopiedBeats,
  withoutMyBeat,
  withInstrument,
  withVocalPart
} from '../../state/song/project'
import {
  canExportSong,
  canLineUpClip,
  canSyncHarmonyClip,
  edgeAfter,
  edgeBefore,
  hasMusicChoice,
  pasteTarget,
  selectLanes,
  skipTarget,
  songEnd
} from '../../state/song/selectors'
import { Microphone } from '../../state/transport/useMicrophone'
import {
  DeleteFocus,
  PickedBars,
  SelectMode,
  deletionOf,
  selectTracks,
  tracksActedOn,
  adjacentTrack
} from '../../state/editing/trackSelection'
import { canChangeLyrics, canStartRecording, recordTarget } from '../../state/transport/recordGate'
import { usePlan } from '../../state/license/useFeature'
import { offersVocals } from '../../state/license/premiumControls'
import { isEnabled } from '@shared/features'
import { useExport } from '../../state/song/useExport'
import { bufferFor, useProcessedAudio } from '../../state/processing/processedAudio'
import { useVocalRemoval } from '../../state/processing/useVocalRemoval'
import { useSongKey } from '../../state/processing/songKey'
import { useBeat } from '../../state/transport/useBeat'
import { useChords } from '../../state/chords/useChords'
import { useChordBacking } from '../../state/chords/useChordBacking'
import { barsUntil } from '../../state/chords/beats'
import {
  ChartPlace,
  barRange,
  chartClickGrid,
  barGrid,
  draggedBarStart,
  instrumentalTimeline,
  nudgedBarStart,
  placeAt,
  transposeChord
} from '../../state/chords/chart'
import { chordsInKey, keyOfChart } from '../../state/chords/keyChords'
import { playBeat, previewChord, previewDrum } from '../../state/chords/preview'
import { Chord } from '../../audio/music/chords'
import {
  clearBars,
  copyBars,
  insertBars,
  pasteBars,
  removeBars,
  swapBars
} from '../../state/chords/chartBars'
import { chordSheetToPaste, unreadNote } from '../../state/chords/chordText'
import { transposeKey } from '../../audio/pitch/key'
import {
  BOTTOM_HEIGHT,
  INSTRUMENTAL_MIN_HEIGHT,
  PANEL_MIN_HEIGHT,
  SIDE_WIDTH,
  useBottomPanelHeight,
  useSidePanelSize,
  grownBy
} from '../../state/ui/sidePanels'
import { useElementHeight } from '../../state/ui/useElementHeight'
import { clickGrid, tempoOfMusic } from '../../state/transport/metronome'
import { useSong } from '../../state/song/useSong'
import { useAutoPolish } from '../../state/processing/useAutoPolish'
import { useTransport } from '../../state/transport/useTransport'
import { ExportDialog } from '../ExportDialog'
import { BeatsEditor, ChartEditor, ChordBackingPanel } from '../ChordBackingPanel'
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
  const chordsTracks = open ? chordsTracksOf(open.data) : []
  // The first written chart keeps time for the click; new ones start in step with it.
  const timeKeeper = chordsTracks.find((track) => open && instrumentalTimeline(open.data, track))
  const timeLine = open && timeKeeper ? instrumentalTimeline(open.data, timeKeeper) : null
  // The music's beat, as a tempo the instrumentals can keep to.
  const musicTempo = open && beatFile ? tempoOfMusic(open.data, beatFile, beat) : null
  // A chords track keeps time with its chart, which knows where every bar starts.
  const grid = timeLine
    ? chartClickGrid(timeLine)
    : open && beatFile
      ? clickGrid(open.data, beatFile, beat)
      : null
  // Null until the singer chooses: then lyrics show whenever the song has some.
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const [lyricsChoice, setLyricsChoice] = useState<boolean | null>(null)
  const lyricsOpen = lyricsChoice ?? !!open?.data.lyrics
  const [chordsOpen, setChordsOpen] = useState(false)
  const panels = useSidePanelSize()
  const bottom = useBottomPanelHeight()
  const setBottomHeight = bottom.setHeight
  // A panel that grew (Polish's Advanced) gets the height to show it all, if it was short.
  const growBottomPanel = useCallback(
    (missingPx: number) => setBottomHeight((height) => grownBy(height, missingPx)),
    [setBottomHeight]
  )
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
    hearSelf: mic.hearSelf,
    onLinedUp: mic.learnLatency,
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
  // Polish follows the selected track, or the first vocal until one is picked.
  const polishTrack =
    open?.data.tracks.find((track) => track.id === selectedTrackId) ??
    open?.data.tracks.find((track) => track.role === 'vocal')
  // The chart shown: the selected chords track's, else the first one's.
  const chartTrack = chordsTracks.find((t) => t.id === selectedTrackId) ?? timeKeeper
  // Drums are set bar by bar like chords, but have no chords of their own.
  const beats = chartTrack && instrumentOf(chartTrack) === 'beats' ? chartTrack.beats : undefined
  const chart = (!beats && chartTrack?.chart) || null
  const chartLine = open && chartTrack ? instrumentalTimeline(open.data, chartTrack) : null
  const [chartPlace, setChartPlace] = useState<ChartPlace>({ bar: 0, slot: 0 })
  // Stops the beat playing in the Instrumental panel.
  const beatPlaying = useRef<(() => void) | null>(null)
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null)
  // Whether Delete acts on the clicked clip or the selected tracks.
  const [deleteFocus, setDeleteFocus] = useState<DeleteFocus>(null)
  const exporter = useExport(song, chordBacking.parts)
  const [exportOpen, setExportOpen] = useState(false)
  const gesture = useRef<
    (GestureStart & { key: string; together: ClipRef[]; laneShift: number }) | null
  >(null)
  const gestureCount = useRef(0)
  // Bar 1 being dragged: where it started, and the undo step every move joins.
  const barsDrag = useRef<{ fromSec: number; key: string } | null>(null)

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
  // Clips can vanish under the selection (undo, a punch-in); only those still there count.
  const selectedClips = open
    ? selection.filter((ref) => findClip(open.data, ref.trackId, ref.clipId))
    : []
  const selected = selectedClips.at(-1) ?? null
  // Lining up and syncing act on one take at a time.
  const oneClip = selectedClips.length === 1 ? selected : null
  const selectedClip =
    selected && open ? findClip(open.data, selected.trackId, selected.clipId) : undefined
  const canSplit = canEdit && !!open && canSplitClips(open.data, selectedClips, position)
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

  /** Adds an instrumental: a track and its chart, selected so the chart opens below. */
  const startChords = (): void => {
    if (!open || !canEdit) return
    const { project, track } = withChordBacking(open.data, suggestions.chords[0], musicTempo)
    song.edit(project)
    setSelectedTrackIds([track.id])
    setChartPlace({ bar: 0, slot: 0 })
  }
  /** Opens a chord clicked on the timeline in its track's chart. */
  const pickChord = (trackId: string, place: ChartPlace): void => {
    setSelectedTrackIds([trackId])
    setSelection([])
    setChartPlace(place)
    setDeleteFocus('bars')
  }
  /** Takes picked bars out of their chart; the bar before them is picked next. */
  const removePickedBars = ({ trackId, first, last }: PickedBars): void => {
    const track = open?.data.tracks.find((t) => t.id === trackId)
    if (open && track?.beats && instrumentOf(track) === 'beats') {
      song.edit(
        withBeatParts(open.data, trackId, removeBars(track.beats.parts, first, last, 'main'))
      )
      setChartPlace({ bar: Math.max(0, first - 1), slot: 0 })
      return
    }
    const chart = track?.chart
    if (!open || !chart) return
    song.edit(
      withChartBars(
        open.data,
        trackId,
        removeBars(chart.bars, first, last, []),
        removeBars(feelsOf(chart), first, last, 'strum')
      )
    )
    setChartPlace({ bar: Math.max(0, first - 1), slot: 0 })
  }
  const playingBar = (chartLine && placeAt(chartLine, chart?.bars ?? [], position)?.bar) ?? -1

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
  const pickedBars =
    polishTrack?.role === 'chords' && (polishTrack.chart || polishTrack.beats)
      ? { trackId: polishTrack.id, first: barRange(chartPlace)[0], last: barRange(chartPlace)[1] }
      : null
  const deletion = deletionOf(
    deleteFocus,
    selectedClip ? selected : null,
    selectedTrackIds,
    pickedBars
  )
  const remove = (): void => {
    if (!open || !deletion) return
    if (deletion.kind === 'tracks') return removeTracks(deletion.trackIds)
    if (!canEdit) return
    if (deletion.kind === 'bars') return removePickedBars(deletion.bars)
    song.edit(deleteClips(open.data, selectedClips))
    setSelection([])
    setDeleteFocus(null)
  }

  // Copied clips stay within this song, whose folder holds the audio they point at.
  const [clipboard, setClipboard] = useState<CopiedClips | null>(null)
  // Copied bars of chords, kept apart from clips: they paste into any instrumental.
  const [copiedBars, setCopiedBars] = useState<{ bars: Chord[][]; feels: ChordFeel[] } | null>(null)
  // What the last paste into a chart couldn't do, shown under that chart.
  const [pasteNote, setPasteNote] = useState<{ trackId: string; text: string } | null>(null)
  // Copied drum bars, kept apart from chords: they paste only into beats.
  const [copiedBeats, setCopiedBeats] = useState<CopiedBeats | null>(null)
  // With no clips picked, copy and paste act on the bars open in the Instrumental panel.
  const drumTarget =
    !selectedClips.length &&
    polishTrack?.role === 'chords' &&
    instrumentOf(polishTrack) === 'beats' &&
    polishTrack.beats
      ? { trackId: polishTrack.id, beats: polishTrack.beats, range: barRange(chartPlace) }
      : null
  const chartTarget =
    !selectedClips.length &&
    polishTrack?.role === 'chords' &&
    instrumentOf(polishTrack) !== 'beats' &&
    polishTrack.chart
      ? {
          trackId: polishTrack.id,
          bars: polishTrack.chart.bars,
          feels: feelsOf(polishTrack.chart),
          range: barRange(chartPlace)
        }
      : null
  const copy = (): void => {
    if (drumTarget) {
      setCopiedBeats(copyBeats(drumTarget.beats, ...drumTarget.range))
      return
    }
    if (chartTarget) {
      const [first, last] = chartTarget.range
      setCopiedBars({
        bars: copyBars(chartTarget.bars, first, last),
        feels: copyBars(chartTarget.feels, first, last)
      })
      rememberClipboard()
      return
    }
    if (open && selectedClips.length) setClipboard(copyClips(open.data, selectedClips))
  }
  // The clipboard's text when bars were last copied in Rove: Paste uses those bars until
  // something else (a chord sheet from the web) is copied.
  const clipboardAtCopy = useRef<string | null>(null)
  const rememberClipboard = (): void => {
    void window.api.readClipboardText().then((text) => {
      clipboardAtCopy.current = text
    })
  }
  const cutBars = (): void => {
    if (!open || !chartTarget || !canEdit) return
    const [first, last] = chartTarget.range
    setCopiedBars({
      bars: copyBars(chartTarget.bars, first, last),
      feels: copyBars(chartTarget.feels, first, last)
    })
    rememberClipboard()
    song.edit(
      withChartBars(open.data, chartTarget.trackId, clearBars(chartTarget.bars, first, last))
    )
  }
  const paste = (): void => {
    if (drumTarget && copiedBeats) {
      if (!open || !canEdit) return
      // As with chords: in after the selection, so pasting adds rather than overwrites.
      const at = drumTarget.range[1] + 1
      song.edit(withPastedBeats(open.data, drumTarget.trackId, at, copiedBeats))
      setChartPlace({ bar: at, slot: 0, last: at + copiedBeats.parts.length - 1 })
      return
    }
    if (chartTarget) {
      void pasteIntoChart()
      return
    }
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
  /**
   * Paste into a chord chart: a chord sheet copied from the web writes its chords over
   * the bars from the selected one on; bars copied in Rove go in after the selection.
   */
  const pasteIntoChart = async (): Promise<void> => {
    if (!open || !chartTarget || !canEdit) return
    const text = await window.api.readClipboardText()
    if (pasteSheet(chordSheetToPaste(text, copiedBars ? clipboardAtCopy.current : null))) return
    if (copiedBars) {
      // Pasted bars go in after the selection, so pasting adds to the song rather than
      // writing over what's there; pasting again lays the copies end to end.
      const at = chartTarget.range[1] + 1
      const bars = insertBars(chartTarget.bars, at, copiedBars.bars)
      const feels = insertBars(chartTarget.feels, at, copiedBars.feels)
      song.edit(withChartBars(open.data, chartTarget.trackId, bars, feels))
      setChartPlace({ bar: at, slot: 0, last: at + copiedBars.bars.length - 1 })
    }
  }
  /** Writes a pasted chord sheet over the chart from the selected bar; false without one. */
  const pasteSheet = (sheet: ReturnType<typeof chordSheetToPaste>): boolean => {
    if (!open || !chartTarget || !sheet) return false
    const [first] = chartTarget.range
    const bars = pasteBars(chartTarget.bars, first, sheet.bars)
    song.edit(withChartBars(open.data, chartTarget.trackId, bars))
    const note = unreadNote(sheet.unread, first)
    setPasteNote(note ? { trackId: chartTarget.trackId, text: note } : null)
    setChartPlace({ bar: first, slot: 0, last: first + sheet.bars.length - 1 })
    return true
  }
  /** The Paste chords button: always the clipboard, saying so when it holds no chords. */
  const pasteChords = async (): Promise<void> => {
    if (!open || !chartTarget || !canEdit) return
    const sheet = chordSheetToPaste(await window.api.readClipboardText(), null)
    if (!pasteSheet(sheet))
      setPasteNote({ trackId: chartTarget.trackId, text: t('chords.pasteNone') })
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
  /** Selects one track, as the keys that move between tracks do. */
  const selectOnlyTrack = (trackId: string): void => {
    setSelection([])
    setDeleteFocus('tracks')
    setSelectedTrackIds([trackId])
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
  const selectedVocal = open?.data.tracks.find(
    (t) => t.id === selectedTrackId && t.role === 'vocal'
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
          canPaste:
            clipboard !== null ||
            (chartTarget !== null && copiedBars !== null) ||
            (drumTarget !== null && copiedBeats !== null),
          canSplit,
          canMoveUp: placeOfSelected > 0,
          canMoveDown: placeOfSelected >= 0 && placeOfSelected < (kindOfSelected?.length ?? 0) - 1,
          canLineUp: oneClip !== null && canLineUpClip(open.data, oneClip),
          canSyncHarmony: oneClip !== null && canSyncHarmonyClip(open.data, oneClip),
          vocalPart: selectedVocal ? (selectedVocal.part ?? 'lead') : null
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
        if (chartTarget) {
          cutBars()
          break
        }
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
      case 'makeHarmony':
      case 'makeLead':
        if (canEdit && open && selectedTrackId) {
          const part = action === 'makeHarmony' ? 'harmony' : 'lead'
          song.edit(withVocalPart(open.data, selectedTrackId, part))
        }
        break
      case 'lineUp':
      case 'syncHarmony':
        if (canEdit && oneClip) void transport.fixTiming(action, oneClip.trackId, oneClip.clipId)
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
      case 'restartTake':
        void transport.restartTake()
        break
      case 'record': {
        if (mode === 'recording') {
          void transport.stop()
          break
        }
        const target = canRecord ? recordTarget(lanes, selectedTrackId) : null
        if (target) void transport.record(target)
        break
      }
      case 'previousTrack':
      case 'nextTrack': {
        const order = lanes.map((lane) => lane.id)
        const next = adjacentTrack(order, selectedTrackId, action === 'nextTrack' ? 1 : -1)
        if (next) selectOnlyTrack(next)
        break
      }
      case 'goToStart':
        transport.seek(0)
        break
      case 'goToEnd':
        if (open) transport.seek(songEnd(open.data))
        break
      case 'skipBack':
      case 'skipForward':
        if (open) transport.seek(skipTarget(open.data, position, action === 'skipBack' ? -1 : 1))
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

  useTrackNumberKeys((number) => {
    const lane = lanes[number - 1]
    if (active && lane) selectOnlyTrack(lane.id)
  })

  // The command handler reads the latest render through a ref.
  const command = useRef<(action: Command) => void>(() => {})
  useEffect(() => {
    command.current = (action) => {
      if (active) run(action)
    }
  })
  useEffect(() => onCommand((action) => command.current(action)), [])

  // Hiding the panel remembers the selection it closed on; picking a track or clip
  // (a new selection) brings it back.
  const panelShown = panelHiddenOn !== selectedTrackIds
  const hidePanel = (): void => setPanelHiddenOn(selectedTrackIds)
  const vocalRemoval = useVocalRemoval(
    song,
    polishTrack?.role === 'backing' ? polishTrack.id : null
  )
  const error = song.error ?? transport.error
  const plan = usePlan()

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
            beat={
              open
                ? {
                    locked: !canEdit,
                    click: {
                      on: musicOf(open.data).clickOn,
                      level: musicOf(open.data).click,
                      available: grid !== null,
                      onOn: (on) => song.edit(withClickOn(open.data, on)),
                      onLevel: (level, key) => song.edit(withClick(open.data, level), key)
                    },
                    tempo:
                      chordsTracks.length > 0
                        ? {
                            value: tempoOf(open.data),
                            onTempo: (bpm) =>
                              song.edit(withSongTempo(open.data, bpm), 'song-tempo'),
                            onBeats: (n) => song.edit(withSongBeats(open.data, n)),
                            onMatchMusic: musicTempo
                              ? () => song.edit(withTempoOfMusic(open.data, musicTempo))
                              : undefined
                          }
                        : null
                  }
                : null
            }
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
            onRestartTake={() => void transport.restartTake()}
            offer={transport.offer}
            onApplyOffer={transport.applyOffer}
            onDismissOffer={transport.dismissOffer}
            canEdit={canEdit}
            skipBacking={skipBacking}
            onRecordWithoutMusic={song.recordWithoutMusic}
            onAddBacking={song.addBackingTrack}
            onAddRecordedBacking={() => void song.addRecordedBacking()}
            onAddChords={startChords}
            onPickChord={pickChord}
            onSwapBars={(trackId, from, to) => {
              const track = open?.data.tracks.find((t) => t.id === trackId)
              if (open && track?.beats && instrumentOf(track) === 'beats') {
                song.edit(withBeatParts(open.data, trackId, swapBars(track.beats.parts, from, to)))
                pickChord(trackId, { bar: to, slot: 0 })
                return
              }
              const chart = track?.chart
              if (!open || !chart) return
              const feels = swapBars(feelsOf(chart), from, to)
              song.edit(withChartBars(open.data, trackId, swapBars(chart.bars, from, to), feels))
              pickChord(trackId, { bar: to, slot: 0 })
            }}
            onMoveBars={(phase, deltaSec, toleranceSec) => {
              if (!open) return
              if (phase === 'start')
                barsDrag.current = {
                  fromSec: tempoOf(open.data).startSec,
                  key: `bars-drag:${++gestureCount.current}`
                }
              const drag = barsDrag.current
              if (!drag) return
              const moved = draggedBarStart(
                drag.fromSec,
                deltaSec,
                musicOf(open.data).speed,
                musicTempo,
                toleranceSec
              )
              song.edit(withSongStart(open.data, moved.startSec), drag.key)
              setSnapAt(phase === 'end' ? null : moved.snappedAt)
              if (phase === 'end') barsDrag.current = null
            }}
            onNudgeBars={(direction) => {
              if (!open || !canEdit) return
              const { startSec } = tempoOf(open.data)
              const next = nudgedBarStart(startSec, direction, musicOf(open.data).speed)
              song.edit(withSongStart(open.data, next), 'bars-nudge')
            }}
            pickedChord={
              panelShown && polishTrack?.role === 'chords'
                ? { trackId: polishTrack.id, place: chartPlace }
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

          {panelShown && polishTrack && open && (
            <div
              className={cx(
                'bottom-panel',
                polishTrack.role === 'chords' && 'bottom-panel-instrumental'
              )}
              // Runtime geometry: the height the singer dragged it to.
              style={{ '--bottom-height': `${bottom.height}px` } as CSSProperties}
            >
              <Splitter
                className="bottom-panel-edge"
                label={t('panel.height')}
                orientation="horizontal"
                value={bottom.height}
                min={polishTrack.role === 'chords' ? INSTRUMENTAL_MIN_HEIGHT : BOTTOM_HEIGHT.min}
                max={BOTTOM_HEIGHT.max}
                perPixel={-1}
                onChange={bottom.setHeight}
              />
              {panelShown && polishTrack?.role === 'backing' && open && (
                <MusicPanel
                  trackName={polishTrack.name}
                  music={musicOf(open.data)}
                  bpm={beat?.bpm ?? null}
                  songKey={songKey}
                  locked={!canEdit}
                  onSpeed={(speed, key) => song.edit(withMusicSpeed(open.data, speed), key)}
                  onSemitones={(n, key) => song.edit(withMusicPitch(open.data, n), key)}
                  onTone={(tone, key) => song.edit(withMusicTone(open.data, tone), key)}
                  vocals={
                    offersVocals(plan, vocalRemoval.vocals)
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

              {panelShown && polishTrack?.role === 'chords' && open && (chart || beats) && (
                <ChordBackingPanel
                  key={polishTrack.id}
                  trackName={polishTrack.name}
                  instrument={instrumentOf(polishTrack)}
                  locked={!canEdit}
                  onInstrument={(instrument) =>
                    song.edit(
                      withInstrument(
                        open.data,
                        polishTrack.id,
                        instrument,
                        // New drums run as long as the song.
                        barsUntil(open.data, songEnd(open.data))
                      )
                    )
                  }
                  onHide={hidePanel}
                >
                  {beats ? (
                    <BeatsEditor
                      beats={beats}
                      beatsPerBar={tempoOf(open.data).beatsPerBar}
                      secPerBeat={barGrid(open.data, 1)?.secPerBeat ?? 1}
                      playingBar={playingBar}
                      locked={!canEdit}
                      onParts={(parts) =>
                        song.edit(withBeatParts(open.data, polishTrack.id, parts))
                      }
                      onMyBeat={(beat, parts) => {
                        const made = withMyBeat(open.data, polishTrack.id, beat)
                        song.edit(parts ? withBeatParts(made, polishTrack.id, parts) : made)
                      }}
                      onPreviewDrum={(drum) => void previewDrum(drum)}
                      onDeleteBeat={(n) => song.edit(withoutMyBeat(open.data, polishTrack.id, n))}
                      onHear={(part, onEnded) => {
                        beatPlaying.current?.()
                        beatPlaying.current = null
                        if (!part) return
                        const stop = playBeat(open.data, beats, part, () => {
                          // A beat stopped to play another ends late: only the latest counts.
                          if (beatPlaying.current !== stop) return
                          beatPlaying.current = null
                          onEnded?.()
                        })
                        beatPlaying.current = stop
                      }}
                      onRemove={() => {
                        const [first, last] = barRange(chartPlace)
                        removePickedBars({ trackId: polishTrack.id, first, last })
                      }}
                      place={chartPlace}
                      onPlace={(place) => {
                        setChartPlace(place)
                        setDeleteFocus('bars')
                      }}
                    />
                  ) : (
                    chart && (
                      <ChartEditor
                        pasteNote={pasteNote?.trackId === polishTrack.id ? pasteNote.text : null}
                        onPasteChords={() => void pasteChords()}
                        instrument={instrumentOf(polishTrack) === 'piano' ? 'piano' : 'guitar'}
                        onFeel={(first, last, feel) =>
                          song.edit(withChartFeel(open.data, polishTrack.id, first, last, feel))
                        }
                        place={chartPlace}
                        onPlace={(place) => {
                          setChartPlace(place)
                          setDeleteFocus('bars')
                        }}
                        onRemove={() => {
                          const [first, last] = barRange(chartPlace)
                          removePickedBars({ trackId: polishTrack.id, first, last })
                        }}
                        chart={chart}
                        playingBar={playingBar}
                        suggestions={suggestions}
                        locked={!canEdit}
                        onBars={(bars, feels) =>
                          song.edit(withChartBars(open.data, polishTrack.id, bars, feels))
                        }
                        beatsPerBar={tempoOf(open.data).beatsPerBar}
                        // Heard as it will play: in the key the Key knob moved it to.
                        onPreview={(chord) =>
                          void previewChord(
                            transposeChord(chord, musicOf(open.data).semitones),
                            instrumentOf(polishTrack)
                          )
                        }
                      />
                    )
                  )}
                </ChordBackingPanel>
              )}

              {panelShown && polishTrack?.role === 'vocal' && open && (
                <PolishPanel
                  key={polishTrack.id}
                  trackName={polishTrack.name}
                  part={polishTrack.part ?? 'lead'}
                  polish={polishOf(polishTrack)}
                  auto={
                    isEnabled('autoPolish', plan)
                      ? {
                          ...autoPolish,
                          suggestion: polishTrack.polishSuggestion ?? null,
                          disabled: !idle,
                          onListen: autoPolish.listen
                        }
                      : undefined
                  }
                  locked={!canEdit}
                  onHide={hidePanel}
                  onGrow={growBottomPanel}
                  onChange={(next, key) =>
                    song.edit(
                      withTrackPolish(open.data, polishTrack.id, next),
                      key ? `${key}:${polishTrack.id}` : undefined
                    )
                  }
                />
              )}
            </div>
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
                  locked={!canChangeLyrics(mode, busy)}
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
