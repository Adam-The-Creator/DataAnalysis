import type { DrawingEvent, Line, Pose, TrackedBehavior } from '@/api/types'
import { rgbToHex } from '@/lib/colors'
import { strokeTimes } from '@/lib/geometry'
import { mergeIntervals, type Interval } from '@/lib/timeAxis'
import type { Rng, Vec } from './generator'

/**
 * Demo behaviour of the players around their strokes: menu and tool events, and the head and hand tracking.
 * Shaped like what the game stores (schema version 2), so the timeline, tracking and replay screens have data.
 */

const TRACK_STEP_MS = 100
const PAD_MS = 3000
const DRAWING_CENTRE: Vec = [0, 1.25, -0.9]

// --- Events ---

export function buildEvents(lines: Line[], rng: Rng): DrawingEvent[] {
  const events: DrawingEvent[] = []
  const timed = lines
    .map((line) => ({ line, times: strokeTimes(line.points) }))
    .filter((entry): entry is { line: Line; times: { start: number; end: number } } => entry.times !== null)
    .sort((a, b) => a.times.start - b.times.start)
  if (timed.length === 0) return events

  const first = timed[0]
  const colorValue = (line: Line) => `start=${rgbToHex(line.startColor).toUpperCase()}FF end=${rgbToHex(line.endColor).toUpperCase()}FF`
  const add = (type: number, player: string, hand: 1 | -1, utcMs: number, value?: string) =>
    events.push({ type, playerID: player, hand, utcMs: Math.round(utcMs), value: value ?? null })

  // Opening the menu to pick the tool and the first colour
  const t0 = first.times.start
  add(0, first.line.userID, first.line.hand, t0 - 9000)
  add(2, first.line.userID, first.line.hand, t0 - 8200, 'Draw')
  add(3, first.line.userID, first.line.hand, t0 - 7400, colorValue(first.line))
  add(1, first.line.userID, first.line.hand, t0 - 6600)

  const lastColor = new Map<string, string>([[first.line.userID, rgbToHex(first.line.startColor)]])
  for (const { line, times } of timed.slice(1)) {
    const color = rgbToHex(line.startColor)
    const changedColor = lastColor.get(line.userID) !== color
    const changedWidth = rng() < 0.2
    if (changedColor || changedWidth) {
      add(0, line.userID, line.hand, times.start - 3200)
      if (changedColor) add(3, line.userID, line.hand, times.start - 2500, colorValue(line))
      if (changedWidth) add(4, line.userID, line.hand, times.start - 2000, `start=${line.startWidth.toFixed(4)} end=${line.endWidth.toFixed(4)}`)
      add(1, line.userID, line.hand, times.start - 1400)
    }
    lastColor.set(line.userID, color)
  }
  return events.sort((a, b) => a.utcMs - b.utcMs)
}

// --- Tracking ---

/** Rotation about Y by yaw, then about X by pitch (Unity: forward is (sin yaw, 0, cos yaw), positive pitch looks down). */
function quaternion(yaw: number, pitch: number): [number, number, number, number] {
  const [sy, cy, sx, cx] = [Math.sin(yaw / 2), Math.cos(yaw / 2), Math.sin(pitch / 2), Math.cos(pitch / 2)]
  return [cy * sx, sy * cx, -sy * sx, cy * cx]
}

function pose(position: Vec, rotation: [number, number, number, number], utcMs: number): Pose {
  return {
    pX: position[0], pY: position[1], pZ: position[2],
    rX: rotation[0], rY: rotation[1], rZ: rotation[2], rW: rotation[3],
    utcMs: Math.round(utcMs),
  }
}

/** The time windows during which tracking is recorded: every sitting, a little before and after the strokes. */
function windows(lines: Line[]): Interval[] {
  const intervals = lines.flatMap((line) => {
    const t = strokeTimes(line.points)
    return t ? [{ start: t.start - PAD_MS * 2, end: t.end + PAD_MS }] : []
  })
  return mergeIntervals(intervals)
}

function pointAt(line: Line, t: number): Vec | null {
  const p = line.points
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]]
    const ta = a.utcMs ?? 0
    const tb = b.utcMs ?? 0
    if (t >= ta && t <= tb) {
      const f = tb > ta ? (t - ta) / (tb - ta) : 0
      return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f]
    }
  }
  return null
}

/**
 * One tracked behaviour per author: the head walks about a little and looks at the drawing (now and then
 * elsewhere), the drawing hand follows its stroke, the other hand rests.
 * decimation N keeps only every Nth sample, like the server does when a document is too large.
 */
export function buildTracking(lines: Line[], authors: string[], rng: Rng, decimation = 1): TrackedBehavior[] {
  return authors.map((author, authorIndex) => {
    const own = lines.filter((line) => line.userID === author)
    const behavior: TrackedBehavior = { playerID: author, head: [], rightHand: [], leftHand: [], player: [] }
    const side = authorIndex === 0 ? 0 : 0.6 // a second player stands beside the first
    const phase = rng() * Math.PI * 2
    let lookAway = 0

    for (const window of windows(own.length ? own : lines)) {
      for (let t = window.start; t <= window.end; t += TRACK_STEP_MS) {
        const head: Vec = [side + 0.15 * Math.sin(t / 4000 + phase), 1.6 + 0.02 * Math.sin(t / 900), 0.1 * Math.cos(t / 5000 + phase)]
        // Looks at the drawing, sometimes away: a slow wander plus short glances to the side
        if (rng() < 0.01) lookAway = (rng() - 0.5) * 2.2
        lookAway *= 0.97
        const towards = Math.atan2(DRAWING_CENTRE[0] - head[0], DRAWING_CENTRE[2] - head[2])
        const yaw = towards + lookAway + 0.12 * Math.sin(t / 1500 + phase)
        const pitch = 0.18 + 0.05 * Math.sin(t / 2200)
        const rotation = quaternion(yaw, pitch)

        const active = own.find((line) => {
          const times = strokeTimes(line.points)
          return times !== null && t >= times.start && t <= times.end
        })
        const hand = (h: 1 | -1): Vec => {
          if (active && active.hand === h) {
            const at = pointAt(active, t)
            if (at) return at
          }
          return [side + 0.25 * h + 0.01 * Math.sin(t / 700), 1.1, -0.2]
        }

        behavior.head.push(pose(head, rotation, t))
        behavior.rightHand.push(pose(hand(1), [0, 0, 0, 1], t))
        behavior.leftHand.push(pose(hand(-1), [0, 0, 0, 1], t))
        behavior.player.push(pose([head[0], 0, head[2]], quaternion(yaw, 0), t))
      }
    }

    if (decimation > 1) {
      for (const channel of ['head', 'rightHand', 'leftHand', 'player'] as const) {
        behavior[channel] = behavior[channel].filter((_, i) => i % decimation === 0)
      }
    }
    return behavior
  })
}
