import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { TransportBar } from './TransportBar'

const renderBar = () => {
  const onStop = vi.fn()
  render(
    <TransportBar
      playing
      canPlay
      canStop
      position={12}
      source={null}
      inputError={null}
      canUndo={false}
      canRedo={false}
      canSplit={false}
      canDelete={false}
      onTogglePlay={vi.fn()}
      onStop={onStop}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onSplit={vi.fn()}
      onDelete={vi.fn()}
      lyricsOpen={false}
      onToggleLyrics={vi.fn()}
      chordsOpen={false}
      onToggleChords={vi.fn()}
    />
  )
  return onStop
}

describe('TransportBar', () => {
  it('stops and goes back to the start from the button beside play', async () => {
    const onStop = renderBar()
    await userEvent.click(screen.getByRole('button', { name: t('transport.stopPlayback') }))
    expect(onStop).toHaveBeenCalled()
  })

  it('shows the stop shortcut on hover', async () => {
    renderBar()
    await userEvent.hover(screen.getByRole('button', { name: t('transport.stopPlayback') }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('⌘.')
  })
})
