import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showSnack } from '../../../state/ui/snackbar'
import { Snackbar } from '.'

afterEach(() => vi.useRealTimers())

describe('Snackbar', () => {
  it('shows a message for a few seconds, then lets it go', async () => {
    vi.useFakeTimers()
    render(<Snackbar />)
    act(() => showSnack('Auto-polished.'))
    expect(screen.getByText('Auto-polished.')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(screen.queryByText('Auto-polished.')).toBeNull()
  })

  it('replaces an older message with a newer one', () => {
    render(<Snackbar />)
    act(() => showSnack('Lined up.'))
    act(() => showSnack('Auto-polished.'))
    expect(screen.queryByText('Lined up.')).toBeNull()
    expect(screen.getByText('Auto-polished.')).toBeInTheDocument()
  })
})
