import type { ActivationFailure } from '@shared/license'

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

// Lemon Squeezy keys are 36 characters; anything much shorter is a typo or a paste gone
// wrong. The fake turns those down so the error message can be tried.
const MIN_KEY_LENGTH = 8
// Long enough to see "Activating…", as a real request would show it.
const FAKE_DELAY_MS = 600

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
