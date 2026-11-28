import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VOICE_ANALYSIS_VERSION } from '@shared/songs/constants'
import type { Entry } from '../../audio/voice'
import { createProject, withMusicPitch } from '../song/project'
import type { OpenSong } from '../song/useSong'
import { sungEntry } from './testEntries'
import { useKeySuggestion } from './useKeySuggestion'

// Other songs sit around C3–C4; this one goes up to G4.
const elsewhere = sungEntry('Other', '2026-07-01', { notes: [48, 54, 60] })
const here = sungEntry('This', '2026-08-01', { notes: [55, 62, 67] })
const cached = ({ ref, summary }: Entry) => ({ ...ref, version: VOICE_ANALYSIS_VERSION, summary })

const song = (semitones = 0): OpenSong => ({
  dir: '/songs/This',
  data: withMusicPitch(createProject('This', 48000), semitones)
})

describe('useKeySuggestion', () => {
  it('suggests a key from the singer’s takes once the Music panel shows', async () => {
    vi.mocked(window.api.voice.listTakes).mockResolvedValue([elsewhere.ref, here.ref])
    vi.mocked(window.api.voice.loadCache).mockResolvedValue([cached(elsewhere), cached(here)])
    const { result, rerender } = renderHook(({ open, on }) => useKeySuggestion(open, on), {
      initialProps: { open: song(), on: false }
    })
    expect(window.api.voice.listTakes).not.toHaveBeenCalled()
    rerender({ open: song(), on: true })
    await waitFor(() => expect(result.current?.semitones).toBe(-6))
    rerender({ open: song(-6), on: true })
    expect(result.current).toBeNull()
  })
})
