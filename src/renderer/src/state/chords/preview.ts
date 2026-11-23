import { Chord } from '../../audio/music/chords'
import { getAudioContext } from '../../audio/engine/engine'
import { renderStrums } from '../../audio/music/guitar'
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
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buffer.copyToChannel(samples, 0)
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = PREVIEW_LEVEL
  source.buffer = buffer
  source.connect(gain).connect(ctx.destination)
  source.addEventListener('ended', () => gain.disconnect())
  source.start()
}
