// What's free and what's premium. Premium is a one-time purchase unlocked with a license
// key; the main process works out the plan on launch and the renderer follows it.
// Which features are premium is its own list, in premiumFeatures.ts.

import { FeatureId, PREMIUM_FEATURES } from './premiumFeatures'

export type { FeatureId }

export const PLANS = ['free', 'premium'] as const
export type Plan = (typeof PLANS)[number]

/** Whether a plan includes a feature. Premium includes everything. */
export function isEnabled(feature: FeatureId, plan: Plan): boolean {
  return plan === 'premium' || !(PREMIUM_FEATURES as readonly string[]).includes(feature)
}

/**
 * Stops work on a feature the plan doesn't include. The main process calls this where
 * the work happens, so hiding a button is never the only lock.
 */
export function requireFeature(feature: FeatureId, plan: Plan): void {
  if (!isEnabled(feature, plan)) throw new Error(`${feature} needs Rove Premium`)
}

/** A stored or sent plan, falling back to free. */
export const parsePlan = (raw: unknown): Plan =>
  (PLANS as readonly unknown[]).includes(raw) ? (raw as Plan) : 'free'
