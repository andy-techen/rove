import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LicenseStatus } from '@shared/license'
import { useFeature, usePlan } from './useFeature'

function Probe(): React.JSX.Element {
  return (
    <p>
      {usePlan()} {useFeature('vocalRemoval') ? 'on' : 'off'}
    </p>
  )
}

describe('useFeature', () => {
  it('unlocks a premium feature when the plan turns premium', () => {
    const listeners = new Set<(status: LicenseStatus) => void>()
    vi.mocked(window.api.onLicense).mockImplementation((listener) => {
      listeners.add(listener)
      listener({ plan: 'free', keyHint: null })
      return () => listeners.delete(listener)
    })
    render(<Probe />)
    expect(screen.getByText('free off')).toBeInTheDocument()
    act(() => listeners.forEach((report) => report({ plan: 'premium', keyHint: '•••• 4d51' })))
    expect(screen.getByText('premium on')).toBeInTheDocument()
  })
  it('shows premium from the first render when this Mac already has it', () => {
    vi.mocked(window.api.onLicense).mockImplementation((listener) => {
      listener({ plan: 'premium', keyHint: '•••• 4d51' })
      return () => undefined
    })
    const seen: string[] = []
    function FirstRender(): null {
      seen.push(usePlan())
      return null
    }
    render(<FirstRender />)
    expect(seen[0]).toBe('premium')
  })
})
