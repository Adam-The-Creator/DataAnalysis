import type { Drawing } from '@/api/types'
import { rgbToHex, srgbToLinear } from './colors'
import { computeLineStats } from './geometry'

/**
 * A stroke prepared for display. The viewer and the SVG snapshots only know this shape, so the source of the
 * geometry can change later (the full drawing now, decimated geometry from the analysis API, requirement DRW-03)
 * without touching them.
 *
 * Viewer space is right-handed and Y-up. The game (Unity) is left-handed, so z is negated; otherwise the
 * drawing would be mirrored.
 */
export interface ViewerStroke {
  id: string
  authorId: string
  hand: 'left' | 'right'
  erased: boolean
  positions: number[] // x, y, z per point (viewer space)
  colors: number[] // r, g, b per point, linear 0..1
  width: number // metres
  startHex: string
  endHex: string
  pointCount: number
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

export function toViewerStrokes(drawing: Drawing): ViewerStroke[] {
  return drawing.lines
    .filter((line) => line.points.length > 1)
    .map((line) => {
      const stats = line.stats ?? computeLineStats(line.points)
      const last = line.points.length - 1
      const positions: number[] = []
      const colors: number[] = []
      line.points.forEach((p, i) => {
        const t = last === 0 ? 0 : i / last
        positions.push(p.x, p.y, -p.z)
        colors.push(
          srgbToLinear((line.startColor.r + t * (line.endColor.r - line.startColor.r)) / 255),
          srgbToLinear((line.startColor.g + t * (line.endColor.g - line.startColor.g)) / 255),
          srgbToLinear((line.startColor.b + t * (line.endColor.b - line.startColor.b)) / 255),
        )
      })
      return {
        id: line.id,
        authorId: line.userID,
        hand: line.hand === -1 ? 'left' : 'right',
        erased: line.status === 0,
        positions,
        colors,
        width: (line.startWidth + line.endWidth) / 2,
        startHex: rgbToHex(line.startColor),
        endHex: rgbToHex(line.endColor),
        pointCount: stats.pointCount,
        length: stats.length,
        durationMs: stats.durationMs ?? null,
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
