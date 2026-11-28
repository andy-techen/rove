import { useEffect, useRef } from 'react'
import { NATIVE_EDITS, NativeEdit } from '@shared/preferences/menu'
import type { ClipRef } from '../editing/clipSets'
import { adjacentTrack } from '../editing/trackSelection'
import { Project, withVocalPart } from '../song/project'
import { edgeAfter, edgeBefore, skipTarget, songEnd } from '../song/selectors'
import { exportSongFile } from '../song/songFile'
import type { Song } from '../song/useSong'
import type { Transport } from '../transport/useTransport'
import { Command, onCommand, typingIn } from './commands'

/** What an open song's commands act on, as the screen sees it this render. */
export interface SongCommandContext {
  song: Song
  transport: Transport
  canEdit: boolean
  /** The track Record would take on, or null when it can't start. */
  recordTrackId: string | null
  /** Track ids in lane order, top to bottom. */
  trackOrder: string[]
  selectedTrackId: string | null
  /** The one clip lining up and syncing act on. */
  oneClip: ClipRef | null
  /** The track the edge keys follow; null for every track. */
  navTrack: string | null
  /**
   * A dialog over the song (export) has the keyboard: commands leave the song alone,
   * and the dialog handles its own (the picture editor's undo).
   */
  behindDialog: boolean
  copy(): void
  cut(): void
  paste(): void
  split(): void
  remove(): void
  group(): void
  ungroup(): void
  nudgeTrack(by: -1 | 1): void
  renameTrack(): void
  removeSelectedTracks(): void
  selectOnlyTrack(trackId: string): void
  deselect(): void
  selectAll(): void
  openExport(): void
  toggleLyrics(): void
  toggleChords(): void
}

/** The native text edit a command stands for, when it's one of them. */
export const nativeEditFor = (action: Command): NativeEdit | null =>
  (NATIVE_EDITS as readonly string[]).includes(action) ? (action as NativeEdit) : null

/** What each command does to the open song. */
export function songCommands(c: SongCommandContext): Partial<Record<Command, () => void>> {
  const { song, transport, canEdit } = c
  const open = song.song
  const position = transport.position
  const fixTiming = (kind: 'lineUp' | 'syncHarmony') => (): void => {
    if (canEdit && c.oneClip) void transport.fixTiming(kind, c.oneClip.trackId, c.oneClip.clipId)
  }
  const makePart = (part: 'lead' | 'harmony') => (): void => {
    if (canEdit && open && c.selectedTrackId)
      song.edit(withVocalPart(open.data, c.selectedTrackId, part))
  }
  const stepTrack = (step: -1 | 1) => (): void => {
    const next = adjacentTrack(c.trackOrder, c.selectedTrackId, step)
    if (next) c.selectOnlyTrack(next)
  }
  const seekTo = (to: (data: Project) => number) => (): void => {
    if (open) transport.seek(to(open.data))
  }
  return {
    save: () => void song.saveNow(),
    export: c.openExport,
    exportProject: () => {
      if (open) void exportSongFile({ dir: open.dir, saveNow: song.saveNow })
    },
    undo: () => {
      if (canEdit) song.undo()
    },
    redo: () => {
      if (canEdit) song.redo()
    },
    copy: c.copy,
    cut: c.cut,
    paste: c.paste,
    split: c.split,
    deleteClip: c.remove,
    groupClips: c.group,
    ungroupClips: c.ungroup,
    makeHarmony: makePart('harmony'),
    makeLead: makePart('lead'),
    lineUp: fixTiming('lineUp'),
    syncHarmony: fixTiming('syncHarmony'),
    moveTrackUp: () => c.nudgeTrack(-1),
    moveTrackDown: () => c.nudgeTrack(1),
    renameTrack: c.renameTrack,
    removeTrack: c.removeSelectedTracks,
    deselect: c.deselect,
    selectAll: c.selectAll,
    playPause: transport.togglePlay,
    stopPlayback: transport.stopPlayback,
    restartTake: () => void transport.restartTake(),
    record: () => {
      if (transport.mode === 'recording') void transport.stop()
      else if (c.recordTrackId) void transport.record(c.recordTrackId)
    },
    previousTrack: stepTrack(-1),
    nextTrack: stepTrack(1),
    goToStart: () => transport.seek(0),
    goToEnd: seekTo(songEnd),
    skipBack: seekTo((data) => skipTarget(data, position, -1)),
    skipForward: seekTo((data) => skipTarget(data, position, 1)),
    previousEdge: seekTo((data) => edgeBefore(data, position, c.navTrack)),
    nextEdge: seekTo((data) => edgeAfter(data, position, c.navTrack)),
    toggleLyrics: c.toggleLyrics,
    toggleChords: c.toggleChords
  }
}

/**
 * Runs every command, whether it came from a key or the menu bar, while this song's tab
 * is the visible one. In a text field, editing commands act on the text, not the song.
 */
export function useSongCommands(active: boolean, context: SongCommandContext): void {
  // The command listener reads the latest render through a ref.
  const run = useRef<(action: Command) => void>(() => {})
  useEffect(() => {
    run.current = (action) => {
      if (!active) return
      const native = nativeEditFor(action)
      if (native && typingIn(document.activeElement)) void window.api.nativeEdit(native)
      else if (!context.behindDialog) songCommands(context)[action]?.()
    }
  })
  useEffect(() => onCommand((action) => run.current(action)), [])
}
