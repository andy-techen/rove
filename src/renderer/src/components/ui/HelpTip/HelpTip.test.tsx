import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpTip } from '.'

describe('HelpTip', () => {
  it('shows lines and bullets, and is read as one passage', async () => {
    render(<HelpTip lines={['Pick one.']} items={[{ term: 'Louder', text: 'pushes harder' }]} />)
    expect(screen.getByRole('button', { name: 'Pick one. Louder: pushes harder.' })).toBeVisible()
    await userEvent.tab()
    const tip = await screen.findByRole('tooltip')
    expect(within(tip).getByText('Pick one.')).toBeVisible()
    expect(within(tip).getAllByRole('listitem')).toHaveLength(1)
  })
})
