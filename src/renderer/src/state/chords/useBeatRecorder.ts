import { useEffect, useRef, useState } from 'react'
import { getAudioContext } from '../../audio/engine/engine'
import { BeatLoop, startBeatLoop } from '../../audio/music/beatLoop'
import { BeatsPerBar, MyBeat, PadDrum, PadHit } from '../song/project'
import { myBeatBar, placeTap, withHit } from './beats'
import { PAD_PLAY_LEVEL } from './preview'

// One bar of click alone, so the first tap can land on one.
const COUNT_IN_BARS = 1
// How often to check whether the count-in is over.
const CHECK_MS = 50

/** Off; clicking through the count-in; or looping and catching taps. */
export type RecordingState = 'off' | 'counting' | 'recording'

interface Options {
  /** The beat on the pad, which the loop plays and taps go into. */
  beat: MyBeat | undefined
  beatsPerBar: BeatsPerBar
  secPerBeat: number
  /** Taps land on the nearest sixteenth. */
  snap: boolean
  onHits(hits: PadHit[]): void
  /** Plays a drum straight away, as it's tapped. */
  onPreview(drum: PadDrum): void
}

interface BeatRecorder {
  state: RecordingState
  /** Starts recording (after a count-in), or stops it. */
  toggle(): void
  /** A drum played: heard straight away, and caught in the beat while recording. */
  tap(drum: PadDrum): void
  /** Beats into the bar being heard now, while the loop plays (count-in included). */
  position(): number | null
}

/**
 * Records a beat by playing it: the bar loops with a click, and every drum tapped lands
 * in the beat where it was played. Each time round, earlier taps play back, so a beat
 * can be built a drum at a time.
 */
export function useBeatRecorder(options: Options): BeatRecorder {
  const [state, setState] = useState<RecordingState>('off')
  const loop = useRef<BeatLoop | null>(null)
  // Taps come faster than renders: the latest hits, so none overwrites another.
  const beat = useRef(options.beat)
  useEffect(() => {
    beat.current = options.beat
  }, [options.beat])
  const timing = `${options.beatsPerBar}:${options.secPerBeat}:${options.beat?.n}`

  const stop = (): void => {
    loop.current?.stop()
    loop.current = null
    setState('off')
  }
  // A new tempo, count or beat stops the loop rather than play it out of step.
  useEffect(() => stop, [timing])

  useEffect(() => {
    if (state !== 'counting') return
    const timer = setInterval(() => {
      if (loop.current && !loop.current.tapAt().counting) setState('recording')
    }, CHECK_MS)
    return () => clearInterval(timer)
  }, [state])

  const toggle = (): void => {
    if (loop.current) return stop()
    if (!beat.current) return
    const ctx = getAudioContext()
    void ctx.resume()
    loop.current = startBeatLoop(ctx, {
      secPerBeat: options.secPerBeat,
      beatsPerBar: options.beatsPerBar,
      countInBars: COUNT_IN_BARS,
      level: PAD_PLAY_LEVEL,
      hits: () =>
        beat.current ? myBeatBar(beat.current, options.beatsPerBar, options.secPerBeat) : []
    })
    setState('counting')
  }

  const tap = (drum: PadDrum): void => {
    options.onPreview(drum)
    const current = beat.current
    const where = loop.current?.tapAt()
    if (!current || !where || where.counting) return
    const at = placeTap(where.at, options.beatsPerBar, options.snap)
    const hits = withHit(current.hits, { drum, at })
    if (hits === current.hits) return
    beat.current = { ...current, hits }
    options.onHits(hits)
  }

  return { state, toggle, tap, position: () => loop.current?.tapAt().at ?? null }
}
