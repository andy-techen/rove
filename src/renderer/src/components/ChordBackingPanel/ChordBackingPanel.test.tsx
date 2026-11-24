import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { ChordBackingPanel } from '.'

function renderPanel() {
  const onInstrument = vi.fn()
  render(
    <ChordBackingPanel
      trackName="Backing 2"
      instrument="guitar"
      locked={false}
      onInstrument={onInstrument}
      onHide={vi.fn()}
    >
      <p>bars</p>
    </ChordBackingPanel>
  )
  return { onInstrument }
}

describe('ChordBackingPanel', () => {
  it('names the instrumental by its track', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { name: new RegExp(t('instrumental.title')) })
    expect(heading).toHaveTextContent('Backing 2')
  })

  it('plays guitar or beats, with piano still to come', async () => {
    const { onInstrument } = renderPanel()
    expect(screen.getByRole('button', { name: t('instrumental.guitar') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: t('instrumental.piano') })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: t('instrumental.beats') }))
    expect(onInstrument).toHaveBeenCalledWith('beats')
  })
})
