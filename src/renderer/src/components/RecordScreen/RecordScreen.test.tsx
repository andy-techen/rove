import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Mode, Transport } from '../../state/transport/useTransport'
import type { Microphone } from '../../state/transport/useMicrophone'
import {
  Project,
  createProject,
  withChartBars,
  withChordBacking,
  withNewTrack,
  withRecordedClip
} from '../../state/song/project'
import { chartFromText } from '../../state/chords/theory/chordText'
import { chordName } from '../../state/chords/theory/noteNames'
import { createFakeApi, fireMenu } from '../../test/fakeApi'
import { RecordScreen } from '.'

// Playback and recording need Web Audio; the screen only wires them up.
const transport = vi.hoisted(() => ({ current: null as unknown as Transport }))
vi.mock('../../state/transport/useTransport', () => ({ useTransport: () => transport.current }))
vi.mock('../../audio/engine/engine', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAudioContext: () => ({ sampleRate: 48000 }),
  // The audio never arrives: clips show without their waveforms.
  decodeAudio: () => new Promise(() => {})
}))

const fakeTransport = (position: number, mode: Mode): Transport => ({
  mode,
  position,
  live: null,
  status: null,
  error: null,
  hasPendingTake: false,
  canPlay: true,
  canStop: false,
  recorderReady: true,
  masterVolume: 1,
  masterMuted: false,
  setMasterVolume: vi.fn(),
  toggleMasterMuted: vi.fn(),
  togglePlay: vi.fn(),
  stopPlayback: vi.fn(),
  seek: vi.fn(),
  record: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  restartTake: vi.fn(async () => {}),
  offer: null,
  applyOffer: vi.fn(),
  dismissOffer: vi.fn(),
  fixTiming: vi.fn(async () => {}),
  retrySave: vi.fn(async () => {}),
  discardPending: vi.fn()
})

const mic = { source: null, inputError: null, paused: false, latencySec: 0 } as Microphone

/** Backing music, then Vocal 1 with a four-second take from the top, then an empty Vocal 2. */
function song(): Project {
  let project = createProject('Song', 48000)
  const take = { file: 'audio/take-001.wav', start: 0, offset: 0, duration: 4 }
  project = withRecordedClip(project, project.tracks[0].id, take)
  project = withNewTrack(project, 'vocal').project
  const backing = withNewTrack(project, 'backing', { sourceName: 'song.mp3' })
  const music = { file: 'audio/song.mp3', start: 0, offset: 0, duration: 60 }
  return withRecordedClip(backing.project, backing.track.id, music)
}

/** The song with an instrumental playing `chart`, written as a chord sheet. */
function songWithChords(chart: string): Project {
  const { project, track } = withChordBacking(song(), chartFromText(chart).bars[0][0])
  return withChartBars(project, track.id, chartFromText(chart).bars)
}

/** Opens `project` with the playhead at `position`; resolves once its tracks show. */
async function openSong({ position = 2, mode = 'idle' as Mode, project = song() } = {}) {
  transport.current = fakeTransport(position, mode)
  render(
    <RecordScreen
      initial={{ dir: '/songs/Song', name: 'Song', manifest: project }}
      active
      tabs={[]}
      tabId="tab"
      mic={mic}
      onInfo={vi.fn()}
      onSwitch={vi.fn()}
      onMove={vi.fn()}
      onClose={vi.fn()}
      onNew={vi.fn()}
      onSongbook={vi.fn()}
    />
  )
  await screen.findByRole('button', { name: /^Vocal 1/ })
  // The tracks show a moment before opening finishes and editing unlocks; on a busy
  // machine a test could act in between. Record turns on once it has.
  if (mode === 'idle') {
    const record = button(t('track.record', { name: 'Vocal 1' }))
    await waitFor(() => expect(record).toBeEnabled())
  }
  return project
}

const idOf = (project: Project, name: string) =>
  project.tracks.find((track) => track.name === name)!.id
const clipsOf = (project: Project, name: string) =>
  project.tracks.find((track) => track.name === name)?.clips ?? []
const trackName = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const button = (name: string) => screen.getByRole('button', { name })
const polishPanel = (name: string) =>
  screen.queryByRole('region', { name: t('polish.label', { name }) })

// Clips have no role or name to find them by, only the lane they sit in.
const rightClickTake = (project: Project) =>
  fireEvent.contextMenu(
    document.querySelector(`[data-track="${idOf(project, 'Vocal 1')}"] [data-clip-id]`)!
  )

// The timeline shows the same bars; these are the ones in the Instrumental panel's chart.
const chordBar = (n: number, chords: string) =>
  within(screen.getByRole('list', { name: t('chords.bars') })).getByRole('button', {
    name: t('chords.barLabel', { n, chords })
  })
const chartOf = (project: Project) =>
  project.tracks
    .find((track) => track.role === 'chords')!
    .chart!.bars.map((bar) => bar.map(chordName).join(' '))

/** What File ▸ Save writes to project.json. */
async function saved(): Promise<Project> {
  fireMenu('save')
  const write = vi.mocked(window.api.writeManifest)
  await waitFor(() => expect(write).toHaveBeenCalled())
  return write.mock.calls.at(-1)![1] as Project
}

