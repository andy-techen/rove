export interface History<T> {
  past: T[]
  future: T[]
  /** Key of the most recent edit, so a run of same-key edits undoes as one step. */
  lastKey?: string
}

const LIMIT = 100

export const emptyHistory: History<never> = { past: [], future: [] }

/** Records `previous` as the state to return to, unless it continues the last edit. */
export function pushHistory<T>(history: History<T>, previous: T, key?: string): History<T> {
  if (key !== undefined && key === history.lastKey) return { ...history, future: [] }
  return { past: [...history.past, previous].slice(-LIMIT), future: [], lastKey: key }
}

export function undoHistory<T>(
  history: History<T>,
  present: T
): { history: History<T>; value: T } | null {
  if (history.past.length === 0) return null
  return {
    value: history.past[history.past.length - 1],
    history: { past: history.past.slice(0, -1), future: [present, ...history.future] }
  }
}

export function redoHistory<T>(
  history: History<T>,
  present: T
): { history: History<T>; value: T } | null {
  if (history.future.length === 0) return null
  return {
    value: history.future[0],
    history: { past: [...history.past, present], future: history.future.slice(1) }
  }
}
