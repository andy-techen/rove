import { useEffect, useRef } from 'react'
import { PadDrum } from '../../state/song/project'
import { typingIn } from '../../state/commands/commands'

/**
 * The home row plays the pad, four drums under each hand: kick to rim on the left,
 * cymbals and tom on the right, as fingers drum on a table. They work while the pad is
 * open, outside text fields; the pad's own buttons cover everything for the mouse.
 */
export const PAD_KEY_CODES: Record<PadDrum, string> = {
  kick: 'KeyA',
  snare: 'KeyS',
  clap: 'KeyD',
  rim: 'KeyF',
  hat: 'KeyJ',
  openHat: 'KeyK',
  tom: 'KeyL',
  crash: 'Semicolon'
}
/** Starts and stops recording. */
export const RECORD_KEY = 'KeyR'
/** Plays the beat once. */
export const HEAR_KEY = 'KeyP'

// Letter keys' codes are "Key" and the letter ("KeyA").
const LETTER_CODE = 'Key'

/** A key as it's printed on the keyboard ("A", ";"). */
export const keyLabel = (code: string): string =>
  code === PAD_KEY_CODES.crash ? ';' : code.slice(LETTER_CODE.length)

const drumFor = Object.fromEntries(
  Object.entries(PAD_KEY_CODES).map(([drum, code]) => [code, drum as PadDrum])
)

interface PadKeyActions {
  drum(drum: PadDrum): void
  record(): void
  hear(): void
}

/** Listens for the pad's keys anywhere in the window while `active`. */
export function usePadKeys(active: boolean, actions: PadKeyActions): void {
  // The latest handlers, so the listener isn't added again on every render.
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || typingIn(e.target)) return
      const drum = drumFor[e.code]
      if (drum) latest.current.drum(drum)
      else if (e.code === RECORD_KEY) latest.current.record()
      else if (e.code === HEAR_KEY) latest.current.hear()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
