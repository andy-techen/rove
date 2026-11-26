export type CycleState = 'past' | 'now' | 'ahead'

/** Where item `index` of `length` stands at `step` of a looping run through them:
 * already gone by, the current one, or still to come. */
export function cycleState(index: number, step: number, length: number): CycleState {
  const at = step % length
  if (index === at) return 'now'
  return index < at ? 'past' : 'ahead'
}
