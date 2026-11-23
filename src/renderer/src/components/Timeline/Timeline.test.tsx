import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { LaneView } from '../../state/song/selectors'
import { createFakeApi } from '../../test/fakeApi'
import { Timeline } from '.'

const lane = (overrides: Partial<LaneView>): LaneView => ({
  id: 'v1',
  role: 'vocal',
  name: 'Vocal 1',
  detail: 'Lead',
  imported: false,
  volume: 1,
  startVolume: 1,
  pan: 0,
  muted: false,
  clips: [],
  blocks: [],
  ...overrides
})

function timelineProps(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  return {
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
    selectedClips: [],
    onSelectBox: vi.fn(),
    onSelect: vi.fn(),
    selectedTrackIds: [],
    onSelectTrack: vi.fn(),
    onClipGesture: vi.fn(),
    onMoveTrack: vi.fn(),
    renamingTrackId: null,
    onRenaming: vi.fn(),
    onRenameTrack: vi.fn(),
    onLaneClick: vi.fn(),
    onContextMenu: vi.fn(),
    snapAt: null,
    ...overrides
  }
}

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const props = timelineProps(overrides)
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

  it('moves a track by dragging its name onto another track of the same kind', () => {
    const props = renderTimeline({
      tracks: [
        lane({}),
        lane({ id: 'v2', name: 'Vocal 2' }),
        lane({ id: 'v3', name: 'Vocal 3' }),
        lane({ id: 'b1', role: 'backing', name: 'Backing 1' })
      ]
    })
    const name = (n: string) => screen.getByRole('button', { name: new RegExp(`^${n}`) })
    fireEvent.dragStart(name('Vocal 1'))
    fireEvent.dragOver(name('Backing 1'))
    fireEvent.drop(name('Backing 1'))
    expect(props.onMoveTrack).not.toHaveBeenCalled()
    // Dropped on the top half of Vocal 3: just above it.
    fireEvent.dragStart(name('Vocal 1'))
    fireEvent.dragOver(name('Vocal 3'))
    fireEvent.drop(name('Vocal 3'))
    expect(props.onMoveTrack).toHaveBeenCalledWith('v1', 1)
  })

  it('asks to rename a track when its name is double-clicked', async () => {
    const props = renderTimeline()
    await userEvent.dblClick(screen.getByRole('button', { name: /^Vocal 1/ }))
    expect(props.onRenaming).toHaveBeenCalledWith('v1')
  })

  it('saves a new track name on Enter and keeps the old one on Esc', async () => {
    const props = renderTimeline({ renamingTrackId: 'v1' })
    const field = screen.getByRole('textbox', { name: t('track.nameLabel') })
    await userEvent.clear(field)
    await userEvent.type(field, 'Chorus{Enter}')
    expect(props.onRenameTrack).toHaveBeenCalledWith('v1', 'Chorus')
    expect(props.onRenaming).toHaveBeenLastCalledWith(null)
  })

  it('leaves the name alone when renaming is cancelled with Esc', async () => {
    const props = renderTimeline({ renamingTrackId: 'v1' })
    await userEvent.type(screen.getByRole('textbox', { name: t('track.nameLabel') }), 'x{Escape}')
    expect(props.onRenameTrack).not.toHaveBeenCalled()
    expect(props.onRenaming).toHaveBeenLastCalledWith(null)
  })

  it('picks a track by clicking an empty spot in its lane, so a paste lands there', () => {
    const props = renderTimeline({ tracks: [lane({}), lane({ id: 'v2', name: 'Vocal 2' })] })
    const lanes = document.querySelectorAll('[data-track] .lane-area')
    fireEvent.click(lanes[1])
    expect(props.onLaneClick).toHaveBeenCalledWith('v2')
  })

  it('opens a menu for the track when its name is right-clicked', () => {
    const props = renderTimeline()
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Vocal 1/ }))
    expect(props.onContextMenu).toHaveBeenCalledWith('track', 'v1', null)
  })

  it('lets the singer scroll away from the playhead while the song plays', async () => {
    const clip = {
      id: 'c1',
      start: 0,
      offset: 0,
      duration: 300,
      fadeIn: 0,
      fadeOut: 0,
      audio: null,
      joinedBefore: false,
      joinedAfter: false
    }
    const playing = (position: number) =>
      timelineProps({ tracks: [lane({ clips: [clip] })], follow: true, position })
    const { container, rerender } = render(<Timeline {...playing(0)} />)
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: t('timeline.zoomIn') }))
    }
    // The custom scrollbar has no role to find it by.
    const bar = container.querySelector<HTMLElement>('.timeline-scrollbar')!
    bar.scrollLeft = 1000
    fireEvent.scroll(bar)
    rerender(<Timeline {...playing(1)} />)
    // Still where they scrolled, not snapped back to the start.
    expect(screen.getByText('2:00')).toBeInTheDocument()
    expect(screen.queryByText('0:10')).not.toBeInTheDocument()
  })

  it('jumps back to the playhead from the button beside zoom', async () => {
    const clip = {
      id: 'c1',
      start: 0,
      offset: 0,
      duration: 300,
      fadeIn: 0,
      fadeOut: 0,
      audio: null,
      joinedBefore: false,
      joinedAfter: false
    }
    const { container } = render(
      <Timeline {...timelineProps({ tracks: [lane({ clips: [clip] })], follow: true })} />
    )
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: t('timeline.zoomIn') }))
    }
    const bar = container.querySelector<HTMLElement>('.timeline-scrollbar')!
    bar.scrollLeft = 1000
    fireEvent.scroll(bar)
    await userEvent.click(screen.getByRole('button', { name: t('timeline.toPlayhead') }))
    expect(screen.getByText('0:10')).toBeInTheDocument()
  })

  it('jumps back to the playhead from the View menu shortcut', async () => {
    const clip = {
      id: 'c1',
      start: 0,
      offset: 0,
      duration: 300,
      fadeIn: 0,
      fadeOut: 0,
      audio: null,
      joinedBefore: false,
      joinedAfter: false
    }
    const { container } = render(
      <Timeline {...timelineProps({ tracks: [lane({ clips: [clip] })], follow: true })} />
    )
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: t('timeline.zoomIn') }))
    }
    const bar = container.querySelector<HTMLElement>('.timeline-scrollbar')!
    bar.scrollLeft = 1000
    fireEvent.scroll(bar)
    act(() => (window.api as ReturnType<typeof createFakeApi>).fireMenu('toPlayhead'))
    expect(screen.getByText('0:10')).toBeInTheDocument()
  })
})
