import { Chord } from '../../audio/music/chords'
import { getAudioContext } from '../../audio/engine/engine'
import { DRUM_TAIL_SEC, drum, drumLevel, renderDrums } from '../../audio/music/drums'
import { renderStrums } from '../../audio/music/guitar'
import { BarBeat, BeatChart, PadDrum, Project } from '../song/project'
import { barOf } from './beats'
import { barGrid } from './chart'
import { guitarNotes } from './strum'

// Long enough to hear the chord ring, short enough to pick the next one.
const PREVIEW_SEC = 1.5
// Quieter than the song, so trying chords while it plays doesn't drown it out.
const PREVIEW_LEVEL = 0.8

/** Strums a chord once, so picking one in the chart lets you hear it. */
export async function previewChord(chord: Chord): Promise<void> {
  const ctx = getAudioContext()
  await ctx.resume()
  const samples = await renderStrums(
    [{ time: 0, notes: guitarNotes(chord), velocity: 1, direction: 'down' }],
    0,
    PREVIEW_SEC,
    ctx.sampleRate
  )
  play(ctx, samples)
}

// The pad's drums play louder than in the song's mix, where they sit under the voice: on
// their own, at the kit's level, the hats would be hard to hear. Taps and the loop use the
// same level, so what you tap sounds like what plays back.
const PAD_BOOST = 1.5
export const PAD_PLAY_LEVEL = PAD_BOOST * PREVIEW_LEVEL

/** Strikes one drum, as the pad and its loop play it. */
export async function previewDrum(voice: PadDrum): Promise<void> {
  const ctx = getAudioContext()
  await ctx.resume()
  const level = (drumLevel(voice) * PAD_PLAY_LEVEL) / PREVIEW_LEVEL
  play(
    ctx,
    drum(voice, ctx.sampleRate).map((v) => v * level)
  )
}

/**
 * Plays one bar of a beat at the song's tempo, ringing out after it. `onEnded` is called
 * when it's over, and the returned function stops it early.
 */
export function playBeat(
  project: Project,
  beats: BeatChart,
  part: BarBeat,
  onEnded: () => void
): () => void {
  const ctx = getAudioContext()
  void ctx.resume()
  const grid = barGrid(project, 1)
  if (!grid) {
    onEnded()
    return () => {}
  }
  const lengthSec = grid.endSec - grid.startSec + DRUM_TAIL_SEC
  const samples = renderDrums(barOf(project, beats, part), 0, lengthSec, ctx.sampleRate)
  const source = play(ctx, samples)
  source.addEventListener('ended', onEnded)
  return () => source.stop()
}

function play(ctx: AudioContext, samples: Float32Array<ArrayBuffer>): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buffer.copyToChannel(samples, 0)
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = PREVIEW_LEVEL
  source.buffer = buffer
  source.connect(gain).connect(ctx.destination)
  source.addEventListener('ended', () => gain.disconnect())
  source.start()
  return source
}
