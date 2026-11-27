import { ContextMenuItem, MenuAction } from '@shared/menu'
import type { VocalPart } from '../song/project'

/** What was right-clicked: a clip, an empty spot in a lane, or a track's name. */
export type MenuTarget = 'clip' | 'lane' | 'track'

/** What can be done right now, as the menu bar and keys see it. */
export interface MenuState {
  canEdit: boolean
  selectedClips: number
  anyGrouped: boolean
  /** The selection is one whole group already. */
  oneGroup: boolean
  canPaste: boolean
  canSplit: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** The clicked clip is a vocal take with music to line it up with. */
  canLineUp: boolean
  /** The clicked clip is a harmony take with a lead under it. */
  canSyncHarmony: boolean
  /** The selected track's part, when it's a vocal track. */
  vocalPart: VocalPart | null
}

// Each menu's rows in order; null is a divider.
const ROWS: Record<MenuTarget, (MenuAction | null)[]> = {
  clip: [
    'cut',
    'copy',
    'paste',
    null,
    'split',
    'deleteClip',
    null,
    'lineUp',
    'syncHarmony',
    null,
    'groupClips',
    'ungroupClips'
  ],
  lane: ['paste', null, 'moveTrackUp', 'moveTrackDown'],
  track: [
    'renameTrack',
    'makeHarmony',
    'makeLead',
    null,
    'moveTrackUp',
    'moveTrackDown',
    null,
    'removeTrack'
  ]
}

/** The rows a right-click menu shows, dimming what can't be done now. */
export function contextMenu(target: MenuTarget, s: MenuState): ContextMenuItem[] {
  const clips = s.selectedClips > 0
  const enabled: Partial<Record<MenuAction, boolean>> = {
    cut: s.canEdit && clips,
    copy: clips,
    paste: s.canEdit && s.canPaste,
    split: s.canSplit,
    deleteClip: s.canEdit && clips,
    groupClips: s.canEdit && s.selectedClips > 1 && !s.oneGroup,
    ungroupClips: s.canEdit && s.anyGrouped,
    moveTrackUp: s.canEdit && s.canMoveUp,
    moveTrackDown: s.canEdit && s.canMoveDown,
    renameTrack: s.canEdit,
    removeTrack: s.canEdit,
    lineUp: s.canEdit && s.canLineUp,
    syncHarmony: s.canEdit && s.canSyncHarmony,
    makeHarmony: s.canEdit,
    makeLead: s.canEdit
  }
  // Only the part a track can switch to is shown, and none on a music track.
  const shown: Partial<Record<MenuAction, boolean>> = {
    makeHarmony: s.vocalPart === 'lead',
    makeLead: s.vocalPart === 'harmony'
  }
  return ROWS[target]
    .filter((action) => action === null || (shown[action] ?? true))
    .map((action) => (action ? { action, enabled: enabled[action] ?? false } : 'separator'))
}
