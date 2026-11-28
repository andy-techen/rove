import type { ActivationFailure } from '@shared/license/license'
import { FAKE_DELAY_MS, MIN_KEY_LENGTH } from './constants'

/**
 * Where license keys are checked: Lemon Squeezy's license API, once it's connected. The
 * rest of the app only talks to this, so swapping the fake for the real one is one
 * change in license.ts.
 */
export interface LicenseService {
  /** Uses one of the key's activations for this Mac. */
  activate(key: string): Promise<{ ok: true } | { ok: false; reason: ActivationFailure }>
  /** Gives this Mac's activation back, so the key can be used on another. */
  deactivate(key: string): Promise<void>
  /** Where to buy premium, or null while there's nowhere yet. */
  checkoutUrl: string | null
}

/** Stands in for Lemon Squeezy: any key long enough is accepted, nothing goes online. */
export function fakeLicenseService({ delayMs = FAKE_DELAY_MS } = {}): LicenseService {
  const wait = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs))
  return {
    async activate(key) {
      await wait()
      return key.length >= MIN_KEY_LENGTH ? { ok: true } : { ok: false, reason: 'invalid' }
    },
    async deactivate() {
      await wait()
    },
    checkoutUrl: null
  }
}
