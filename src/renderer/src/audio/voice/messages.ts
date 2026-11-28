// What the page and the voice profile worker say to each other.
import type { TakeSummary } from '@shared/songs/voice'
import type { TakeWindow } from './summary'

export interface SummariseRequest {
  /** Matches the reply to its request; the worker handles one take at a time. */
  id: number
  /** The take's WAV file. */
  bytes: Uint8Array
  window: TakeWindow
}

export type SummariseReply = { id: number; summary: TakeSummary } | { id: number; error: string }
