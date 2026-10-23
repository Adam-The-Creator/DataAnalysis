import type { Hand, Line, LineColor, Point } from '@/api/types'
import { computeLineStats, formatLegacyTimestamp } from '@/lib/geometry'

/**
 * Generator of the demo drawings: synthetic 3D strokes (flowers, trees, waves, ...) with timing, pressure,
 * hands and erased strokes, shaped like the drawings the game stores. Everything is seeded, so the demo data is
 * the same on every start.
 */

export type Vec = [number, number, number]
export type Rng = () => number

const TAU = Math.PI * 2

export function createRng(seed: number): Rng {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(count: number, fn: (t: number) => Vec): Vec[] {
  return Array.from({ length: count }, (_, i) => fn(i / (count - 1)))
}

function ellipse(c: Vec, rx: number, ry: number, rotation = 0, depth = 0, count = 40): Vec[] {
  return sample(count, (t) => {
    const a = t * TAU
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    return [
      c[0] + x * Math.cos(rotation) - y * Math.sin(rotation),
      c[1] + x * Math.sin(rotation) + y * Math.cos(rotation),
      c[2] + depth * Math.sin(a),
    ]
  })
}

// --- Shapes: each returns a list of polylines around the centre c (metres, game coordinates) ---

export type Shape = (rng: Rng, c: Vec) => Vec[][]

export const flower: Shape = (rng, c) => {
  const petals = 5 + Math.floor(rng() * 3)
  const radius = 0.12 + rng() * 0.05
  const strokes: Vec[][] = []
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU
    strokes.push(ellipse([c[0] + Math.cos(a) * radius, c[1] + Math.sin(a) * radius, c[2]], radius * 0.55, radius * 0.28, a, 0.03))
  }
  strokes.push(ellipse(c, radius * 0.35, radius * 0.35))
  strokes.push(sample(24, (t) => [c[0] + 0.04 * Math.sin(t * 4), c[1] - radius * 1.2 - t * 0.5, c[2]]))
  const mid: Vec = [c[0], c[1] - radius * 1.2 - 0.28, c[2]]
  strokes.push(ellipse([mid[0] + 0.08, mid[1], mid[2]], 0.08, 0.035, 0.5))
  strokes.push(ellipse([mid[0] - 0.08, mid[1] - 0.05, mid[2]], 0.08, 0.035, -0.5))
  return strokes
}

export const tree: Shape = (rng, c) => {
  const base: Vec = [c[0], c[1] - 0.5, c[2]]
  const strokes: Vec[][] = [sample(20, (t) => [base[0] + 0.015 * Math.sin(t * 6), base[1] + t * 0.5, base[2]])]
  const top: Vec = [c[0], c[1], c[2]]
  for (let i = 0; i < 6; i++) {
    const angle = (i / 5 - 0.5) * 2.2
    const length = 0.25 + rng() * 0.15
    const depth = (rng() - 0.5) * 0.3
    strokes.push(sample(12, (t) => [
      top[0] + Math.sin(angle) * length * t,
      top[1] + Math.cos(angle) * length * t,
      top[2] + depth * t,
    ]))
  }
  for (let i = 0; i < 3; i++) {
    strokes.push(ellipse([c[0] + (rng() - 0.5) * 0.3, c[1] + 0.3 + rng() * 0.1, c[2] + (rng() - 0.5) * 0.2],
      0.18 + rng() * 0.06, 0.14 + rng() * 0.05, rng(), 0.05, 36))
  }
  return strokes
}

export const sun: Shape = (_rng, c) => {
  const strokes: Vec[][] = [ellipse(c, 0.12, 0.12)]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    strokes.push([
      [c[0] + Math.cos(a) * 0.16, c[1] + Math.sin(a) * 0.16, c[2]],
      [c[0] + Math.cos(a) * 0.26, c[1] + Math.sin(a) * 0.26, c[2]],
    ])
  }
  return strokes
}

export const house: Shape = (_rng, c) => {
  const [x, y, z] = c
  const corner = (dx: number, dy: number, dz = 0): Vec => [x + dx, y + dy, z + dz]
  return [
    [corner(-0.25, -0.2), corner(0.25, -0.2), corner(0.25, 0.15), corner(-0.25, 0.15), corner(-0.25, -0.2)],
    [corner(-0.3, 0.15), corner(0, 0.4), corner(0.3, 0.15)],
    [corner(-0.05, -0.2), corner(-0.05, -0.02), corner(0.08, -0.02), corner(0.08, -0.2)],
    [corner(-0.25, -0.2, 0.2), corner(0.25, -0.2, 0.2), corner(0.25, 0.15, 0.2), corner(-0.25, 0.15, 0.2), corner(-0.25, -0.2, 0.2)],
    [corner(-0.25, -0.2), corner(-0.25, -0.2, 0.2)],
    [corner(0.25, 0.15), corner(0.25, 0.15, 0.2)],
  ]
}

export const waves: Shape = (rng, c) => {
  const phase = rng() * TAU
  return Array.from({ length: 4 }, (_, k) =>
    sample(40, (t) => [
      c[0] - 0.6 + t * 1.2,
      c[1] - 0.1 * k + 0.04 * Math.sin(t * TAU * 1.5 + phase + k),
      c[2] + 0.12 * k,
    ]),
  )
}

export const spiral: Shape = (_rng, c) => [
  sample(120, (t) => {
    const r = 0.02 + t * 0.28
    const a = t * TAU * 3
    return [c[0] + Math.cos(a) * r, c[1] + 0.25 * (t - 0.5), c[2] + Math.sin(a) * r]
  }),
]

