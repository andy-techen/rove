import en from './en.json'

type Copy = typeof en

/** Every dot-separated path to a string in the copy file, e.g. 'polish.controls.space.label'. */
type CopyKey<T = Copy, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : CopyKey<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/**
 * Looks up user-facing text and fills `{placeholders}`.
 * `t('shortcut', { label: 'Undo', keys: '⌘Z' })` → "Undo (⌘Z)"
 */
export function t(key: CopyKey, values: Record<string, string | number> = {}): string {
  let node: unknown = en
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
  if (typeof node !== 'string') throw new Error(`Missing copy for "${key}"`)
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  )
}

export type { CopyKey }
