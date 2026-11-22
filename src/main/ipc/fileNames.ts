import path from 'node:path'

export function nextTakeName(existing: string[]): string {
  let max = 0
  for (const name of existing) {
    const match = /^take-(\d+)\.wav$/.exec(name)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `take-${String(max + 1).padStart(3, '0')}.wav`
}

export function uniqueName(existing: string[], desired: string): string {
  if (!existing.includes(desired)) return desired
  const { name, ext } = path.parse(desired)
  for (let i = 2; ; i++) {
    const candidate = `${name}-${i}${ext}`
    if (!existing.includes(candidate)) return candidate
  }
}

// Audio paths come from the renderer and the project file, so they must
// resolve to a file directly inside the project's audio folder.
export function resolveAudioPath(projectDir: string, relPath: string): string {
  const audioDir = path.resolve(projectDir, 'audio')
  const full = path.resolve(projectDir, relPath)
  if (path.dirname(full) !== audioDir) throw new Error(`Not a project audio file: ${relPath}`)
  return full
}
