import { RefObject, useEffect, useRef } from 'react'

/**
 * Scrolls a newly added track into view, so adding one to a long song doesn't leave
 * it hidden below the fold. Tracks present on first render (an opened song) don't count.
 */
export function useRevealNewTrack(
  lanesRef: RefObject<HTMLDivElement | null>,
  trackIds: string[]
): void {
  const known = useRef<Set<string> | null>(null)
  const key = trackIds.join()
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const added = known.current ? ids.find((id) => !known.current?.has(id)) : undefined
    known.current = new Set(ids)
    if (!added) return
    const lane = lanesRef.current?.querySelector(`[data-track="${CSS.escape(added)}"]`)
    // A new track is last in its group, just above that group's "Add" row; showing
    // the row as well keeps adding another one a click away. Not every DOM (jsdom) can scroll.
    const target = lane?.nextElementSibling ?? lane
    target?.scrollIntoView?.({ block: 'nearest' })
  }, [key, lanesRef])
}
