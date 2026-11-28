import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import type { TasteExample } from '@shared/polishTaste'
import { TONE_REFERENCE, suggestPolish } from '../../audio/polish/autoPolish'
import { defaultPolish } from '../../audio/polish/polish'
import { PolishReading, analyseVoice } from '../../audio/polish/polishReading'
import {
  Project,
  createProject,
  polishOf,
  withRecordedClip,
  withTrackPolish
} from '../../state/song/project'
import { useAutoPolish } from '../../state/processing/useAutoPolish'
import { Snackbar } from '../ui/Snackbar'
import { PolishPanel } from '.'

// The hook boundary: what Rove hears is decided here, not by real audio.
vi.mock('../../audio/polish/polishReading', () => ({ analyseVoice: vi.fn() }))

const dullTake: PolishReading = {
  voiceDb: -18,
  softDb: -26,
  rangeDb: 15,
  noiseDb: -61,
  hum: false,
  sibilanceDb: null,
  bodyDb: TONE_REFERENCE.bodyDb,
  presenceDb: TONE_REFERENCE.presenceDb - 12,
  airDb: TONE_REFERENCE.airDb - 12,
  clipped: false
}
const expected = suggestPolish(dullTake, 'lead').amounts
const audio = { 'a.wav': {} as AudioBuffer, 'b.wav': {} as AudioBuffer }

function songWith(files: string[]): Project {
  const p = createProject('Song', 48000)
  return files.reduce(
    (song, file, i) =>
      withRecordedClip(song, p.tracks[0].id, { file, start: i * 10, offset: 0, duration: 5 }),
    p
  )
}

/** The Polish panel wired to auto polish, with a song history to undo through. */
function Harness({ files = ['a.wav'] }: { files?: string[] }) {
  const [history, setHistory] = useState([songWith(files)])
  const song = history.at(-1)!
  const track = song.tracks[0]
  const push = (next: Project) => setHistory((h) => [...h, next])
  const auto = useAutoPolish(song, audio, track.id, push)
  return (
    <>
      <PolishPanel
        trackName={track.name}
        part="lead"
        polish={polishOf(track)}
        locked={false}
        onChange={(next) => push(withTrackPolish(song, track.id, next))}
        onHide={vi.fn()}
        auto={{
          ...auto,
          suggestion: track.polishSuggestion ?? null,
          disabled: false,
          onListen: auto.listen
        }}
      />
      <Snackbar />
      <button onClick={() => setHistory((h) => h.slice(0, -1))}>undo</button>
      <button
        onClick={() =>
          push(
            withRecordedClip(song, track.id, { file: 'b.wav', start: 20, offset: 0, duration: 3 })
          )
        }
      >
        record
      </button>
    </>
  )
}

const knob = (key: keyof typeof expected) =>
  screen.getByRole('slider', { name: t(`polish.controls.${key}.label`) })
const percent = (amount: number) => String(Math.round(amount * 100))
const autoButton = () => screen.getByRole('button', { name: t('polish.auto.label') })

async function autoPolish(done = t('polish.auto.done')) {
  await userEvent.click(autoButton())
  await screen.findByText(done)
}

/** Earlier songs where the singer turned Warmth up from what auto polish set. */
function warmerSongs(n: number): TasteExample[] {
  return Array.from({ length: n }, (_, i) => ({
    trackId: `earlier-${i}`,
    part: 'lead',
    savedAt: n - i,
    reading: dullTake,
    kept: { ...expected, warmth: expected.warmth + 0.15 }
  }))
}

async function tooltipShows(text: string) {
  await userEvent.hover(autoButton())
  await waitFor(() =>
    expect(screen.getAllByRole('tooltip').map((tip) => tip.textContent)).toContain(text)
  )
}

beforeEach(() => {
  vi.mocked(analyseVoice).mockReset().mockResolvedValue(dullTake)
  vi.mocked(window.api.taste.listExamples).mockReset().mockResolvedValue([])
})

describe('Auto-polish', () => {
  it('listens to the takes and sets the knobs for this voice', async () => {
    render(<Harness />)
    await autoPolish()
    expect(knob('clarity')).toHaveValue(percent(expected.clarity))
  })

  it('still resets to the defaults after auto-polishing', async () => {
    render(<Harness />)
    await autoPolish()
    await userEvent.click(screen.getByRole('button', { name: t('polish.reset') }))
    expect(knob('clarity')).toHaveValue(percent(defaultPolish('lead').clarity))
  })

  it('marks each knob it turned with why, on hover', async () => {
    render(<Harness />)
    await autoPolish()
    expect(screen.getByRole('img', { name: t('polish.auto.reasons.dull') })).toBeTruthy()
  })

  it('drops a knob’s mark once you turn it yourself', async () => {
    render(<Harness />)
    await autoPolish()
    const mark = () => screen.queryByRole('img', { name: t('polish.auto.reasons.dull') })
    expect(mark()).toBeTruthy()
    const name = t('polish.controls.clarity.label')
    const typed = screen.getByRole('textbox', { name: t('panel.typeValue', { name }) })
    await userEvent.clear(typed)
    await userEvent.type(typed, '7{Enter}')
    expect(mark()).toBeNull()
  })

  it('does nothing when a take is recorded', async () => {
    render(<Harness />)
    const before = (knob('clarity') as HTMLInputElement).value
    await userEvent.click(screen.getByRole('button', { name: 'record' }))
    expect(analyseVoice).not.toHaveBeenCalled()
    expect(knob('clarity')).toHaveValue(before)
  })

  it('asks to listen again after a new take, leaving the knobs where they are', async () => {
    render(<Harness />)
    await autoPolish()
    await userEvent.click(screen.getByRole('button', { name: 'record' }))
    expect(knob('clarity')).toHaveValue(percent(expected.clarity))
    await tooltipShows(t('polish.auto.titleStale'))
  })

  it('undoes in one step', async () => {
    render(<Harness />)
    const before = (knob('clarity') as HTMLInputElement).value
    await autoPolish()
    await userEvent.click(screen.getByRole('button', { name: 'undo' }))
    expect(knob('clarity')).toHaveValue(before)
  })

  it('asks for more singing when a take is too short to hear', async () => {
    vi.mocked(analyseVoice).mockResolvedValue(null)
    render(<Harness />)
    await userEvent.click(autoButton())
    expect(await screen.findByText(t('polish.auto.tooShort'))).toBeTruthy()
  })

  it('waits for a take before it can listen', async () => {
    render(<Harness files={[]} />)
    expect(autoButton()).toBeDisabled()
    await tooltipShows(t('polish.auto.titleNoTakes'))
  })

  it('leans toward how the singer set earlier songs, and says so', async () => {
    vi.mocked(window.api.taste.listExamples).mockResolvedValue(warmerSongs(6))
    render(<Harness />)
    await autoPolish(t('polish.auto.doneTaste'))
    expect(Number((knob('warmth') as HTMLInputElement).value)).toBeGreaterThan(
      Number(percent(expected.warmth))
    )
    expect(screen.getByRole('img', { name: t('polish.auto.tasteUp') })).toBeTruthy()
  })

  it('still polishes when earlier songs can’t be read', async () => {
    vi.mocked(window.api.taste.listExamples).mockRejectedValue(new Error('nope'))
    render(<Harness />)
    await autoPolish()
    expect(knob('clarity')).toHaveValue(percent(expected.clarity))
  })
})
