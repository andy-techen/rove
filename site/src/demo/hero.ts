import { PeakAccumulator } from '@app/renderer/src/audio/mix/peaks'
import { DEMO_AUDIO } from '../site'
import { DemoPlayer } from './player'
import { type DemoTracks, loadTracks } from './tracks'

// The harmony sits under the lead in the horizon, as the singer hears them together.
const HARMONY_IN_HORIZON = 0.6
const MIN_BAR = 0.04
const BAR_SPAN = 1.9

/** Redraws the horizon's bars from the singer's voice. */
function drawVoice(svg: SVGSVGElement, tracks: DemoTracks): void {
  const lead = tracks.lead.getChannelData(0)
  const harmony = tracks.harmony.getChannelData(0)
  const voice = new Float32Array(lead.length)
  for (let i = 0; i < lead.length; i++) voice[i] = lead[i] + harmony[i] * HARMONY_IN_HORIZON
  const layers = svg.querySelectorAll('g')
  const bars = layers[0].children.length
  const peaks = new PeakAccumulator(Math.ceil(voice.length / bars))
  peaks.push(voice)
  const pairs = peaks.resample(bars, 1)
  const loudest = Math.max(1e-6, ...pairs.map(Math.abs))
  for (const g of layers) {
    ;[...g.children].forEach((rect, i) => {
      const h = Math.max(MIN_BAR, (pairs[i * 2 + 1] - pairs[i * 2]) / 2 / loudest) * BAR_SPAN
      rect.setAttribute('y', String(1 - h / 2))
      rect.setAttribute('height', String(h))
    })
  }
}

/** Wires the hero's play button, Polish switch and seekable waveform to a player. The
 * player is made on the first press of Play, since browsers only start sound after a
 * click. */
export async function mountHero(hero: HTMLElement): Promise<void> {
  const play = hero.querySelector<HTMLButtonElement>('[data-play]')!
  const polish = hero.querySelector<HTMLButtonElement>('[data-polish]')!
  const svg = hero.querySelector<SVGSVGElement>('[data-wave]')!

  let tracks: DemoTracks
  try {
    tracks = await loadTracks()
  } catch (error) {
    console.warn("Couldn't load the demo song.", error)
    return
  }
  // The synthesised stand-in holds its notes flat, which draws as blocks; the drawn
  // shape stays until a real recording is in.
  if (DEMO_AUDIO) drawVoice(svg, tracks)
  play.disabled = false

  let player: DemoPlayer | null = null
  const polishOn = (): boolean => polish.getAttribute('aria-checked') === 'true'

  const tick = (): void => {
    if (!player) return
    hero.style.setProperty('--playhead', String(player.position))
    if (player.playing) requestAnimationFrame(tick)
  }

  play.addEventListener('click', async () => {
    if (!player) {
      player = new DemoPlayer(tracks)
      player.setPolishOn(polishOn())
    }
    if (player.playing) player.pause()
    else await player.play()
    hero.classList.toggle('is-playing', player.playing)
    play.setAttribute('aria-label', player.playing ? 'Pause' : 'Play')
    tick()
  })

  svg.addEventListener('pointerdown', (event) => {
    if (!player) return
    const box = svg.getBoundingClientRect()
    player.seek((event.clientX - box.left) / box.width)
    tick()
  })

  polish.addEventListener('click', () => {
    const on = !polishOn()
    polish.setAttribute('aria-checked', String(on))
    hero.classList.toggle('is-polished', on)
    player?.setPolishOn(on)
  })
}
