import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { LaneView } from '../../state/song/selectors'
import { Timeline } from '.'

const lane = (overrides: Partial<LaneView>): LaneView => ({
  id: 'v1',
  role: 'vocal',
  name: 'Vocal 1',
  detail: 'Lead',
  volume: 1,
  startVolume: 1,
  pan: 0,
  muted: false,
  clips: [],
  ...overrides
})

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const props = {
    tracks: [lane({})],
    position: 0,
    follow: false,
    keyboard: true,
    onSeek: vi.fn(),
    recording: null,
    canRecord: true,
    onRecord: vi.fn(),
    onStop: vi.fn(),
    canEdit: true,
    skipBacking: false,
    onRecordWithoutMusic: vi.fn(),
    onAddBacking: vi.fn(),
    onAddRecordedBacking: vi.fn(),
    onAddVocal: vi.fn(),
    onMix: vi.fn(),
    selected: null,
    onSelect: vi.fn(),
    selectedTrackIds: [],
    onSelectTrack: vi.fn(),
    onClipGesture: vi.fn(),
    snapAt: null,
    ...overrides
  }
  render(<Timeline {...props} />)
  return props
}

describe('Timeline', () => {
  it('adds a track to the selection with ⌘-click', async () => {
    const props = renderTimeline({
      tracks: [lane({}), lane({ id: 'v2', name: 'Vocal 2' })],
      selectedTrackIds: ['v1']
    })
    const user = userEvent.setup()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByRole('button', { name: /^Vocal 2/ }))
    await user.keyboard('{/Meta}')
    expect(props.onSelectTrack).toHaveBeenCalledWith('v2', 'toggle')
  })

  it('offers a backing track, or singing without one, for a new song', async () => {
    const props = renderTimeline()
    await userEvent.click(screen.getByRole('button', { name: t('timeline.addBacking') }))
    await userEvent.click(screen.getByRole('button', { name: t('timeline.recordWithoutMusic') }))
    expect(props.onAddBacking).toHaveBeenCalled()
    expect(props.onRecordWithoutMusic).toHaveBeenCalled()
  })

  it('notes "No music" under the backing lane name, like a track detail', () => {
    renderTimeline({ skipBacking: true })
    const name = screen.getByText(t('timeline.backingTrack'))
    expect(name.nextElementSibling).toHaveTextContent(t('timeline.noMusic'))
  })

  it('adds another backing track from a file or by recording it', async () => {
    const props = renderTimeline({
      tracks: [lane({ id: 'b1', role: 'backing', name: 'Backing 1', detail: 'Song' })]
    })
    await userEvent.click(screen.getByRole('button', { name: t('timeline.addBackingRow') }))
    await userEvent.click(screen.getByRole('button', { name: t('timeline.recordNew') }))
    expect(props.onAddRecordedBacking).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: t('track.record', { name: 'Backing 1' }) })
    ).toBeEnabled()
  })

  it('scrubs the playhead by dragging along the ruler', () => {
    const props = renderTimeline()
    const ruler = screen.getByText('0:00')
    fireEvent.pointerDown(ruler, { clientX: 100 })
    fireEvent.pointerMove(ruler.parentElement!, { clientX: 200 })
    const [[first], [second]] = vi.mocked(props.onSeek).mock.calls
    expect(second).toBeGreaterThan(first)
  })

  it('adds a harmony vocal after choosing the part', async () => {
    const props = renderTimeline()
    await userEvent.click(screen.getByRole('button', { name: t('timeline.addVocalRow') }))
    await userEvent.click(screen.getByRole('button', { name: t('timeline.harmony') }))
    expect(props.onAddVocal).toHaveBeenCalledWith('harmony')
  })

  it('records only on the track whose record button is pressed', async () => {
    const props = renderTimeline({ tracks: [lane({}), lane({ id: 'v2', name: 'Vocal 2' })] })
    await userEvent.click(
      screen.getByRole('button', { name: t('track.record', { name: 'Vocal 2' }) })
    )
    expect(props.onRecord).toHaveBeenCalledWith('v2')
  })

  it('stops other tracks from recording while one is', () => {
    renderTimeline({
      tracks: [lane({}), lane({ id: 'v2', name: 'Vocal 2' })],
      recording: {
        trackId: 'v1',
        startSec: 0,
        sec: 2,
        peaks: new (class {})() as never,
        sampleRate: 48000
      }
    })
    expect(screen.getByRole('button', { name: t('track.stop', { name: 'Vocal 1' }) })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: t('track.record', { name: 'Vocal 2' }) })
    ).toBeDisabled()
  })

  it('mutes a track when its speaker is clicked', async () => {
    const props = renderTimeline()
    await userEvent.click(
      screen.getByRole('button', { name: t('track.mute', { name: 'Vocal 1' }) })
    )
    expect(props.onMix).toHaveBeenCalledWith('v1', { muted: true })
  })

  it('puts a track back to its starting volume on double-click', async () => {
    const props = renderTimeline({ tracks: [lane({ volume: 0.2, startVolume: 0.7 })] })
    await userEvent.dblClick(
      screen.getByRole('slider', { name: t('track.volume', { name: 'Vocal 1' }) })
    )
    expect(props.onMix).toHaveBeenCalledWith('v1', { volume: 0.7 })
  })

  it('centres a track when its position slider is double-clicked', async () => {
    const props = renderTimeline({ tracks: [lane({ pan: -0.4 })] })
    await userEvent.dblClick(
      screen.getByRole('slider', { name: t('track.position', { name: 'Vocal 1' }) })
    )
    expect(props.onMix).toHaveBeenCalledWith('v1', { pan: 0 })
  })

  it('shows a muted track as muted, offering to unmute', () => {
    renderTimeline({ tracks: [lane({ muted: true })] })
    const unmute = screen.getByRole('button', { name: t('track.unmute', { name: 'Vocal 1' }) })
    expect(unmute).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers zooming in, and zooming out only once zoomed in', async () => {
    renderTimeline()
    expect(screen.getByRole('button', { name: t('timeline.zoomOut') })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: t('timeline.zoomIn') }))
    expect(screen.getByRole('button', { name: t('timeline.zoomOut') })).toBeEnabled()
  })
})
