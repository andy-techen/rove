import { useState } from 'react'
import { MenuTarget } from '../../state/commands/contextMenu'
import { ClipRef, includesClip, pickClip, withGroupmates } from '../../state/editing/clipSets'
import { DeleteFocus, SelectMode, selectTracks } from '../../state/editing/trackSelection'
import { Clip, findClip } from '../../state/song/project'
import type { OpenSong } from '../../state/song/useSong'

export interface SongSelection {
  /** Picked clips still in the song, the most recently clicked last. */
  selectedClips: ClipRef[]
  /** The most recently clicked of them: split and navigation follow it. */
  selected: ClipRef | null
  selectedClip: Clip | undefined
  /** Lining up and syncing act on one take at a time. */
  oneClip: ClipRef | null
  /** Selected tracks, most recently clicked last: polish, paste and navigation follow it. */
  selectedTrackIds: string[]
  selectedTrackId: string | null
  /** Whether Delete acts on the clicked clip, the selected tracks or the picked bars. */
  deleteFocus: DeleteFocus
  setDeleteFocus(focus: DeleteFocus): void
  /** Whether the panel under the timeline shows; hiding it lasts until a new selection. */
  panelShown: boolean
  hidePanel(): void
  selectClip(clip: ClipRef | null, how: SelectMode): void
  selectBox(clips: ClipRef[], add: boolean): void
  /** Sets the clips picked outright, as a drag or paste leaves them. */
  setClips(clips: ClipRef[]): void
  selectTrack(trackId: string, mode: SelectMode, order: string[]): void
  /** Selects one track, as the keys that move between tracks do. */
  selectOnlyTrack(trackId: string): void
  /**
   * Makes one track the selected one, as a click on its lane does, without the track
   * names' Delete; `focus`, when given, is what Delete acts on next.
   */
  showTrack(trackId: string, focus?: DeleteFocus): void
  /** What a right-click picks before its menu shows. */
  selectForMenu(target: MenuTarget, trackId: string, clip: ClipRef | null): void
  selectAll(): void
  deselect(): void
  /** Forgets tracks that were removed. */
  dropTracks(removed: string[]): void
}

/** The picked clips and tracks of one open song, and how clicks change them. */
export function useSongSelection(open: OpenSong | null): SongSelection {
  const [selection, setSelection] = useState<ClipRef[]>([])
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const [deleteFocus, setDeleteFocus] = useState<DeleteFocus>(null)
  const [panelHiddenOn, setPanelHiddenOn] = useState<string[] | null>(null)
  // Clips can vanish under the selection (undo, a punch-in); only those still there count.
  const selectedClips = open
    ? selection.filter((ref) => findClip(open.data, ref.trackId, ref.clipId))
    : []
  const selected = selectedClips.at(-1) ?? null
  const selectedClip =
    selected && open ? findClip(open.data, selected.trackId, selected.clipId) : undefined

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

  return {
    selectedClips,
    selected,
    selectedClip,
    oneClip: selectedClips.length === 1 ? selected : null,
    selectedTrackIds,
    selectedTrackId: selectedTrackIds.at(-1) ?? null,
    deleteFocus,
    setDeleteFocus,
    // Hiding the panel remembers the selection it closed on; picking a track or clip
    // (a new selection) brings it back.
    panelShown: panelHiddenOn !== selectedTrackIds,
    hidePanel: () => setPanelHiddenOn(selectedTrackIds),
    selectClip,
    selectBox: (clips, add) => {
      if (!open) return
      const picked = withGroupmates(open.data, clips)
      const kept = add ? selectedClips.filter((r) => !includesClip(picked, r)) : []
      setSelection([...kept, ...picked])
      setDeleteFocus(picked.length || kept.length ? 'clip' : null)
    },
    setClips: setSelection,
    selectTrack: (trackId, mode, order) => {
      setSelection([])
      setDeleteFocus('tracks')
      setSelectedTrackIds((ids) => selectTracks(ids, trackId, mode, order))
    },
    selectOnlyTrack,
    showTrack: (trackId, focus) => {
      setSelectedTrackIds([trackId])
      if (focus !== undefined) setDeleteFocus(focus)
    },
    selectForMenu: (target, trackId, clip) => {
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
    },
    selectAll: () => {
      if (!open) return
      setSelection([])
      setSelectedTrackIds(open.data.tracks.map((track) => track.id))
      setDeleteFocus('tracks')
    },
    deselect: () => {
      setSelection([])
      setSelectedTrackIds([])
      setDeleteFocus(null)
    },
    dropTracks: (removed) => {
      setSelection((refs) => refs.filter((ref) => !removed.includes(ref.trackId)))
      setSelectedTrackIds((ids) => ids.filter((id) => !removed.includes(id)))
      setDeleteFocus(null)
    }
  }
}
