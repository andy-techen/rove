import { t } from '@shared/copy'

const SAVED_DEVICE_KEY = 'rove.inputDeviceId'
// Chromium's id for "whatever the system's input is set to".
const SYSTEM_DEFAULT_ID = 'default'

export function pickInputDevice(
  inputs: MediaDeviceInfo[],
  preferredId: string | null
): string | null {
  if (preferredId && inputs.some((d) => d.deviceId === preferredId)) return preferredId
  if (inputs.some((d) => d.deviceId === SYSTEM_DEFAULT_ID)) return SYSTEM_DEFAULT_ID
  return inputs[0]?.deviceId ?? null
}

export function loadSavedDeviceId(): string | null {
  try {
    return localStorage.getItem(SAVED_DEVICE_KEY)
  } catch {
    return null
  }
}

export function saveDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(SAVED_DEVICE_KEY, deviceId)
  } catch {
    // Remembering the mic is a convenience; losing it just means re-picking.
  }
}

export function describeInputError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
      return t('inputErrors.blocked')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return t('inputErrors.gone')
    case 'NotReadableError':
      return t('inputErrors.busy')
    default:
      return t('inputErrors.generic')
  }
}
