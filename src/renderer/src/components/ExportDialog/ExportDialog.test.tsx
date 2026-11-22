import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import type { ExportState } from '../../state/useExport'
import { ExportDialog } from '.'

const renderDialog = (state: ExportState = { status: 'idle' }) => {
  const props = { state, onStart: vi.fn(), onReveal: vi.fn(), onClose: vi.fn() }
  render(<ExportDialog {...props} />)
  return props
}

describe('ExportDialog', () => {
  it('exports a WAV ready for streaming unless told otherwise', async () => {
    const props = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: t('export.start') }))
    expect(props.onStart).toHaveBeenCalledWith({ format: 'wav', loudness: 'streaming' })
  })

  it('exports an MP3 as mixed when chosen', async () => {
    const props = renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(t('export.formats.mp3')) }))
    await userEvent.click(screen.getByRole('radio', { name: t('export.loudnessOptions.asMixed') }))
    await userEvent.click(screen.getByRole('button', { name: t('export.start') }))
    expect(props.onStart).toHaveBeenCalledWith({ format: 'mp3', loudness: 'asMixed' })
  })

  it('shows progress while working', () => {
    renderDialog({ status: 'working', stage: { stage: 'encoding', progress: 0.42 } })
    expect(screen.getByText(t('export.stages.encoding', { percent: 42 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('export.start') })).toBeDisabled()
  })

  it('names the saved file and offers to show it in Finder', async () => {
    const props = renderDialog({ status: 'done', filePath: '/Music/My Song.wav' })
    expect(screen.getByText(t('export.done', { file: 'My Song.wav' }))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('export.reveal') }))
    expect(props.onReveal).toHaveBeenCalled()
  })
})
