import type { Drawing, DrawingGeometry, StrokeGeometry } from '@/api/types'
import { computeLineStats, legacyOffsetMs, legacyTimestampMs, pointTime, strokeTimes } from './geometry'
import { buildTimeAxis } from './timeAxis'

type Vec = [number, number, number]

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const lengthSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / lengthSq))
  return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t), p[2] - (a[2] + ab[2] * t))
}

/** Ramer-Douglas-Peucker: the indices to keep, so no dropped point is further than tolerance from the line. */
export function simplifyIndices(points: Vec[], tolerance: number): number[] {
  if (tolerance <= 0 || points.length <= 2) return points.map((_, i) => i)
  const keep = new Set([0, points.length - 1])
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let farIndex = -1
    let farDistance = 0
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(points[i], points[start], points[end])
      if (distance > farDistance) {
        farIndex = i
        farDistance = distance
      }
    }
    if (farDistance > tolerance) {
      keep.add(farIndex)
      stack.push([start, farIndex], [farIndex, end])
    }
  }
  return [...keep].sort((a, b) => a - b)
}

const round = (value: number, digits = 5) => Math.round(value * 10 ** digits) / 10 ** digits + 0

/**
 * The geometry answer built on the client from a whole drawing document. The demo mode uses it, and so does the
 * fallback for a server build that has no geometry endpoint yet. Same result as the analysis module's
 * (analysis/geometry.py), including when an erased stroke was erased.
 */
export function geometryFromDrawing(drawing: Drawing, tolerance = 0): DrawingGeometry {
  const axis = buildTimeAxis(drawing)
  const offset = legacyOffsetMs(drawing.lines)
  let duration = 0
  let original = 0
  let returned = 0

  const strokes: StrokeGeometry[] = drawing.lines.map((line) => {
    const coords = line.points.map((p): Vec => [p.x, p.y, p.z])
    const keep = simplifyIndices(coords, tolerance)
    const stats = line.stats ?? computeLineStats(line.points)
    const points = keep.map((i): StrokeGeometry['points'][number] => {
      const t = pointTime(line.points[i])
      return [round(coords[i][0]), round(coords[i][1]), round(coords[i][2]), t == null ? null : axis.map(t)]
    })
    const last = points[points.length - 1]?.[3]
    if (last != null) duration = Math.max(duration, last)
    original += line.points.length
    returned += points.length
    const pick = (c: { r: number; g: number; b: number }) => ({ r: c.r, g: c.g, b: c.b })

    // When an erased stroke was erased: the last erase or undo of its history, never before the stroke is finished.
    // The history only has the legacy stamp, the offset puts it on the same axis as the points.
    const erased = line.status !== 1
    const times = strokeTimes(line.points)
    let erasedAtMs: number | null = null
    if (erased && times) {
      const stamps = line.history
        .filter((event) => event.eventType === 0 || event.eventType === 2)
        .map((event) => legacyTimestampMs(event.timestamp))
        .filter((stamp): stamp is number => stamp != null)
      if (stamps.length > 0) {
        erasedAtMs = Math.max(axis.map(Math.max(...stamps) + (offset ?? 0)), axis.map(times.end))
        duration = Math.max(duration, erasedAtMs)
      }
    }

    return {
      id: line.id,
      authorId: line.userID,
      hand: line.hand,
      erased,
      erasedAtMs,
      width: round((line.startWidth + line.endWidth) / 2),
      startColor: pick(line.startColor),
      endColor: pick(line.endColor),
      length: round(stats.length, 4),
      pointCount: stats.pointCount,
      durationMs: stats.durationMs ?? null,
      points,
    }
  })

  const { metadata } = drawing
  return {
    drawingId: metadata.id,
    tolerance,
    originMs: axis.origin,
    timeBase: drawing.lines.some((l) => l.points.some((p) => p.utcMs != null)) ? 'utc' : 'legacy',
    durationMs: duration,
    breaks: axis.breakMarks(),
    pointCountOriginal: original,
    pointCountReturned: returned,
    hasTracking: (drawing.trackedBehaviors ?? []).length > 0,
    hasEvents: (drawing.events ?? []).length > 0,
    metadata: {
      id: metadata.id, owner: metadata.owner, collaborators: metadata.collaborators, date: metadata.date,
      gameType: metadata.gameType, sessionID: metadata.sessionID, showBoy: metadata.showBoy,
      showGirl: metadata.showGirl, sadChildCoordinates: metadata.sadChildCoordinates ?? null,
      schemaVersion: metadata.schemaVersion ?? null, appVersion: metadata.appVersion ?? null,
      device: metadata.device ?? null, trackingDecimation: metadata.trackingDecimation ?? null,
    },
    placedModels: drawing.placedModels ?? [],
    strokes,
  }
}