export const scribble: Shape = (rng, c) => {
  const strokes: Vec[][] = []
  for (let s = 0; s < 4; s++) {
    let position: Vec = [c[0] + (rng() - 0.5) * 0.2, c[1] + (rng() - 0.5) * 0.2, c[2] + (rng() - 0.5) * 0.2]
    let direction: Vec = [rng() - 0.5, rng() - 0.5, rng() - 0.5]
    const polyline: Vec[] = [position]
    for (let i = 0; i < 70; i++) {
      direction = [
        direction[0] * 0.7 + (rng() - 0.5) * 0.9 + (c[0] - position[0]) * 1.2,
        direction[1] * 0.7 + (rng() - 0.5) * 0.9 + (c[1] - position[1]) * 1.2,
        direction[2] * 0.7 + (rng() - 0.5) * 0.9 + (c[2] - position[2]) * 1.2,
      ]
      const norm = Math.hypot(...direction) || 1
      position = [position[0] + (direction[0] / norm) * 0.025, position[1] + (direction[1] / norm) * 0.025, position[2] + (direction[2] / norm) * 0.025]
      polyline.push(position)
    }
    strokes.push(polyline)
  }
  return strokes
}

export function mirrorX(strokes: Vec[][], axisX: number): Vec[][] {
  return strokes.map((polyline) => polyline.map(([x, y, z]): Vec => [2 * axisX - x, y, z]))
}

/** A short drawing: one circle and one line. */
export const quickCircle: Shape = (_rng, c) => [ellipse(c, 0.15, 0.15), [[c[0] - 0.2, c[1] - 0.2, c[2]], [c[0] + 0.2, c[1] - 0.2, c[2]]]]

// --- Strokes ---

export interface StrokeOptions {
  rng: Rng
  idPrefix: string
  authorId: string
  startMs: number
  palette: LineColor[]
  hand: (index: number) => Hand
  speed?: number // metres per second
  tremor?: number // metres of random wobble per point
  pressure?: number // base trigger value while drawing (0..1), the pressure rises and falls along a stroke
  eraseProbability?: number
  /** Schema version 1: no UTC times and no pressure, only the legacy time stamps. */
  legacy?: boolean
}

function resample(polyline: Vec[], step: number, tremor: number, rng: Rng): Vec[] {
  const lengths = [0]
  for (let i = 1; i < polyline.length; i++) {
    const [a, b] = [polyline[i - 1], polyline[i]]
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  }
  const total = lengths[lengths.length - 1]
  const count = Math.max(4, Math.ceil(total / step))
  const result: Vec[] = []
  let segment = 1
  for (let i = 0; i < count; i++) {
    const distance = (i / (count - 1)) * total
    while (segment < polyline.length - 1 && lengths[segment] < distance) {
      segment++
    }
    const [a, b] = [polyline[segment - 1], polyline[segment]]
    const span = lengths[segment] - lengths[segment - 1] || 1
    const f = Math.min(1, Math.max(0, (distance - lengths[segment - 1]) / span))
    result.push([
      a[0] + (b[0] - a[0]) * f + (rng() - 0.5) * 2 * tremor,
      a[1] + (b[1] - a[1]) * f + (rng() - 0.5) * 2 * tremor,
      a[2] + (b[2] - a[2]) * f + (rng() - 0.5) * 2 * tremor,
    ])
  }
  return result
}

const pad = (n: number) => String(n).padStart(2, '0')

export function buildLines(polylines: Vec[][], options: StrokeOptions): { lines: Line[]; endMs: number } {
  const { rng, idPrefix, authorId, palette, speed = 0.35, tremor = 0.0012, pressure = 0.35, eraseProbability = 0.08 } = options
  let clock = options.startMs
  const lines: Line[] = []

  polylines.forEach((polyline, index) => {
    const step = 0.011 + rng() * 0.004
    const positions = resample(polyline, step, tremor, rng)
    const hand = options.hand(index)

    const points: Point[] = positions.map(([x, y, z], i) => {
      clock += Math.round((step / speed) * 1000 * (0.7 + rng() * 0.6))
      const point: Point = { x, y, z, timestamp: formatLegacyTimestamp(clock) }
      if (!options.legacy) {
        const t = i / (positions.length - 1)
        point.utcMs = clock
        point.pressure = Math.min(1, Math.max(0.05, pressure + 0.5 * Math.sin(Math.PI * t) * (0.8 + rng() * 0.2)))
      }
      return point
    })

    const startColor = palette[Math.floor(rng() * palette.length)]
    const endColor = rng() < 0.3 ? palette[Math.floor(rng() * palette.length)] : startColor
    const startWidth = 0.003 + rng() * 0.009
    const erased = rng() < eraseProbability
    const startStamp = points[0].timestamp
    const endStamp = points[points.length - 1].timestamp

    lines.push({
      id: `${idPrefix}-line-${pad(index + 1)}`,
      points,
      startWidth,
      endWidth: startWidth * (0.8 + rng() * 0.4),
      startColor,
      endColor,
      hand,
      userID: authorId,
      history: [
        { eventType: 1, invoker: authorId, timestamp: startStamp, hand },
        ...(erased ? [{ eventType: 0, invoker: authorId, timestamp: endStamp, hand }] : []),
      ],
      status: erased ? 0 : 1,
      stats: computeLineStats(points),
    })

    clock += 700 + Math.round(rng() * 3000) // pause before the next stroke
  })

  return { lines, endMs: clock }
}
