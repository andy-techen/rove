import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpTip } from '.'

describe('HelpTip', () => {
  it('shows lines and bullets, and is read as one passage', async () => {
    render(<HelpTip lines={['Pick one.']} items={[{ term: 'Louder', text: 'pushes harder' }]} />)
    const button = screen.getByRole('button', { name: 'Pick one. Louder: pushes harder.' })
    await userEvent.hover(button)
    const tip = await screen.findByRole('tooltip')
    expect(tip.querySelector('p')).toHaveTextContent('Pick one.')
    expect(tip.querySelectorAll('li')).toHaveLength(1)
  })
})
