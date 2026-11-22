/** The list with the item at `from` moved to `to`; unchanged if `to` is off either end. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items]
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Where a dragged item ends up when dropped into the gap before `slot` (0 to length).
 * Gaps past its old place shift down by one once it leaves that place.
 */
export const indexForSlot = (from: number, slot: number): number => (slot > from ? slot - 1 : slot)
