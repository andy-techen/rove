/**
 * Where the top of a peak (or the bottom of a dip) really sits between samples: the
 * vertex of a parabola through a sample `b` and its neighbours `a` and `c`, as an offset
 * from `b`'s position. 0 when the three don't curve that way.
 */
export function parabolicOffset(a: number, b: number, c: number, shape: 'peak' | 'dip'): number {
  const bend = a - 2 * b + c
  const curves = shape === 'peak' ? bend < 0 : bend > 0
  return curves ? (a - c) / (2 * bend) : 0
}
