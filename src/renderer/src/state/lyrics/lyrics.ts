import { t } from '@shared/copy'
import { LyricsResult } from '@shared/online/lyrics'
import { MS_PER_SEC, SEC_PER_MIN } from '@shared/units'

export interface LyricLine {
  /** Seconds into the song the line is sung; null when the lyrics have no timing. */
  time: number | null
  /** Empty for a pause between verses. */
  text: string
}

/** A song's lyrics, saved in its project. */
export interface SongLyrics {
  title: string
  artist?: string
  lines: LyricLine[]
  /**
   * Seconds to move every line later (negative: earlier), for a backing track whose
   * intro is longer or shorter than the recording the timings came from.
   */
  offsetSec: number
}

// [mm:ss.xx] — LRC timestamps; hundredths and thousandths are both common.
const TIMESTAMP = /\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\]/im

/** Reads timed (LRC) or plain lyrics. Several blank lines in a row count as one break. */
export function parseLyricsText(text: string): LyricLine[] {
  // The LRC offset is in milliseconds; a positive one makes lines appear sooner.
  const offsetSec = Number(text.match(OFFSET_TAG)?.[1] ?? 0) / MS_PER_SEC
  const timed: LyricLine[] = []
  for (const row of text.split(/\r?\n/)) {
    const stamps = [...row.matchAll(TIMESTAMP)]
    if (!stamps.length) continue
    const words = row.replace(TIMESTAMP, '').trim()
    for (const [, min, sec] of stamps) {
      timed.push({ time: Number(min) * SEC_PER_MIN + Number(sec) - offsetSec, text: words })
    }
  }
  if (timed.length) return timed.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

  const lines: LyricLine[] = []
  for (const row of text.trim().split(/\r?\n/)) {
    const words = row.trim()
    if (!words && lines.at(-1)?.text === '') continue
    lines.push({ time: null, text: words })
  }
  return lines
}

/** When a line starts on the timeline, after the timing nudge. */
export const lineStart = (line: LyricLine, offsetSec: number): number | null =>
  line.time === null ? null : Math.max(0, line.time + offsetSec)

/** The line being sung at `positionSec`: the last one that has started, or -1. */
export function activeLineIndex(
  lines: LyricLine[],
  positionSec: number,
  offsetSec: number
): number {
  let active = -1
  lines.forEach((line, i) => {
    const start = lineStart(line, offsetSec)
    if (start !== null && start <= positionSec) active = i
  })
  return active
}

export const isTimed = (lyrics: SongLyrics): boolean => lyrics.lines.some((l) => l.time !== null)

export function lyricsFromResult(result: LyricsResult): SongLyrics {
  return {
    title: result.title,
    artist: result.artist,
    lines: parseLyricsText(result.synced ?? result.plain ?? ''),
    offsetSec: 0
  }
}

/** The timing nudge as shown: "+0.25 s", "−1.00 s", "0.00 s". */
export function formatOffset(sec: number): string {
  const sign = sec > 0 ? '+' : sec < 0 ? '−' : ''
  return t('lyrics.offset', { sign, seconds: Math.abs(sec).toFixed(2) })
}

/** What the lyrics search starts with: the song's name, unless it hasn't been named yet. */
export const searchFromName = (songName: string): string =>
  songName.startsWith(t('dialogs.untitledSong')) ? '' : songName
