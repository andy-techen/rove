import { KeyboardEvent, useEffect, useRef } from 'react'
import { ChartPlace, barRange } from '../../state/chords/chart/chart'

interface Options {
  /** How many bars there are. */
  count: number
  barsPerLine: number
  place: ChartPlace
  onPlace(place: ChartPlace): void
  locked: boolean
  /** Takes the picked bars out (Delete or Backspace). */
  onRemove(): void
}

interface BarGrid {
  /** The bar being written, kept inside the chart. */
  selected: number
  /** The picked run of bars, first to last; the same bar when only one is picked. */
  first: number
  last: number
  /** Whether the selected bar's line is whole, so it can be repeated. */
  lineIsFull: boolean
  /** Picks a bar (and, with `extend`, every bar from the selected one to it). */
  select(bar: number, focus?: boolean, extend?: boolean): void
  /** Wires bar `i`'s button, so the grid can focus it. */
  barRef(i: number): (el: HTMLButtonElement | null) => void
  onGridKey(e: KeyboardEvent<HTMLOListElement>): void
  /** Picks the bar about to be added, and focuses it once it's drawn. */
  pickNewBar(): void
}

/**
 * A grid of bars, a line to each phrase: picking one or a run with clicks and the arrow
 * keys (Shift extends), and Delete to take the picked bars out.
 */
export function useBarGrid({
  count,
  barsPerLine,
  place,
  onPlace,
  locked,
  onRemove
}: Options): BarGrid {
  const barRefs = useRef<(HTMLButtonElement | null)[]>([])
  // A new bar doesn't exist until the chart comes back, so it's focused once drawn.
  const focusOnDraw = useRef<number | null>(null)
  useEffect(() => {
    const bar = focusOnDraw.current
    if (bar === null || !barRefs.current[bar]) return
    focusOnDraw.current = null
    barRefs.current[bar]?.focus()
  }, [count])

  const clampBar = (bar: number): number => Math.max(0, Math.min(count - 1, bar))
  const selected = clampBar(place.bar)
  const [first, last] = barRange({
    ...place,
    bar: selected,
    last: clampBar(place.last ?? selected)
  })

  const select = (bar: number, focus = false, extend = false): void => {
    const next = clampBar(bar)
    onPlace(extend ? { bar: selected, slot: 0, last: next } : { bar: next, slot: 0 })
    if (focus) barRefs.current[next]?.focus()
  }

  const onGridKey = (e: KeyboardEvent<HTMLOListElement>): void => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -barsPerLine,
      ArrowDown: barsPerLine
    }
    if (e.key in moves) {
      e.preventDefault()
      const from = e.shiftKey ? (place.last ?? selected) : selected
      select(from + moves[e.key], true, e.shiftKey)
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && !locked) {
      e.preventDefault()
      onRemove()
    }
  }

  return {
    selected,
    first,
    last,
    // Only a whole line of bars repeats: a part-filled last line isn't a phrase yet.
    lineIsFull: count >= (Math.floor(selected / barsPerLine) + 1) * barsPerLine,
    select,
    barRef: (i) => (el) => {
      barRefs.current[i] = el
    },
    onGridKey,
    pickNewBar: () => {
      onPlace({ bar: count, slot: 0 })
      focusOnDraw.current = count
    }
  }
}
