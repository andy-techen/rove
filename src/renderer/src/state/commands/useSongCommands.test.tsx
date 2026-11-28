import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fireMenu } from '../../test/fakeApi'
import type { Song } from '../song/useSong'
import type { Transport } from '../transport/useTransport'
import { SongCommandContext, useSongCommands } from './useSongCommands'

const context = (over: Partial<SongCommandContext> = {}): SongCommandContext => {
  const song = { song: null, canUndo: true, undo: vi.fn() } as unknown as Song
  const transport = {
    mode: 'idle',
    togglePlay: vi.fn(),
    record: vi.fn(async () => {}),
    stop: vi.fn(async () => {})
  } as unknown as Transport
  const handlers = new Proxy({}, { get: () => vi.fn() }) as SongCommandContext
  return {
    ...handlers,
    song,
    transport,
    canEdit: true,
    recordTrackId: null,
    trackOrder: [],
    selectedTrackId: null,
    oneClip: null,
    navTrack: null,
    behindDialog: false,
    ...over
  }
}

describe('useSongCommands', () => {
  it('undoes the typing, not the song, while a text field has focus', () => {
    const c = context()
    renderHook(() => useSongCommands(true, c))
    render(<input aria-label="Name" />)
    screen.getByRole('textbox').focus()
    fireMenu('undo')
    expect(c.song.undo).not.toHaveBeenCalled()
  })

  it('leaves the song alone behind a dialog', () => {
    const c = context({ behindDialog: true })
    renderHook(() => useSongCommands(true, c))
    fireMenu('undo')
    expect(c.song.undo).not.toHaveBeenCalled()
  })

  it('still plays from the keyboard while typing', () => {
    const c = context()
    renderHook(() => useSongCommands(true, c))
    render(<input aria-label="Name" />)
    screen.getByRole('textbox').focus()
    fireMenu('playPause')
    expect(c.transport.togglePlay).toHaveBeenCalled()
  })

  it('leaves commands to the visible tab', () => {
    const c = context()
    renderHook(() => useSongCommands(false, c))
    fireMenu('playPause')
    expect(c.transport.togglePlay).not.toHaveBeenCalled()
  })

  it('records on the track Record would take on', () => {
    const c = context({ recordTrackId: 'v2' })
    renderHook(() => useSongCommands(true, c))
    fireMenu('record')
    expect(c.transport.record).toHaveBeenCalledWith('v2')
  })
})
