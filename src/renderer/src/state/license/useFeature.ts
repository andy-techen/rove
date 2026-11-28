import { useEffect, useState } from 'react'
import { FeatureId, Plan, isEnabled } from '@shared/license/features'
import { FREE_STATUS, LicenseStatus } from '@shared/license/license'

/** The plan right now: `onLicense` reports it as soon as it's subscribed. */
function currentLicense(): LicenseStatus {
  let now = FREE_STATUS
  window.api.onLicense((status) => {
    now = status
  })()
  return now
}

/** This Mac's plan and key hint, following the main process as a key is activated or freed. */
export function useLicense(): LicenseStatus {
  // Start from the plan the preload already holds, not free: waiting for the effect
  // paints one frame of the free screen, which flashes on a premium Mac.
  const [status, setStatus] = useState(currentLicense)
  useEffect(() => window.api.onLicense(setStatus), [])
  return status
}

export const usePlan = (): Plan => useLicense().plan

/**
 * Whether a feature is on for this Mac's plan: show it, or hide it. The main process
 * checks again where the work happens, so this only decides what's shown.
 */
export function useFeature(feature: FeatureId): boolean {
  return isEnabled(feature, usePlan())
}
