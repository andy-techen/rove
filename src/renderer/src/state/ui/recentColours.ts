import { useCallback, useState } from 'react'

const KEY = 'rove.recentColours'
/** How many recent colours to offer: a few to come back to, not a palette. */
export const RECENT_COLOURS = 3
// One more is kept than shown, since the one in use isn't offered again.
const KEPT = RECENT_COLOURS + 1
const HEX = /^#[0-9a-f]{6}$/i

/** `recent` with `colour` first, listed once, cut to the most recent few. */
export function withRecent(recent: string[], colour: string): string[] {
  const same = (c: string): boolean => c.toLowerCase() === colour.toLowerCase()
  const kept = recent.find(same) ?? colour
  return [kept, ...recent.filter((c) => !same(c))].slice(0, KEPT)
}

// Colours picked are a preference for this computer, shared by every song.
function recall(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === 'string' && HEX.test(c))
      : []
  } catch {
    return []
  }
}

/**
 * The colours the singer picked most recently, newest first, leaving out `current` (the
 * one in use), and a way to add one.
 */
export function useRecentColours(current: string): [string[], (colour: string) => void] {
  const [recent, setRecent] = useState(recall)
  const remember = useCallback((colour: string): void => {
    const next = withRecent(recall(), colour)
    setRecent(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage off or full: the colours still show for this session.
    }
  }, [])
  const others = recent.filter((c) => c.toLowerCase() !== current.toLowerCase())
  return [others.slice(0, RECENT_COLOURS), remember]
}
