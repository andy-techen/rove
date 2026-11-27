import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { Microphone } from '../../state/transport/useMicrophone'
import { MicCheck } from '.'

// The singer's loudest line peaks at -20 dB: 10 dB short of where Rove aims it.
vi.mock('../../audio/engine/engine', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createMeter: () => ({ readPeak: () => 0.1, dispose: () => {} })
}))
const live = {} as MediaStreamAudioSourceNode

// A failed assertion mid-test mustn't leave later tests on fake timers.
afterEach(() => vi.useRealTimers())

const mic = (overrides: Partial<Microphone>): Microphone => ({
  access: 'granted',
  devices: [{ deviceId: 'rode', label: 'Rode NT-USB' } as MediaDeviceInfo],
  deviceId: 'rode',
  deviceLabel: 'Rode NT-USB',
  source: null,
  inputError: null,
  latencySec: 0.02,
  outLoud: false,
  paused: false,
  chooseDevice: vi.fn(),
  retryAccess: vi.fn(async () => {}),
  setPaused: vi.fn(),
  learnLatency: vi.fn(),
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

  it('sets the Mac’s input volume from the singer’s loudest line', async () => {
    vi.mocked(window.api.getInputVolume).mockResolvedValue(37)
    vi.mocked(window.api.setInputVolume).mockImplementation(async (v) => v)
    render(
      <MicCheck
        mic={mic({ deviceId: 'default', source: live })}
        onboarding={false}
        onDone={vi.fn()}
      />
    )
    const setLevel = await screen.findByRole('button', { name: t('micCheck.level.set') })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    // user-event waits on timers of its own, which are faked here.
    fireEvent.click(setLevel)
    expect(screen.getByText(t('micCheck.level.listening'))).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(window.api.setInputVolume).toHaveBeenCalledWith(57)
    expect(screen.getByText(t('micCheck.level.done'))).toBeInTheDocument()
  })

  it('offers no level setting for a mic Rove can’t reach', async () => {
    render(<MicCheck mic={mic({ source: live })} onboarding={false} onDone={vi.fn()} />)
    expect(screen.queryByRole('button', { name: t('micCheck.level.set') })).not.toBeInTheDocument()
  })

  it('asks a new singer to set their level, then lets them continue', async () => {
    vi.mocked(window.api.getInputVolume).mockResolvedValue(37)
    vi.mocked(window.api.setInputVolume).mockImplementation(async (v) => v)
    const onDone = vi.fn()
    render(<MicCheck mic={mic({ deviceId: 'default', source: live })} onboarding onDone={onDone} />)
    const setLevel = await screen.findByRole('button', { name: t('micCheck.level.set') })
    expect(screen.queryByRole('button', { name: t('micCheck.continue') })).toBeNull()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    fireEvent.click(setLevel)
    await act(() => vi.advanceTimersByTimeAsync(5000))
    vi.useRealTimers()
    await userEvent.click(screen.getByRole('button', { name: t('micCheck.continue') }))
    expect(onDone).toHaveBeenCalled()
  })
})
