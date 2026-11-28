import { useEffect, useRef } from 'react'
import { NUMBERED_TRACKS } from './constants'

/** The keys that pick a track by number. */
type TrackKey = Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

/**
 * Which track ⌘1–⌘9 (Ctrl elsewhere) picks, counting lanes from 1 at the top; null for
 * any other keys. Read from the key's code, so it works whatever the keyboard layout.
 */
export function trackNumberOf(e: TrackKey, platform: string): number | null {
  const command = platform === 'darwin' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
  if (!command || e.altKey || e.shiftKey) return null
  const digit = /^Digit(\d)$/.exec(e.code)
  const number = digit ? Number(digit[1]) : 0
  return number >= 1 && number <= NUMBERED_TRACKS ? number : null
}

/**
 * Calls `onPick` with the track number when ⌘1–⌘9 is pressed. Fixed keys, listed in
 * Shortcuts like a gesture; the menu doesn't carry them.
 */
export function useTrackNumberKeys(onPick: (number: number) => void): void {
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const number = trackNumberOf(e, window.api.platform)
      if (number === null || e.repeat) return
      e.preventDefault()
      pick.current(number)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
