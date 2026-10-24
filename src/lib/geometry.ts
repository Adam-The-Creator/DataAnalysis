import type { LineStats, Point } from '@/api/types'

/**
 * Milliseconds of the game's legacy stamp "yyyy_MM_dd_HH_mm_ss_fff". The stamp has no time zone, so only the
 * difference between two stamps is meaningful (same rule as on the server).
 */
export function legacyTimestampMs(timestamp: string | null | undefined): number | null {
  const match = /^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{3})/.exec(timestamp ?? '')
  if (!match) {
    return null
  }
  const [year, month, day, hour, minute, second, milli] = match.slice(1).map(Number)
  return Date.UTC(year, month - 1, day, hour, minute, second, milli)
}

export function formatLegacyTimestamp(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, width = 2) => String(n).padStart(width, '0')
  return (
    `${d.getUTCFullYear()}_${p(d.getUTCMonth() + 1)}_${p(d.getUTCDate())}_` +
    `${p(d.getUTCHours())}_${p(d.getUTCMinutes())}_${p(d.getUTCSeconds())}_${p(d.getUTCMilliseconds(), 3)}`
  )
}

/** The time of a point: its UTC time when it has one, the legacy stamp otherwise. */
export function pointTime(point: Point): number | null {
  return point.utcMs ?? legacyTimestampMs(point.timestamp)
}

/**
 * UTC minus legacy stamp, from the first point that has both. The line history only has the legacy stamp, so this
 * puts it on the same axis as the points and the events.
 */
export function legacyOffsetMs(lines: { points: Point[] }[]): number | null {
  for (const line of lines) {
    for (const point of line.points) {
      if (point.utcMs != null) {
        const legacy = legacyTimestampMs(point.timestamp)
        if (legacy != null) return point.utcMs - legacy
      }
    }
  }
  return null
}

/** Start and end of a stroke in milliseconds: the UTC times when present, the legacy stamps otherwise. */
export function strokeTimes(points: Point[]): { start: number; end: number } | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) {
    return null
  }
  if (first.utcMs != null && last.utcMs != null) {
    return { start: first.utcMs, end: last.utcMs }
  }
  const start = legacyTimestampMs(first.timestamp)
  const end = legacyTimestampMs(last.timestamp)
  return start != null && end != null ? { start, end } : null
}

/** Length, bounds and duration of a stroke, derived the way the server derives its line stats. */
export function computeLineStats(points: Point[]): LineStats {
  const first = points[0]
  if (!first) {
    return {
      pointCount: 0, length: 0,
      boundsMinX: 0, boundsMinY: 0, boundsMinZ: 0, boundsMaxX: 0, boundsMaxY: 0, boundsMaxZ: 0,
    }
  }

  let length = 0
  let [minX, minY, minZ] = [first.x, first.y, first.z]
  let [maxX, maxY, maxZ] = [first.x, first.y, first.z]
  let previous = first
  for (const p of points) {
    length += Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z)
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
    previous = p
  }

  const times = strokeTimes(points)
  const hasUtc = first.utcMs != null && previous.utcMs != null
  return {
    pointCount: points.length,
    length,
    durationMs: times ? Math.max(0, times.end - times.start) : null,
    startUtcMs: hasUtc ? first.utcMs : null,
    endUtcMs: hasUtc ? previous.utcMs : null,
    boundsMinX: minX, boundsMinY: minY, boundsMinZ: minZ,
    boundsMaxX: maxX, boundsMaxY: maxY, boundsMaxZ: maxZ,
  }
}
