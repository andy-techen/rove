import { DEMO_AUDIO } from '../site'
import { BEAT_SEC, CHORDS, HARMONY, MELODY, type Note, SONG_SEC, midiToHz } from './song'

export type TrackId = 'backing' | 'lead' | 'harmony'
export type DemoTracks = Record<TrackId, AudioBuffer>

const SAMPLE_RATE = 44100

// The sung line: a buzzy source through two vowel-like resonances ("ah"), with a
// little vibrato, so polish has something voice-like to work on.
const VOICE_FORMANTS = [
  { hz: 750, q: 6, db: 12 },
  { hz: 1150, q: 7, db: 9 }
]
const VOICE_LOWPASS_HZ = 3200
const VOICE_LEVEL = 0.22
const VIBRATO_HZ = 5.2
const VIBRATO_CENTS = 18
const VOICE_ATTACK_SEC = 0.06
const VOICE_RELEASE_SEC = 0.12

// The backing: soft plucked chords twice a bar, and a bass note.
const CHORD_LEVEL = 0.07
const BASS_LEVEL = 0.22
const PLUCK_DECAY_SEC = 1.2
const STRIKES_PER_BAR = 2
const BEATS_PER_BAR = 4

function voice(ctx: OfflineAudioContext, notes: Note[]): void {
  let out: AudioNode = ctx.destination
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = VOICE_LOWPASS_HZ
  lowpass.connect(out)
  out = lowpass
  for (const f of VOICE_FORMANTS) {
    const peak = ctx.createBiquadFilter()
    peak.type = 'peaking'
    peak.frequency.value = f.hz
    peak.Q.value = f.q
    peak.gain.value = f.db
    peak.connect(out)
    out = peak
  }
  const vibrato = ctx.createOscillator()
  vibrato.frequency.value = VIBRATO_HZ
  const depth = ctx.createGain()
  depth.gain.value = VIBRATO_CENTS
  vibrato.connect(depth)
  vibrato.start()

  for (const note of notes) {
    const start = note.beat * BEAT_SEC
    const end = start + note.beats * BEAT_SEC
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = midiToHz(note.midi)
    depth.connect(osc.detune)
    const env = ctx.createGain()
    const level = VOICE_LEVEL * note.velocity
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(level, start + VOICE_ATTACK_SEC)
    env.gain.setValueAtTime(level, end - VOICE_RELEASE_SEC)
    env.gain.linearRampToValueAtTime(0, end)
    osc.connect(env).connect(out)
    osc.start(start)
    osc.stop(end)
  }
}

function pluck(
  ctx: OfflineAudioContext,
  hz: number,
  at: number,
  level: number,
  type: OscillatorType
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = hz
  const env = ctx.createGain()
  env.gain.setValueAtTime(level, at)
  env.gain.exponentialRampToValueAtTime(level / 1000, at + PLUCK_DECAY_SEC)
  osc.connect(env).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + PLUCK_DECAY_SEC)
}

function backing(ctx: OfflineAudioContext): void {
  const strikeBeats = BEATS_PER_BAR / STRIKES_PER_BAR
  CHORDS.forEach(({ root, triad }, bar) => {
    for (let s = 0; s < STRIKES_PER_BAR; s++) {
      const at = (bar * BEATS_PER_BAR + s * strikeBeats) * BEAT_SEC
      for (const midi of triad) pluck(ctx, midiToHz(midi), at, CHORD_LEVEL, 'triangle')
      pluck(ctx, midiToHz(root), at, BASS_LEVEL, 'sine')
    }
  })
}

async function render(draw: (ctx: OfflineAudioContext) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.round(SONG_SEC * SAMPLE_RATE), SAMPLE_RATE)
  draw(ctx)
  return ctx.startRendering()
}

async function decode(url: string): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const data = await (await fetch(url)).arrayBuffer()
  return ctx.decodeAudioData(data)
}

/** The demo's three tracks: the real recording if there is one, else the placeholder. */
export async function loadTracks(): Promise<DemoTracks> {
  if (DEMO_AUDIO) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
    const [b, l, h] = await Promise.all(
      [DEMO_AUDIO.backing, DEMO_AUDIO.lead, DEMO_AUDIO.harmony].map((file) => decode(base + file))
    )
    return { backing: b, lead: l, harmony: h }
  }
  const [b, l, h] = await Promise.all([
    render(backing),
    render((ctx) => voice(ctx, MELODY)),
    render((ctx) => voice(ctx, HARMONY))
  ])
  return { backing: b, lead: l, harmony: h }
}
