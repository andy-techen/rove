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
  it('plays guitar, piano or beats', async () => {
    const { onInstrument } = renderPanel()
    expect(screen.getByRole('button', { name: t('instrumental.guitar') })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: t('instrumental.piano') }))
    expect(onInstrument).toHaveBeenCalledWith('piano')
  })
})
