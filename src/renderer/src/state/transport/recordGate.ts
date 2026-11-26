import type { Mode } from './useTransport'

export interface RecordGate {
  mode: Mode
  /** The song has music to sing over, or the singer chose to go without. */
  hasMusic: boolean
  recorderReady: boolean
  /** A take that couldn't be saved is still waiting to be kept or discarded. */
  hasPendingTake: boolean
  busy: boolean
  /** Music at a new speed or key is still being made. */
  waiting: boolean
}

/**
 * Whether Record can start a take now. From a stop, or while the song plays: a singer
 * often hears where they want to come in and presses Record there, and the music keeps
 * going into the take.
 */
export function canStartRecording(gate: RecordGate): boolean {
  return (
    (gate.mode === 'idle' || gate.mode === 'playing') &&
    gate.hasMusic &&
    gate.recorderReady &&
    !gate.hasPendingTake &&
    !gate.busy &&
    !gate.waiting
  )
}

/**
 * Whether the lyrics can be picked or nudged. Unlike clip edits this is fine mid-take:
 * the singer often wants the words up once they've started, and the take lands in the
 * song as it is when they stop. Only a save in progress waits, as it would overwrite it.
 */
export function canChangeLyrics(mode: Mode, busy: boolean): boolean {
  return mode !== 'saving' && !busy
}
