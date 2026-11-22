import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { SettingsDialog } from '.'

describe('SettingsDialog', () => {
  it('shows where new songs are saved and changes it', async () => {
    vi.mocked(window.api.getSongsFolder).mockResolvedValue('/Users/sam/Music/Rove')
    vi.mocked(window.api.chooseSongsFolder).mockResolvedValue('/Users/sam/Songs')
    render(<SettingsDialog onClose={vi.fn()} />)
    expect(await screen.findByText('/Users/sam/Music/Rove')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('settings.changeFolder') }))
    expect(await screen.findByText('/Users/sam/Songs')).toBeInTheDocument()
  })

  it('keeps the folder when choosing is cancelled', async () => {
    vi.mocked(window.api.getSongsFolder).mockResolvedValue('/Users/sam/Music/Rove')
    vi.mocked(window.api.chooseSongsFolder).mockResolvedValue(null)
    render(<SettingsDialog onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: t('settings.changeFolder') }))
    expect(screen.getByText('/Users/sam/Music/Rove')).toBeInTheDocument()
  })
})
