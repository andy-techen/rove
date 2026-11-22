/** How a click on a track name changes the selection, as in Finder. */
export type SelectMode = 'only' | 'toggle' | 'range'

export function selectMode(e: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}): SelectMode {
  if (e.shiftKey) return 'range'
  return e.metaKey || e.ctrlKey ? 'toggle' : 'only'
}

/**
 * The selected tracks after a click. The last id is the one clicked most recently:
 * polish, paste and clip navigation follow it.
 */
export function selectTracks(
  current: string[],
  clicked: string,
  mode: SelectMode,
  order: string[]
): string[] {
  if (mode === 'toggle') {
    return current.includes(clicked)
      ? current.filter((id) => id !== clicked)
      : [...current, clicked]
  }
  if (mode === 'range' && current.length > 0) {
    const anchor = order.indexOf(current[current.length - 1])
    const end = order.indexOf(clicked)
    const range = order.slice(Math.min(anchor, end), Math.max(anchor, end) + 1)
    return [...range.filter((id) => id !== clicked), clicked]
  }
  return [clicked]
}

/** The tracks a mute or remove on one track applies to: the whole selection if it's in it. */
export function tracksActedOn(selection: string[], trackId: string): string[] {
  return selection.length > 1 && selection.includes(trackId) ? selection : [trackId]
}

/** What was clicked last, which ⌫ acts on: a clip, or the selected track names. */
export type DeleteFocus = 'clip' | 'tracks' | null

export type Deletion =
  | { kind: 'clip'; clip: { trackId: string; clipId: string } }
  | { kind: 'tracks'; trackIds: string[] }

/**
 * What Delete removes. Clicking a clip also selects its track, so only a click on the
 * track names makes Delete remove whole tracks: deleting a clip and pressing Delete
 * again must not take the rest of its track with it.
 */
export function deletionOf(
  focus: DeleteFocus,
  clip: { trackId: string; clipId: string } | null,
  trackIds: string[]
): Deletion | null {
  if (focus === 'clip' && clip) return { kind: 'clip', clip }
  if (focus === 'tracks' && trackIds.length > 0) return { kind: 'tracks', trackIds }
  return null
}
