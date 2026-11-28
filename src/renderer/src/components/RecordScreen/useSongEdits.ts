import { ChartPlace, barRange } from '../../state/chords/chart/chart'
import {
  anyGrouped,
  canSplitClips,
  deleteClips,
  groupClips,
  splitClips,
  ungroupClips
} from '../../state/editing/clipSets'
import { Deletion, PickedBars, deletionOf } from '../../state/editing/trackSelection'
import { Track, moveTrack, withTrackName, withoutTracks } from '../../state/song/project'
import type { Song } from '../../state/song/useSong'
import type { SongSelection } from './useSongSelection'

interface Options {
  song: Song
  canEdit: boolean
  selection: SongSelection
  /** The track open in the panel under the timeline. */
  panelTrack: Track | undefined
  place: ChartPlace
  removeBars(bars: PickedBars): void
  position: number
}

export interface SongEdits {
  canSplit: boolean
  /** What Delete would remove now, if anything. */
  deletion: Deletion | null
  split(): void
  remove(): void
  removeTracks(trackIds: string[]): void
  group(): void
  ungroup(): void
  moveTrackTo(trackId: string, to: number): void
  /** Moves the selected track one place up or down among tracks of its kind. */
  nudgeTrack(by: -1 | 1): void
  renameTrack(trackId: string, name: string): void
}

/** Edits to the picked clips and tracks: split, delete, group and moving tracks. */
export function useSongEdits({
  song,
  canEdit,
  selection,
  panelTrack,
  place,
  removeBars,
  position
}: Options): SongEdits {
  const open = song.song
  const { selectedClips, selected, selectedTrackId, selectedTrackIds } = selection
  const canSplit = canEdit && !!open && canSplitClips(open.data, selectedClips, position)
  const pickedBars =
    panelTrack?.role === 'chords' && (panelTrack.chart || panelTrack.beats)
      ? { trackId: panelTrack.id, first: barRange(place)[0], last: barRange(place)[1] }
      : null
  const deletion = deletionOf(
    selection.deleteFocus,
    selection.selectedClip ? selected : null,
    selectedTrackIds,
    pickedBars
  )

  const removeTracks = (removed: string[]): void => {
    if (!open || !canEdit) return
    song.edit(withoutTracks(open.data, removed))
    selection.dropTracks(removed)
  }
  const moveTrackTo = (trackId: string, to: number): void => {
    if (open && canEdit) song.edit(moveTrack(open.data, trackId, to))
  }

  return {
    canSplit,
    deletion,
    split: () => {
      if (open && canSplit) song.edit(splitClips(open.data, selectedClips, position))
    },
    remove: () => {
      if (!open || !deletion) return
      if (deletion.kind === 'tracks') return removeTracks(deletion.trackIds)
      if (!canEdit) return
      if (deletion.kind === 'bars') return removeBars(deletion.bars)
      song.edit(deleteClips(open.data, selectedClips))
      selection.setClips([])
      selection.setDeleteFocus(null)
    },
    removeTracks,
    group: () => {
      if (open && canEdit && selectedClips.length > 1)
        song.edit(groupClips(open.data, selectedClips))
    },
    ungroup: () => {
      if (open && canEdit && anyGrouped(open.data, selectedClips))
        song.edit(ungroupClips(open.data, selectedClips))
    },
    moveTrackTo,
    nudgeTrack: (by) => {
      const track = open?.data.tracks.find((t) => t.id === selectedTrackId)
      if (!open || !track) return
      const at = open.data.tracks.filter((t) => t.role === track.role).indexOf(track)
      moveTrackTo(track.id, at + by)
    },
    renameTrack: (trackId, name) => {
      if (open && canEdit) song.edit(withTrackName(open.data, trackId, name))
    }
  }
}