beforeEach(() => {
  window.api = createFakeApi()
})
// A failed assertion mid-test mustn't leave later tests on fake timers.
afterEach(() => vi.useRealTimers())

describe('RecordScreen', () => {
  it('splits the right-clicked take at the playhead from the menu', async () => {
    const project = await openSong()
    rightClickTake(project)
    fireMenu('split')
    expect(clipsOf(await saved(), 'Vocal 1')).toHaveLength(2)
  })

  it('brings a split take back whole with Undo', async () => {
    const project = await openSong()
    rightClickTake(project)
    await userEvent.click(button(t('transport.split')))
    await userEvent.click(button(t('transport.undo')))
    expect(clipsOf(await saved(), 'Vocal 1')).toHaveLength(1)
  })

  it('shows what a right-clicked take allows in its menu', async () => {
    const project = await openSong()
    rightClickTake(project)
    await waitFor(() =>
      expect(window.api.showContextMenu).toHaveBeenCalledWith(
        expect.arrayContaining([
          { action: 'split', enabled: true },
          { action: 'paste', enabled: false }
        ])
      )
    )
  })

  it('deletes the right-clicked take when the menu sends Delete', async () => {
    const project = await openSong()
    rightClickTake(project)
    fireMenu('deleteClip')
    expect(clipsOf(await saved(), 'Vocal 1')).toHaveLength(0)
  })

  it('pastes a copied take at the playhead, after the original', async () => {
    const project = await openSong({ position: 4 })
    rightClickTake(project)
    fireMenu('copy')
    fireMenu('paste')
    const starts = clipsOf(await saved(), 'Vocal 1').map((clip) => clip.start)
    expect(starts).toEqual([0, 4])
    expect(transport.current.seek).toHaveBeenCalledWith(8)
  })

  it('pastes copied chord bars in after the picked ones', async () => {
    const project = await openSong({ project: songWithChords('| C | F | G |') })
    const chords = project.tracks.find((track) => track.role === 'chords')!
    await userEvent.click(trackName(chords.name))
    await userEvent.click(chordBar(2, 'F'))
    fireEvent.click(chordBar(3, 'G'), { shiftKey: true })
    fireMenu('copy')
    fireMenu('paste')
    // Paste reads the system clipboard first, in case chords were copied from elsewhere.
    await waitFor(() => expect(chordBar(5, 'G')).toBeInTheDocument())
    expect(chartOf(await saved())).toEqual(['C', 'F', 'G', 'F', 'G'])
  })

  it('picks a track with ⌘ and its number, so Delete removes that track', async () => {
    await openSong()
    // Music comes first, so ⌘3 is the second vocal.
    fireEvent.keyDown(window, { code: 'Digit3', metaKey: true })
    expect(trackName('Vocal 2')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button(t('transport.delete')))
    expect((await saved()).tracks.map((track) => track.name)).not.toContain('Vocal 2')
  })

  it('polishes the track whose name is clicked', async () => {
    await openSong()
    expect(polishPanel('Vocal 1')).toBeInTheDocument()
    await userEvent.click(trackName('Vocal 2'))
    expect(polishPanel('Vocal 2')).toBeInTheDocument()
  })

  it('hides the panel under the timeline until another track is picked', async () => {
    await openSong()
    await userEvent.click(button(t('panel.hide')))
    expect(polishPanel('Vocal 1')).not.toBeInTheDocument()
    await userEvent.click(trackName('Vocal 2'))
    expect(polishPanel('Vocal 2')).toBeInTheDocument()
  })

  it('opens and closes the lyrics beside the timeline', async () => {
    await openSong()
    await userEvent.click(button(t('lyrics.label')))
    expect(screen.getByRole('complementary', { name: t('lyrics.label') })).toBeInTheDocument()
    await userEvent.click(button(t('lyrics.hide')))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows the chords when the menu asks for them', async () => {
    await openSong()
    fireMenu('toggleChords')
    expect(screen.getByRole('region', { name: t('chords.label') })).toBeInTheDocument()
  })

  it('saves an edit to the song folder shortly after it', async () => {
    const project = await openSong()
    vi.useFakeTimers()
    rightClickTake(project)
    fireMenu('split')
    expect(window.api.writeManifest).not.toHaveBeenCalled()
    act(() => vi.runOnlyPendingTimers())
    expect(window.api.writeManifest).toHaveBeenCalledWith('/songs/Song', expect.anything())
  })

  it('records on the track whose Record button is pressed', async () => {
    const project = await openSong()
    await userEvent.click(button(t('track.record', { name: 'Vocal 2' })))
    expect(transport.current.record).toHaveBeenCalledWith(idOf(project, 'Vocal 2'))
  })

  it('locks editing while a take is recording', async () => {
    const project = await openSong({ mode: 'recording' })
    rightClickTake(project)
    expect(button(t('transport.split'))).toBeDisabled()
    expect(button(t('transport.undo'))).toBeDisabled()
  })
})
