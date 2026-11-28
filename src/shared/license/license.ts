// The license key that unlocks premium, as the main process stores it and the window
// sees it. The window never gets the key itself, only a hint of its last characters.

import { Plan, parsePlan } from './features'
import { HINT_CHARS } from './constants'

export const LICENSE_CHANNELS = {
  changed: 'license:changed',
  activate: 'license:activate',
  deactivate: 'license:deactivate',
  openCheckout: 'license:openCheckout',
  openOrders: 'license:openOrders'
} as const

/** What the window knows: the plan, and which key unlocked it. */
export interface LicenseStatus {
  plan: Plan
  /** The key's last characters ("•••• 4d51"), or null on the free plan. */
  keyHint: string | null
}

export const FREE_STATUS: LicenseStatus = { plan: 'free', keyHint: null }

/** Why a key wasn't accepted; each has its own message. */
export type ActivationFailure = 'invalid' | 'limit' | 'offline'

export type ActivationResult =
  { ok: true; status: LicenseStatus } | { ok: false; reason: ActivationFailure }

/** The license kept in userData/license.json. */
export interface StoredLicense {
  key: string
  activatedAt: number
}

export const keyHint = (key: string): string => `•••• ${key.slice(-HINT_CHARS)}`

export function parseStoredLicense(raw: unknown): StoredLicense | null {
  const { key, activatedAt } = (raw ?? {}) as Partial<StoredLicense>
  if (typeof key !== 'string' || !key.trim()) return null
  return { key, activatedAt: typeof activatedAt === 'number' ? activatedAt : 0 }
}

export function parseLicenseStatus(raw: unknown): LicenseStatus {
  const { plan, keyHint: hint } = (raw ?? {}) as Partial<LicenseStatus>
  const parsed = parsePlan(plan)
  return parsed === 'free'
    ? FREE_STATUS
    : { plan: parsed, keyHint: typeof hint === 'string' ? hint : null }
}

export const ACTIVATION_FAILURES: readonly ActivationFailure[] = ['invalid', 'limit', 'offline']

export function parseActivationResult(raw: unknown): ActivationResult {
  const result = (raw ?? {}) as { ok?: unknown; status?: unknown; reason?: unknown }
  if (result.ok === true) return { ok: true, status: parseLicenseStatus(result.status) }
  const reason = ACTIVATION_FAILURES.includes(result.reason as ActivationFailure)
    ? (result.reason as ActivationFailure)
    : 'invalid'
  return { ok: false, reason }
}
