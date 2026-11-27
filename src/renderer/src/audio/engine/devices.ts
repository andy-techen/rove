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

// Chromium prefixes the system's current device with this in its label.
const DEFAULT_PREFIX = /^Default - /
// The Mac's own mic and headphone jack share a group but don't play the mic back.
const BUILT_IN = /built-in/i

/**
 * Whether the system output is the chosen mic itself: headphones plugged into a USB mic
 * or interface, which plays the singer's voice to them with no delay. Rove playing it
 * as well would arrive a moment late and sound like an echo.
 */
export function monitorsItself(
  inputs: MediaDeviceInfo[],
  deviceId: string | null,
  outputs: MediaDeviceInfo[]
): boolean {
  const input = inputs.find((d) => d.deviceId === deviceId)
  const output = outputs.find((d) => d.deviceId === SYSTEM_DEFAULT_ID) ?? outputs[0]
  if (!input || !output || BUILT_IN.test(input.label)) return false
  const name = (d: MediaDeviceInfo): string => d.label.replace(DEFAULT_PREFIX, '')
  return (!!input.groupId && input.groupId === output.groupId) || name(input) === name(output)
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

const HEAR_SELF_KEY = 'rove.hearSelf'

/** Whether the singer chose to hear themselves through Rove on this setup; null if never. */
export function loadHearSelf(key: string): boolean | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HEAR_SELF_KEY) ?? '{}')
    const value =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[key] : null
    return typeof value === 'boolean' ? value : null
  } catch {
    return null
  }
}

export function saveHearSelf(key: string, on: boolean): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HEAR_SELF_KEY) ?? '{}')
    const all = parsed && typeof parsed === 'object' ? parsed : {}
    localStorage.setItem(HEAR_SELF_KEY, JSON.stringify({ ...all, [key]: on }))
  } catch {
    // Losing the choice only brings back the default for this setup.
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
