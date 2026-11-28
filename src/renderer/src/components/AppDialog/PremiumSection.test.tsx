import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { LicenseStatus } from '@shared/license'
import { PREMIUM_FEATURES } from '@shared/premiumFeatures'
import { PremiumSection } from './PremiumSection'

const PREMIUM: LicenseStatus = { plan: 'premium', keyHint: '•••• 4d51' }

/** The license as main sends it: starts at `initial`, and `send` changes it. */
function license(initial: LicenseStatus = { plan: 'free', keyHint: null }) {
  const listeners = new Set<(status: LicenseStatus) => void>()
  vi.mocked(window.api.onLicense).mockImplementation((listener) => {
    listeners.add(listener)
    listener(initial)
    return () => listeners.delete(listener)
  })
  return (status: LicenseStatus) => act(() => listeners.forEach((l) => l(status)))
}

const keyField = () => screen.getByRole('textbox', { name: t('premium.keyLabel') })

describe('PremiumSection', () => {
  it('lists what premium unlocks', () => {
    license()
    render(<PremiumSection />)
    for (const feature of PREMIUM_FEATURES) {
      expect(screen.getByText(t(`premium.features.${feature}`))).toBeInTheDocument()
    }
  })

  it('activates a pasted key', async () => {
    license()
    render(<PremiumSection />)
    await userEvent.type(keyField(), ' 38b1460a-5104-4067-a91d-77b872934d51 ')
    await userEvent.click(screen.getByRole('button', { name: t('premium.activate') }))
    expect(window.api.activateLicense).toHaveBeenCalledWith('38b1460a-5104-4067-a91d-77b872934d51')
  })

  it('says kindly when a key is not accepted', async () => {
    license()
    vi.mocked(window.api.activateLicense).mockResolvedValueOnce({ ok: false, reason: 'invalid' })
    render(<PremiumSection />)
    await userEvent.type(keyField(), 'abc')
    await userEvent.click(screen.getByRole('button', { name: t('premium.activate') }))
    expect(await screen.findByRole('alert')).toHaveTextContent(t('premium.errors.invalid'))
  })

  it('shows the key it was unlocked with, and frees this Mac', async () => {
    const send = license(PREMIUM)
    render(<PremiumSection />)
    expect(screen.getByText('•••• 4d51')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: t('premium.deactivate') }))
    await userEvent.click(screen.getByRole('button', { name: t('premium.deactivateConfirm') }))
    expect(window.api.deactivateLicense).toHaveBeenCalled()
    send({ plan: 'free', keyHint: null })
    expect(keyField()).toBeInTheDocument()
  })

  it('asks before freeing this Mac, and stays premium on cancel', async () => {
    license(PREMIUM)
    render(<PremiumSection />)
    await userEvent.click(screen.getByRole('button', { name: t('premium.deactivate') }))
    expect(screen.getByText(t('premium.deactivateWarning'))).toBeInTheDocument()
    // The text button; the dialog's close button shares its name.
    await userEvent.click(screen.getByText(t('confirm.cancel')))
    expect(window.api.deactivateLicense).not.toHaveBeenCalled()
    expect(screen.queryByText(t('premium.deactivateWarning'))).toBeNull()
  })

  it('says buying is not open yet while there is no checkout', async () => {
    license()
    render(<PremiumSection />)
    await userEvent.click(screen.getByRole('button', { name: t('premium.buy') }))
    expect(await screen.findByText(t('premium.buySoon'))).toBeInTheDocument()
  })
})
