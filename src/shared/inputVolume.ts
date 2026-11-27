// The Mac's input volume (System Settings ▸ Sound ▸ Input), 0–100, for the mic check's
// "set my level". Only the system's current input has one Rove can reach, and many
// interfaces have none: their gain is a knob on the box.

export const INPUT_VOLUME_CHANNELS = {
  get: 'inputVolume:get',
  set: 'inputVolume:set'
} as const

export const INPUT_VOLUME_MAX = 100

/** The volume AppleScript reported, or null when the input has no volume to set. */
export function parseInputVolume(raw: unknown): number | null {
  const volume = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (String(raw).trim() === '' || !Number.isFinite(volume)) return null
  return Math.min(INPUT_VOLUME_MAX, Math.max(0, Math.round(volume)))
}
