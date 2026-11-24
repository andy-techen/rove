import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { NewSongDialog } from '.'

function renderDialog(extra: Partial<React.ComponentProps<typeof NewSongDialog>> = {}) {
  const props = { onCreate: vi.fn(), onClose: vi.fn(), ...extra }
  render(<NewSongDialog {...props} />)
  return props
}

describe('NewSongDialog', () => {
  it('starts a song with the name typed, ready to type straight away', async () => {
    const { onCreate } = renderDialog()
    expect(screen.getByRole('textbox', { name: t('newSong.nameLabel') })).toHaveFocus()
    await userEvent.keyboard('Fly Away{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Fly Away', undefined, undefined)
  })

  it('passes along a artist when one is given', async () => {
    const { onCreate } = renderDialog()
    await userEvent.keyboard('Fly Away')
    await userEvent.type(
      screen.getByRole('textbox', { name: t('newSong.artistLabel') }),
      'Sam{Enter}'
    )
    expect(onCreate).toHaveBeenCalledWith('Fly Away', 'Sam', undefined)
  })

  it('passes along a note when one is given', async () => {
    const { onCreate } = renderDialog()
    await userEvent.keyboard('Fly Away')
    await userEvent.type(
      screen.getByRole('textbox', { name: t('newSong.noteLabel') }),
      'For Mum{Enter}'
    )
    expect(onCreate).toHaveBeenCalledWith('Fly Away', undefined, 'For Mum')
  })

  it('passes along a note, and a cleared one as none', async () => {
    const { onCreate } = renderDialog({
      editing: { name: 'Fly Away', note: 'Old' }
    })
    await userEvent.clear(screen.getByRole('textbox', { name: t('newSong.noteLabel') }))
    await userEvent.keyboard('{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Fly Away', undefined, undefined)
  })

  it('needs a name before it can start', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: t('newSong.create') })).toBeDisabled()
  })
})
