import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { NewSongDialog } from '.'

function renderDialog() {
  const props = { onCreate: vi.fn(), onClose: vi.fn() }
  render(<NewSongDialog {...props} />)
  return props
}

describe('NewSongDialog', () => {
  it('starts a song with the name typed, ready to type straight away', async () => {
    const { onCreate } = renderDialog()
    expect(screen.getByRole('textbox', { name: t('newSong.nameLabel') })).toHaveFocus()
    await userEvent.keyboard('Golden Hour{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Golden Hour')
  })

  it('needs a name before it can start', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: t('newSong.create') })).toBeDisabled()
  })
})
