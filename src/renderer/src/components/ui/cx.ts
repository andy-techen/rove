/** Joins class names, skipping falsy ones: cx('btn', active && 'active'). */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}
