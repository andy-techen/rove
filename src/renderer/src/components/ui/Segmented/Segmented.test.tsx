import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from '.'

const options = [
  { value: 'range', label: 'Range' },
  { value: 'songs', label: 'By song' }
] as const

describe('Segmented', () => {
  it('shows the chosen option as pressed and reports a new choice', async () => {
    const onChange = vi.fn()
    render(<Segmented label="View" options={options} value="range" onChange={onChange} />)
    const group = screen.getByRole('group', { name: 'View' })
    expect(group).toContainElement(screen.getByRole('button', { name: 'Range', pressed: true }))
    expect(screen.getByRole('button', { name: 'By song' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'By song' }))
    expect(onChange).toHaveBeenCalledWith('songs')
  })
})
