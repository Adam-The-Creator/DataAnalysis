import type { DrawingGeometry } from '@/api/types'
import { rgbToHex, srgbToLinear } from './colors'

/**
 * A stroke prepared for display. The viewer and the SVG snapshots only know this shape, so the source of the
 * geometry can change (the analysis API's simplified strokes, or a whole drawing converted on the client) without
 * touching them.
 *
 * Viewer space is right-handed and Y-up. The game (Unity) is left-handed, so z is negated; otherwise the
 * drawing would be mirrored.
 */
export interface ViewerStroke {
  id: string
  authorId: string
  hand: 'left' | 'right'
  erased: boolean
  /** When it was erased (ms on the drawing's time axis), if it was and the history says when. */
  erasedAtMs: number | null
  positions: number[] // x, y, z per point (viewer space)
  colors: number[] // r, g, b per point, linear 0..1
  times: (number | null)[] // ms on the drawing's time axis, per point (null without time data)
  width: number // metres
  startHex: string
  endHex: string
  pointCount: number // of the original stroke, before simplification
  length: number // metres
  durationMs: number | null
}

export interface Bounds {
  min: [number, number, number]
  max: [number, number, number]
  center: [number, number, number]
  /** The largest extent, never smaller than 0.2 m so that tiny drawings still get a sensible camera. */
  size: number
}

export function toViewerStrokes(geometry: DrawingGeometry): ViewerStroke[] {
  return geometry.strokes
    .filter((stroke) => stroke.points.length > 1)
    .map((stroke) => {
      const last = stroke.points.length - 1
      const positions: number[] = []
      const colors: number[] = []
      const times: (number | null)[] = []
      stroke.points.forEach(([x, y, z, t], i) => {
        const f = last === 0 ? 0 : i / last
        positions.push(x, y, -z)
        times.push(t)
        colors.push(
          srgbToLinear((stroke.startColor.r + f * (stroke.endColor.r - stroke.startColor.r)) / 255),
          srgbToLinear((stroke.startColor.g + f * (stroke.endColor.g - stroke.startColor.g)) / 255),
          srgbToLinear((stroke.startColor.b + f * (stroke.endColor.b - stroke.startColor.b)) / 255),
        )
      })
      return {
        id: stroke.id,
        authorId: stroke.authorId,
        hand: stroke.hand === -1 ? 'left' : 'right',
        erased: stroke.erased,
        erasedAtMs: stroke.erasedAtMs,
        positions,
        colors,
        times,
        width: stroke.width,
        startHex: rgbToHex(stroke.startColor),
        endHex: rgbToHex(stroke.endColor),
        pointCount: stroke.pointCount,
        length: stroke.length,
        durationMs: stroke.durationMs,
      }
    })
}

export function strokesBounds(strokes: ViewerStroke[]): Bounds {
  const drawn = strokes.filter((s) => !s.erased)
  const source = drawn.length > 0 ? drawn : strokes
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const stroke of source) {
    for (let i = 0; i < stroke.positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = stroke.positions[i + axis]
        min[axis] = Math.min(min[axis], value)
        max[axis] = Math.max(max[axis], value)
      }
    }
  }
  if (!Number.isFinite(min[0])) {
    return { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], center: [0, 0.5, 0], size: 1 }
  }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 0.2)
  return { min, max, center, size }
}

// --- Replay (requirement DRW-05) ---

/** When a stroke starts and ends on the time axis, or null when it has no time data. */
export function strokeSpan(stroke: ViewerStroke): { start: number; end: number } | null {
  const first = stroke.times[0]
  const last = stroke.times[stroke.times.length - 1]
  return first != null && last != null ? { start: first, end: last } : null
}

/** Whether the drawing has time data to replay: at least one stroke with times. */
export function canReplay(strokes: ViewerStroke[]): boolean {
  return strokes.some((s) => strokeSpan(s) !== null)
}

/**
 * How a stroke looks at replay time t (null: no replay, the whole drawing is shown).
 *
 * A stroke that was erased is there from the moment it is drawn, like any other, and gone from the moment it was erased
 * (its erasedAtMs, or the moment it is finished when the history does not say). With `showErased` it is not gone then
 * but stays as the dimmed ghost the static view shows for erased strokes. A stroke without time data is always there.
 */
export type StrokeLook = { visible: false } | { visible: true; part: 'whole' | 'partial'; ghost: boolean }

export function replayLook(stroke: ViewerStroke, time: number | null, showErased: boolean): StrokeLook {
  const span = strokeSpan(stroke)
  if (time === null || !span) return { visible: true, part: 'whole', ghost: stroke.erased }
  if (time < span.start) return { visible: false }
  if (time < span.end) return { visible: true, part: 'partial', ghost: false }
  if (!stroke.erased) return { visible: true, part: 'whole', ghost: false }
  if (time < (stroke.erasedAtMs ?? span.end)) return { visible: true, part: 'whole', ghost: false }
  return showErased ? { visible: true, part: 'whole', ghost: true } : { visible: false }
}

/** The part of a stroke drawn until time t: the points so far, and an end point interpolated to exactly t. */
export function sliceStroke(stroke: ViewerStroke, time: number): ViewerStroke | null {
  const count = stroke.times.length
  let last = -1
  for (let i = 0; i < count; i++) {
    const t = stroke.times[i]
    if (t != null && t <= time) last = i
    else if (t != null) break
  }
  if (last < 0) return null

  const positions = stroke.positions.slice(0, (last + 1) * 3)
  const colors = stroke.colors.slice(0, (last + 1) * 3)
  const times = stroke.times.slice(0, last + 1)
  const next = last + 1
  const tLast = stroke.times[last]
  const tNext = stroke.times[next]
  if (next < count && tLast != null && tNext != null && tNext > tLast) {
    const f = (time - tLast) / (tNext - tLast)
    for (let axis = 0; axis < 3; axis++) {
      positions.push(stroke.positions[last * 3 + axis] + f * (stroke.positions[next * 3 + axis] - stroke.positions[last * 3 + axis]))
      colors.push(stroke.colors[last * 3 + axis] + f * (stroke.colors[next * 3 + axis] - stroke.colors[last * 3 + axis]))
    }
    times.push(time)
  }
  return positions.length >= 6 ? { ...stroke, positions, colors, times } : null
}
