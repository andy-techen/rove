import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
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
          reasons: track.polishSuggestion?.reasons ?? null,
          disabled: false,
          onListen: auto.listen
        }}
      />
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

const knob = (key: 'clarity' | 'cleanup') =>
  screen.getByRole('slider', { name: t(`polish.controls.${key}.label`) })
const percent = (amount: number) => String(Math.round(amount * 100))
const autoButton = () => screen.getByRole('button', { name: t('polish.auto.label') })

async function autoPolish() {
  await userEvent.click(autoButton())
  await screen.findByText(t('polish.auto.done'))
}

async function tooltipShows(text: string) {
  await userEvent.hover(autoButton())
  await waitFor(() =>
    expect(screen.getAllByRole('tooltip').map((tip) => tip.textContent)).toContain(text)
  )
}

beforeEach(() => vi.mocked(analyseVoice).mockReset().mockResolvedValue(dullTake))

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

  it('says what it heard behind a help tip', async () => {
    render(<Harness />)
    await autoPolish()
    expect(screen.getByRole('button', { name: t('polish.auto.reasons.dull') })).toBeTruthy()
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
})
