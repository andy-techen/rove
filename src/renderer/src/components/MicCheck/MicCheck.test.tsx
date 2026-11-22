import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Microphone } from '../../state/transport/useMicrophone'
import { MicCheck } from '.'

const mic = (overrides: Partial<Microphone>): Microphone => ({
  access: 'granted',
  devices: [{ deviceId: 'rode', label: 'Rode NT-USB' } as MediaDeviceInfo],
  deviceId: 'rode',
  deviceLabel: 'Rode NT-USB',
  source: null,
  inputError: null,
  latencySec: 0.02,
  chooseDevice: vi.fn(),
  retryAccess: vi.fn(async () => {}),
  ...overrides
})

describe('MicCheck', () => {
  it('is headed by the Rove logo', () => {
    render(<MicCheck mic={mic({})} onboarding onDone={vi.fn()} />)
    expect(screen.getByRole('heading', { name: t('app.name') })).toBeInTheDocument()
  })

  it('explains how to fix blocked access and lets the singer retry', async () => {
    const m = mic({ access: 'denied' })
    render(<MicCheck mic={m} onboarding onDone={vi.fn()} />)
    expect(screen.getByText(t('micCheck.denied'))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('micCheck.tryAgain') }))
    expect(m.retryAccess).toHaveBeenCalled()
  })

  it('holds onboarding until the singer has reached a good level', () => {
    render(<MicCheck mic={mic({})} onboarding onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: t('micCheck.continue') })).toBeDisabled()
  })

  it('lets a returning singer leave straight away, with nothing to measure', async () => {
    const onDone = vi.fn()
    render(<MicCheck mic={mic({})} onboarding={false} onDone={onDone} />)
    expect(screen.queryByRole('button', { name: /measure/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('micCheck.done') }))
    expect(onDone).toHaveBeenCalled()
  })
})
