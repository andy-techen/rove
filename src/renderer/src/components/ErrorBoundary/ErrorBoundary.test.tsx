import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { ErrorBoundary } from '.'

function Broken(): React.JSX.Element {
  throw new Error('Too many re-renders')
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the app as usual when nothing goes wrong', () => {
    render(<ErrorBoundary onReload={vi.fn()}>Your songs</ErrorBoundary>)
    expect(screen.getByText('Your songs')).toBeInTheDocument()
  })

  it('says the recordings are safe instead of going blank when something breaks', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary onReload={vi.fn()}>
        <Broken />
      </ErrorBoundary>
    )
    expect(screen.getByRole('heading', { name: t('crash.title') })).toBeInTheDocument()
    expect(screen.getByText(t('crash.safe'))).toBeInTheDocument()
  })

  it('reopens the songs from the button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken />
      </ErrorBoundary>
    )
    await userEvent.click(screen.getByRole('button', { name: t('crash.reopen') }))
    expect(onReload).toHaveBeenCalled()
  })
})
