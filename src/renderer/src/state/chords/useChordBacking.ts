import { useEffect, useMemo, useState } from 'react'
import { SAMPLE_RATE } from '../../audio/engine/engine'
import { RING_OUT_SEC, renderStrums } from '../../audio/music/guitar'
import { Project, chordsTrackOf, musicOf } from '../song/project'
import { ChordPart, chartTimeline } from './chart'
import { strumEvents } from './strum'

// Waits for edits to settle before rendering, so picking chords quickly or turning
// Speed doesn't queue up renders.
const RENDER_DEBOUNCE_MS = 250
// Recent renders kept, so undo and redo are heard straight away.
const CACHE_SIZE = 8

export interface ChordBacking {
  /** What the chords track plays; empty without one, or before the first render. */
  parts: ChordPart[]
  /** The chords changed and their new sound isn't ready; playing now would be wrong. */
  waiting: boolean
}

/** Everything the rendered sound depends on. */
function signatureOf(project: Project | undefined): string | null {
  if (!project) return null
  const track = chordsTrackOf(project)
  if (!track || !project.chart) return null
  const { speed, semitones } = musicOf(project)
  return JSON.stringify([track.id, project.chart, speed, semitones])
}

const cache = new Map<string, ChordPart>()

function remember(signature: string, part: ChordPart): void {
  cache.set(signature, part)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string)
}

async function render(project: Project): Promise<ChordPart | null> {
  const track = chordsTrackOf(project)
  const timeline = chartTimeline(project)
  if (!track || !timeline) return null
  const events = strumEvents(timeline)
  const lengthSec = timeline.endSec - timeline.startSec + RING_OUT_SEC
  const samples = await renderStrums(events, timeline.startSec, lengthSec, SAMPLE_RATE)
  const buffer = new AudioBuffer({
    length: samples.length,
    numberOfChannels: 1,
    sampleRate: SAMPLE_RATE
  })
  buffer.copyToChannel(samples, 0)
  return { trackId: track.id, buffer, start: timeline.startSec }
}

/**
 * The chords track's sound, kept in step with the chart, Speed and Key. Rendered in
 * memory, never saved: the project only holds the chart.
 */
export function useChordBacking(project: Project | undefined): ChordBacking {
  const signature = signatureOf(project)
  const [rendered, setRendered] = useState<{ signature: string; part: ChordPart | null } | null>(
    null
  )

  useEffect(() => {
    if (!project || !signature || cache.has(signature)) return
    let cancelled = false
    const timer = setTimeout(() => {
      render(project)
        .then((part) => {
          if (part) remember(signature, part)
          if (!cancelled) setRendered({ signature, part })
        })
        .catch(() => {
          // Stays silent; the next edit tries again.
          if (!cancelled) setRendered({ signature, part: null })
        })
    }, RENDER_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `signature` captures everything about the project rendering depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const part = signature
    ? (cache.get(signature) ?? (rendered?.signature === signature ? rendered.part : null))
    : null
  const ready = !signature || cache.has(signature) || rendered?.signature === signature
  const parts = useMemo(() => (part ? [part] : []), [part])
  return { parts, waiting: !ready }
}
