/**
 * The premium features; everything else is free and never gated. Both processes read
 * this list. Taking a feature off it makes every gate on it fail the typecheck, which
 * points to each place to unlock it.
 */
export const PREMIUM_FEATURES = ['vocalRemoval', 'autoPolish'] as const

export type FeatureId = (typeof PREMIUM_FEATURES)[number]
