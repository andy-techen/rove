import { useEffect, useState } from 'react'
import { FeatureId, Plan, isEnabled } from '@shared/features'
import { FREE_STATUS, LicenseStatus } from '@shared/license'

/** This Mac's plan and key hint, following the main process as a key is activated or freed. */
export function useLicense(): LicenseStatus {
  const [status, setStatus] = useState<LicenseStatus>(FREE_STATUS)
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
