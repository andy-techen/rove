import { useEffect, useMemo, useState } from 'react'
import { SAMPLE_RATE } from '../../audio/engine/engine'
import { DRUM_TAIL_SEC, renderDrums } from '../../audio/music/drums'
import { RING_OUT_SEC, renderStrums } from '../../audio/music/guitar'
import { PIANO_RING_OUT_SEC, loadPianoSamples, renderPiano } from '../../audio/music/piano'
import { Project, Track, chordsTracksOf, instrumentOf, musicOf, tempoOf } from '../song/project'
import { beatHits } from './beats'
import { ChartTimeline, ChordPart, instrumentalTimeline } from './chart'
import { pianoEvents } from './pianoPart'
import { eventsFor } from './strum'

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

/** Everything a chords track's rendered sound depends on. */
function signatureOf(project: Project, track: Track): string | null {
  const { speed, semitones } = musicOf(project)
  const tempo = tempoOf(project)
  const instrument = instrumentOf(track)
  if (instrument === 'beats') {
    // Drums don't change with Key.
    return track.beats ? JSON.stringify([track.id, 'beats', track.beats, speed, tempo]) : null
  }
  if (!track.chart) return null
  return JSON.stringify([track.id, instrument, track.chart, speed, semitones, tempo])
}

const cache = new Map<string, ChordPart | null>()

function remember(signature: string, part: ChordPart | null): void {
  cache.set(signature, part)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string)
}

/** The instrument's part over `timeline`, rendered from its start, with its last notes ringing. */
async function renderPart(
  track: Track,
  timeline: ChartTimeline
): Promise<Float32Array<ArrayBuffer>> {
  const { startSec } = timeline
  const span = timeline.endSec - startSec
  const instrument = instrumentOf(track)
  if (instrument === 'beats' && track.beats)
    return renderDrums(beatHits(timeline, track.beats), startSec, span + DRUM_TAIL_SEC, SAMPLE_RATE)
  const feels = track.chart?.feels
  if (instrument === 'piano') {
    const samples = await loadPianoSamples(SAMPLE_RATE)
    const events = pianoEvents(timeline, feels)
    return renderPiano(events, samples, startSec, span + PIANO_RING_OUT_SEC, SAMPLE_RATE)
  }
  return renderStrums(eventsFor(timeline, feels), startSec, span + RING_OUT_SEC, SAMPLE_RATE)
}

async function render(project: Project, track: Track): Promise<ChordPart | null> {
  const timeline = instrumentalTimeline(project, track)
  if (!timeline) return null
  const samples = await renderPart(track, timeline)
  const buffer = new AudioBuffer({
    length: samples.length,
    numberOfChannels: 1,
    sampleRate: SAMPLE_RATE
  })
  buffer.copyToChannel(samples, 0)
  return { trackId: track.id, buffer, start: timeline.startSec }
}

/**
 * Every instrumental's sound, kept in step with what's written for it, Speed and Key. Rendered in
 * memory, never saved: the project only holds the charts.
 */
export function useChordBacking(project: Project | undefined): ChordBacking {
  const wanted = project
    ? chordsTracksOf(project).flatMap((track) => {
        const signature = signatureOf(project, track)
        return signature ? [{ track, signature }] : []
      })
    : []
  const key = wanted.map((w) => w.signature).join('\n')
  // Bumped when a render lands, so the parts are read from the cache again.
  const [, setRendered] = useState(0)

  useEffect(() => {
    const missing = wanted.filter((w) => !cache.has(w.signature))
    if (!project || !missing.length) return
    let cancelled = false
    const timer = setTimeout(() => {
      void Promise.all(
        missing.map(({ track, signature }) =>
          render(project, track)
            .then((part) => remember(signature, part))
            // Stays silent; the next edit tries again.
            .catch(() => remember(signature, null))
        )
      ).then(() => {
        if (!cancelled) setRendered((n) => n + 1)
      })
    }, RENDER_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `key` captures everything about the project rendering depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const ready = wanted.every((w) => cache.has(w.signature))
  const parts = useMemo(
    () => wanted.flatMap((w) => cache.get(w.signature) ?? []),
    // The cache only changes when a render lands, which re-renders with a new key or count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, ready]
  )
  return { parts, waiting: !ready }
}
