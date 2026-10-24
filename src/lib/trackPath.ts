import type { TrackSample } from '@/api/types'

/**
 * Where a tracked head or hand was at a time on the drawing's time axis, in viewer space (the game's z is negated, like
 * for the strokes): linear between the two samples around the time. Null before the first and after the last sample,
 * and for a path without time data.
 */
export function positionAt(path: TrackSample[], time: number): [number, number, number] | null {
  const timed = path.filter((s) => s[0] != null)
  if (timed.length === 0 || time < (timed[0][0] as number) || time > (timed[timed.length - 1][0] as number)) return null

  let lo = 0
  let hi = timed.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((timed[mid][0] as number) <= time) lo = mid
    else hi = mid
  }
  const [a, b] = [timed[lo], timed[hi]]
  const span = (b[0] as number) - (a[0] as number)
  const f = span > 0 ? (time - (a[0] as number)) / span : 0
  const at = (axis: number) => (a[axis] as number) + f * ((b[axis] as number) - (a[axis] as number))
  return [at(1), at(2), -at(3)]
}
