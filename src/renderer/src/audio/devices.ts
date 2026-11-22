const SAVED_DEVICE_KEY = 'rove.inputDeviceId'

export function pickInputDevice(
  inputs: MediaDeviceInfo[],
  preferredId: string | null
): string | null {
  if (preferredId && inputs.some((d) => d.deviceId === preferredId)) return preferredId
  if (inputs.some((d) => d.deviceId === 'default')) return 'default'
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
      return 'Microphone access is blocked.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "That microphone isn't connected anymore. Pick another one."
    case 'NotReadableError':
      return 'That microphone is busy in another app or was unplugged.'
    default:
      return "Couldn't open that microphone."
  }
}
