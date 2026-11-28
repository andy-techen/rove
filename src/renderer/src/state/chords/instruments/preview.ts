import { Chord } from '../../../audio/music/chords'
import { getAudioContext } from '../../../audio/engine/engine'
import { drum, drumLevel, renderDrums } from '../../../audio/music/drums'
import { renderStrums } from '../../../audio/music/guitar'
import { loadPianoSamples, renderPiano } from '../../../audio/music/piano'
import { DRUM_TAIL_SEC, PIANO_RING_OUT_SEC } from '../../../audio/music/constants'
import { BarBeat, BeatChart, Instrument, PadDrum, Project } from '../../song/project'
import { barOf } from './beats'
import { barGrid } from '../chart/chart'
import { pianoChord } from './pianoPart'
import { guitarNotes } from './strum'
import { NOTE_HOLD_SEC, PAD_PLAY_LEVEL, PREVIEW_LEVEL, PREVIEW_SEC } from './constants'

/**
 * Plays a chord once on the track's instrument, so picking one in the chart lets you hear
 * it as the song will: strummed on guitar, struck on piano.
 */
export async function previewChord(chord: Chord, instrument: Instrument): Promise<void> {
  const ctx = getAudioContext()
  await ctx.resume()
  const samples =
    instrument === 'piano'
      ? await renderPiano(
          pianoChord(chord, PREVIEW_SEC),
          await loadPianoSamples(ctx.sampleRate),
          0,
          PREVIEW_SEC + PIANO_RING_OUT_SEC,
          ctx.sampleRate
        )
      : await renderStrums(
          [{ time: 0, notes: guitarNotes(chord), velocity: 1, direction: 'down' }],
          0,
          PREVIEW_SEC,
          ctx.sampleRate
        )
  play(ctx, samples)
}

/**
 * Plays one note on the piano, so a singer without perfect pitch can hear what a note
 * name sounds like (their lowest note, their comfort zone).
 */
export async function previewNote(midi: number): Promise<void> {
  const ctx = getAudioContext()
  await ctx.resume()
  const piano = await loadPianoSamples(ctx.sampleRate)
  const samples = await renderPiano(
    [{ time: 0, midi, velocity: 1, holdSec: NOTE_HOLD_SEC }],
    piano,
    0,
    NOTE_HOLD_SEC + PIANO_RING_OUT_SEC,
    ctx.sampleRate
  )
  play(ctx, samples)
}

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
