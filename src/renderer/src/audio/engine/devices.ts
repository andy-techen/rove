import { t } from '@shared/copy'

const SAVED_DEVICE_KEY = 'rove.inputDeviceId'
// Chromium's id for "whatever the system's input is set to".
const SYSTEM_DEFAULT_ID = 'default'

/**
 * Whether this is the Mac's current input, the one whose volume Rove can set: "Default",
 * or the same mic picked by name (Chromium gives both entries the same group).
 */
export function isSystemInput(inputs: MediaDeviceInfo[], deviceId: string | null): boolean {
  if (deviceId === SYSTEM_DEFAULT_ID) return true
  const system = inputs.find((d) => d.deviceId === SYSTEM_DEFAULT_ID)
  const chosen = inputs.find((d) => d.deviceId === deviceId)
  return !!system?.groupId && system.groupId === chosen?.groupId
}

export function pickInputDevice(
  inputs: MediaDeviceInfo[],
  preferredId: string | null
): string | null {
  if (preferredId && inputs.some((d) => d.deviceId === preferredId)) return preferredId
  if (inputs.some((d) => d.deviceId === SYSTEM_DEFAULT_ID)) return SYSTEM_DEFAULT_ID
  return inputs[0]?.deviceId ?? null
}

// Output names that play into the room, where the mic would hear itself and howl.
// Anything else (headphones, earbuds, an interface) is trusted to keep the sound
// at the singer's ears.
const OUT_LOUD = /speaker|display audio/i

/** Whether the system's sound output plays into the room rather than into headphones. */
export function playsOutLoud(outputs: MediaDeviceInfo[]): boolean {
  const current = outputs.find((d) => d.deviceId === SYSTEM_DEFAULT_ID) ?? outputs[0]
  return !!current && OUT_LOUD.test(current.label)
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

const LEARNED_LATENCY_KEY = 'rove.learnedLatency'

/**
 * Names a recording setup: this mic with the system's current output. The unreported
 * delay belongs to the pair (the same mic is late with Bluetooth headphones, on time
 * with wired ones).
 */
export function setupKey(inputId: string, outputs: MediaDeviceInfo[]): string {
  const output = outputs.find((d) => d.deviceId === SYSTEM_DEFAULT_ID) ?? outputs[0]
  return `${inputId}|${output?.label ?? ''}`
}

function learnedLatencies(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEARNED_LATENCY_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** The extra delay Rove learned for this setup from takes the singer lined up. */
export function loadLearnedLatency(key: string): number {
  const sec = learnedLatencies()[key]
  return typeof sec === 'number' && Number.isFinite(sec) ? sec : 0
}

export function saveLearnedLatency(key: string, sec: number): void {
  try {
    localStorage.setItem(LEARNED_LATENCY_KEY, JSON.stringify({ ...learnedLatencies(), [key]: sec }))
  } catch {
    // Like the saved mic: losing it only means lining up the next take by hand.
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
