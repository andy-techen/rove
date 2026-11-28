// Auto polish learns the singer's taste from songs they've finished: on each vocal track
// it polished, it compares where the singer left the knobs with what it set. Nothing
// is stored apart from the songs themselves, so undoing, re-recording or deleting a song
// changes what Rove learns on its own.

/** What auto polish heard in a vocal track's takes. Levels are dBFS (RMS). */
export interface PolishReading {
  /** Typical singing level: the median of the sung moments. */
  voiceDb: number
  /** Soft singing: the quietest tenth of the sung moments. */
  softDb: number
  /** How far strong singing rises above soft singing. */
  rangeDb: number
  /** The room between lines. */
  noiseDb: number
  /** Mains hum or rumble between lines. */
  hum: boolean
  /** Level of the "s" sounds above the de-esser's split; null when there are too few. */
  sibilanceDb: number | null
  /** The voice's tone, per Hz, relative to 1–2 kHz: body, presence and air. */
  bodyDb: number
  presenceDb: number
  airDb: number
  /** Some of a take hit full scale: too loud to fix afterwards. */
  clipped: boolean
}

/** The Polish controls auto polish sets (all but Tuning, which changes the singing). */
export const TASTE_CONTROLS = [
  'cleanup',
  'clarity',
  'warmth',
  'smoothness',
  'space',
  'deEss'
] as const
export type TasteControl = (typeof TASTE_CONTROLS)[number]

/** One vocal track auto polish set, and where the singer left its knobs. */
export interface TasteExample {
  trackId: string
  part: 'lead' | 'harmony'
  /** When the song was last saved, in ms since the epoch: newer songs count for more. */
  savedAt: number
  /** What auto polish heard, so its suggestion can be worked out again under today's rules. */
  reading: PolishReading
  /** Where the singer left each knob. */
  kept: Record<TasteControl, number>
}

// Clip windows are compared to the millisecond: finer differences can't be heard.
const HEARD_DECIMALS = 3

interface HeardClip {
  file: string
  offset: number
  duration: number
}

/** Names the clip windows a track plays, so a suggestion knows what it listened to. */
export function heardOfClips(clips: HeardClip[]): string {
  return clips
    .map(
      (c) => `${c.file}@${c.offset.toFixed(HEARD_DECIMALS)}+${c.duration.toFixed(HEARD_DECIMALS)}`
    )
    .sort()
    .join('|')
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isAmount = (v: unknown): v is number => isNumber(v) && v >= 0 && v <= 1

const READING_LEVELS = [
  'voiceDb',
  'softDb',
  'rangeDb',
  'noiseDb',
  'bodyDb',
  'presenceDb',
  'airDb'
] as const

export function parseReading(raw: unknown): PolishReading | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  if (!READING_LEVELS.every((key) => isNumber(r[key]))) return null
  if (typeof r.hum !== 'boolean' || typeof r.clipped !== 'boolean') return null
  if (r.sibilanceDb !== null && !isNumber(r.sibilanceDb)) return null
  const levels = Object.fromEntries(READING_LEVELS.map((key) => [key, r[key] as number]))
  return {
    ...(levels as Record<(typeof READING_LEVELS)[number], number>),
    hum: r.hum,
    clipped: r.clipped,
    sibilanceDb: r.sibilanceDb
  }
}

function parseClips(raw: unknown): HeardClip[] | null {
  if (!Array.isArray(raw)) return null
  const clips: HeardClip[] = []
  for (const clip of raw as unknown[]) {
    const c = clip as { file?: unknown; offset?: unknown; duration?: unknown } | null
    if (!c || typeof c.file !== 'string' || !isNumber(c.offset) || !isNumber(c.duration)) {
      return null
    }
    clips.push({ file: c.file, offset: c.offset, duration: c.duration })
  }
  return clips
}

/**
 * The vocal tracks in a song's project.json that auto polish set and that still play
 * what it heard. A track whose takes changed since, whose Polish is switched off (the
 * singer may be comparing) or that came from an older Rove without a reading is skipped.
 */
export function tasteExamplesOf(manifest: unknown, savedAt: number): TasteExample[] {
  const m = manifest as { tracks?: unknown } | null
  if (!m || !Array.isArray(m.tracks)) return []
  return (m.tracks as unknown[]).flatMap((track): TasteExample[] => {
    const tr = track as Record<string, unknown> | null
    if (!tr || tr.role !== 'vocal' || typeof tr.id !== 'string') return []
    const suggestion = tr.polishSuggestion as { heard?: unknown; reading?: unknown } | undefined
    const polish = tr.polish as Record<string, unknown> | undefined
    const clips = parseClips(tr.clips)
    const reading = parseReading(suggestion?.reading)
    if (!suggestion || !polish || !clips || !reading) return []
    if (polish.enabled === false || suggestion.heard !== heardOfClips(clips)) return []
    if (!TASTE_CONTROLS.every((key) => isAmount(polish[key]))) return []
    const kept = Object.fromEntries(TASTE_CONTROLS.map((key) => [key, polish[key] as number]))
    return [
      {
        trackId: tr.id,
        part: tr.part === 'harmony' ? 'harmony' : 'lead',
        savedAt,
        reading,
        kept: kept as Record<TasteControl, number>
      }
    ]
  })
}

export const TASTE_CHANNELS = {
  listExamples: 'taste:listExamples'
} as const

/** What window.api offers auto polish for learning the singer's taste. */
export interface TasteApi {
  /** Every polished vocal track across the Songbook, newest song first. */
  listExamples(): Promise<TasteExample[]>
}
