import type {
  AuthorContribution, CohortFilters, CohortResult, CohortRow, Drawing, HeatmapData, HistoryRow, MetricId,
  MultiplayerData, Pose, ProximityPair, Session, TimelineData, TimelineItem, TrackedPlayer, TrackingData, TrackSample,
} from '@/api/types'
import { legacyOffsetMs, legacyTimestampMs, strokeTimes } from '@/lib/geometry'
import { metricCatalog } from '@/lib/metricCatalog'
import {
  buildTimeAxis, idlePeriods, IDLE_GAP_SECONDS, mergeIntervals, type Interval,
} from '@/lib/timeAxis'
import { analyzeDrawing, metricValues } from './analysisEngine'

/**
 * STAND-INS for the analyses of the DatabaseServer's analysis module (analysis/timeline.py, tracking.py, heatmap.py,
 * multiplayer.py, cohort.py), so the demo mode can show every P2 screen. They are ports of the real code: the same
 * definitions and edge cases. The real implementation is the reference.
 */

const round = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits + 0

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// --- Timeline (DRW-07) ---

const EVENT_KINDS = ['menuOpen', 'menuClose', 'modeChange', 'colorChange', 'widthChange'] as const

export function buildTimeline(drawing: Drawing, idleGapSeconds = IDLE_GAP_SECONDS): TimelineData {
  const axis = buildTimeAxis(drawing)
  const offset = legacyOffsetMs(drawing.lines)
  const items: TimelineItem[] = []
  let end = 0

  for (const line of drawing.lines) {
    const times = strokeTimes(line.points)
    if (times) {
      items.push({ kind: 'stroke', lineId: line.id, authorId: line.userID, hand: line.hand, startMs: axis.map(times.start), endMs: axis.map(times.end), erased: line.status !== 1 })
      end = Math.max(end, axis.map(times.end))
    }
    for (const event of line.history) {
      const kind = event.eventType === 0 ? 'erase' : event.eventType === 2 ? 'undo' : null
      const legacy = legacyTimestampMs(event.timestamp)
      if (kind && legacy != null) {
        const at = axis.map(legacy + (offset ?? 0))
        items.push({ kind, lineId: line.id, authorId: event.invoker, hand: event.hand, atMs: at })
        end = Math.max(end, at)
      }
    }
  }
  for (const event of drawing.events ?? []) {
    const kind = EVENT_KINDS[event.type]
    if (kind) {
      const at = axis.map(event.utcMs)
      items.push({ kind, playerId: event.playerID, hand: event.hand, atMs: at, value: event.value ?? null })
      end = Math.max(end, at)
    }
  }

  const drawnTimes: Interval[] = drawing.lines
    .filter((l) => l.status === 1)
    .flatMap((l) => { const t = strokeTimes(l.points); return t ? [{ start: t.start, end: t.end }] : [] })
  const pauses = idlePeriods(drawnTimes, idleGapSeconds * 1000)
  for (const p of pauses) items.push({ kind: 'idle', startMs: axis.map(p.start), endMs: axis.map(p.end) })

  const at = (item: TimelineItem) => ('startMs' in item ? item.startMs : item.atMs)
  items.sort((a, b) => at(a) - at(b))
  const count = (...kinds: string[]) => items.filter((i) => kinds.includes(i.kind)).length

  return {
    drawingId: drawing.metadata.id,
    originMs: axis.origin,
    timeBase: drawing.lines.some((l) => l.points.some((p) => p.utcMs != null)) ? 'utc' : 'legacy',
    breaks: axis.breakMarks(),
    durationMs: end,
    hasTimeData: drawnTimes.length > 0,
    idleGapSeconds,
    items,
    summary: {
      strokes: items.filter((i) => i.kind === 'stroke' && !i.erased).length,
      erasedStrokes: items.filter((i) => i.kind === 'stroke' && i.erased).length,
      erases: count('erase'),
      undos: count('undo'),
      menuOpens: count('menuOpen'),
      toolChanges: count('modeChange', 'colorChange', 'widthChange'),
      idlePeriods: pauses.length,
      idleSeconds: pauses.reduce((s, p) => s + p.end - p.start, 0) / 1000,
    },
  }
}

// --- Tracking (DRW-08) ---

const YAW_BINS = 12
const EXPLORED_CELL = 0.25

function forward(pose: Pose): [number, number, number] {
  const { rX: x, rY: y, rZ: z, rW: w } = pose
  return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)]
}

const poseTime = (pose: Pose) => pose.utcMs ?? legacyTimestampMs(pose.timestamp)

const travelled = (poses: Pose[]) =>
  poses.slice(1).reduce((s, p, i) => s + Math.hypot(p.pX - poses[i].pX, p.pY - poses[i].pY, p.pZ - poses[i].pZ), 0)

export function summarizeTracking(drawing: Drawing, maxPoints = 400): TrackingData {
  const axis = buildTimeAxis(drawing)
  const decimation = drawing.metadata.trackingDecimation ?? 1
  const behaviors = (drawing.trackedBehaviors ?? []).filter((b) => b.head.length + b.rightHand.length + b.leftHand.length + b.player.length > 0)

  const path = (poses: Pose[], withForward: boolean): TrackSample[] => {
    if (!poses.length) return []
    const step = Math.max(1, Math.ceil(poses.length / maxPoints))
    const sampled = poses.filter((_, i) => i % step === 0)
    if (sampled[sampled.length - 1] !== poses[poses.length - 1]) sampled.push(poses[poses.length - 1])
    return sampled.map((p) => {
      const t = poseTime(p)
      const row: TrackSample = [t == null ? null : axis.map(t), round(p.pX), round(p.pY), round(p.pZ)]
      if (withForward) row.push(...forward(p).map((c) => round(c, 3)))
      return row
    })
  }

  const players: TrackedPlayer[] = behaviors.map((b) => {
    const times = b.head.map(poseTime).filter((t): t is number => t != null)
    let headDirection: TrackedPlayer['headDirection'] = null
    if (b.head.length) {
      let sx = 0, sy = 0, sz = 0
      const bins = new Array<number>(YAW_BINS).fill(0)
      for (const pose of b.head) {
        const [fx, fy, fz] = forward(pose)
        const norm = Math.hypot(fx, fy, fz) || 1
        sx += fx / norm; sy += fy / norm; sz += fz / norm
        const yaw = ((Math.atan2(fx, fz) * 180) / Math.PI + 360) % 360
        bins[Math.floor(yaw / (360 / YAW_BINS)) % YAW_BINS]++
      }
      const mean = Math.hypot(sx, sy, sz) || 1
      const shares = bins.map((c) => c / b.head.length)
      headDirection = {
        meanYawDeg: round((((Math.atan2(sx / mean, sz / mean) * 180) / Math.PI) + 360) % 360, 1),
        meanPitchDeg: round((Math.asin(Math.max(-1, Math.min(1, sy / mean))) * 180) / Math.PI, 1),
        yawShares: shares.map((s) => round(s, 3)),
        yawCoverage: shares.filter((s) => s >= 0.05).length,
      }
    }
    const cells = new Set(b.head.map((p) => `${Math.floor(p.pX / EXPLORED_CELL)},${Math.floor(p.pZ / EXPLORED_CELL)}`))
    const heights = b.head.map((p) => p.pY)
    return {
      playerId: b.playerID,
      samples: { head: b.head.length, rightHand: b.rightHand.length, leftHand: b.leftHand.length, player: b.player.length },
      durationMs: times.length > 1 ? Math.max(...times) - Math.min(...times) : null,
      movement: { head: round(travelled(b.head), 2), rightHand: round(travelled(b.rightHand), 2), leftHand: round(travelled(b.leftHand), 2), player: round(travelled(b.player), 2) },
      headDirection,
      explored: b.head.length ? { areaM2: round(cells.size * EXPLORED_CELL ** 2, 2), headHeightMin: round(Math.min(...heights), 2), headHeightMax: round(Math.max(...heights), 2) } : null,
      paths: { head: path(b.head, true), rightHand: path(b.rightHand, false), leftHand: path(b.leftHand, false) },
    }
  })

  return {
    drawingId: drawing.metadata.id,
    available: players.length > 0,
    originMs: axis.origin,
    approximate: decimation > 1,
    decimation: decimation > 1 ? decimation : null,
    players,
  }
}

// --- Heatmap (DRW-06) ---

const MAX_CELLS = 40_000

function accumulate(drawing: Drawing, voxel: number): { cells: Map<string, number>; total: number } {
  const cells = new Map<string, number>()
  let total = 0
  for (const line of drawing.lines) {
    if (line.status !== 1) continue
    for (let i = 1; i < line.points.length; i++) {
      const a = line.points[i - 1]
      const b = line.points[i]
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      if (length === 0) continue
      total += length
      const samples = Math.max(1, Math.ceil(length / (voxel / 2)))
      for (let s = 0; s < samples; s++) {
        const f = (s + 0.5) / samples
        const key = [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f].map((v) => Math.floor(v / voxel)).join(',')
        cells.set(key, (cells.get(key) ?? 0) + length / samples)
      }
    }
  }
  return { cells, total }
}

export function buildHeatmap(drawing: Drawing, voxelSize = 0.05): HeatmapData {
  let voxel = Math.max(voxelSize, 0.005)
  let { cells, total } = accumulate(drawing, voxel)
  while (cells.size > MAX_CELLS) {
    voxel *= 2
    ;({ cells, total } = accumulate(drawing, voxel))
  }
  const figure = drawing.metadata.sadChildCoordinates
  if (cells.size === 0) {
    return { drawingId: drawing.metadata.id, voxelSize: voxel, origin: [0, 0, 0], dims: [0, 0, 0], cells: [], maxWeight: 0, totalInk: 0, figure: null }
  }
  const keys = [...cells.entries()].map(([key, w]) => ({ index: key.split(',').map(Number), w }))
  const mins = [0, 1, 2].map((axis) => Math.min(...keys.map((k) => k.index[axis])))
  const maxs = [0, 1, 2].map((axis) => Math.max(...keys.map((k) => k.index[axis])))
  const rows = keys
    .map((k): HeatmapData['cells'][number] => [k.index[0] - mins[0], k.index[1] - mins[1], k.index[2] - mins[2], round(k.w)])
    .sort((a, b) => b[3] - a[3])
  return {
    drawingId: drawing.metadata.id,
    voxelSize: round(voxel, 4),
    origin: [round(mins[0] * voxel), round(mins[1] * voxel), round(mins[2] * voxel)],
    dims: [maxs[0] - mins[0] + 1, maxs[1] - mins[1] + 1, maxs[2] - mins[2] + 1],
    cells: rows,
    maxWeight: rows[0][3],
    totalInk: round(total),
    figure: figure ? { x: figure.x, y: figure.y, z: figure.z } : null,
  }
}

// --- Multiplayer (MUL-01..03) ---

type TaggedPoint = [number, number, number, string]

function near(source: TaggedPoint[], target: TaggedPoint[], radius: number): { share: number; touching: Set<string> } {
  const cell = (p: TaggedPoint) => [Math.floor(p[0] / radius), Math.floor(p[1] / radius), Math.floor(p[2] / radius)]
  const grid = new Map<string, TaggedPoint[]>()
  for (const q of target) {
    const key = cell(q).join(',')
    grid.set(key, [...(grid.get(key) ?? []), q])
  }
  const touching = new Set<string>()
  let count = 0
  for (const p of source) {
    const [cx, cy, cz] = cell(p)
    let found = false
    for (let dx = -1; dx <= 1 && !found; dx++) {
      for (let dy = -1; dy <= 1 && !found; dy++) {
        for (let dz = -1; dz <= 1 && !found; dz++) {
          found = (grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []).some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= radius)
        }
      }
    }
    if (found) {
      count++
      touching.add(p[3])
    }
  }
  return { share: source.length ? count / source.length : 0, touching }
}

function minDistance(a: TaggedPoint[], b: TaggedPoint[]): number | null {
  if (!a.length || !b.length) return null
  const sa = a.filter((_, i) => i % Math.max(1, Math.floor(a.length / 400)) === 0)
  const sb = b.filter((_, i) => i % Math.max(1, Math.floor(b.length / 400)) === 0)
  let best = Infinity
  for (const p of sa) for (const q of sb) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
  return best
}

function simultaneousMs(intervals: { start: number; end: number; author: string }[]): number {
  const events = [
    ...intervals.map((i) => ({ at: i.start, change: 1, author: i.author })),
    ...intervals.map((i) => ({ at: i.end, change: -1, author: i.author })),
  ].sort((a, b) => a.at - b.at || a.change - b.change)
  const active = new Map<string, number>()
  let total = 0
  let last = 0
  for (const e of events) {
    if ([...active.values()].filter((c) => c > 0).length >= 2) total += e.at - last
    active.set(e.author, (active.get(e.author) ?? 0) + e.change)
    last = e.at
  }
  return total
}

export function analyzeMultiplayer(drawing: Drawing, proximity = 0.05, turnGapSeconds = 5): MultiplayerData {
  const axis = buildTimeAxis(drawing)
  const authors = [...new Set(drawing.lines.map((l) => l.userID))]
  const drawn = drawing.lines.filter((l) => l.status === 1)
  const length = (l: Drawing['lines'][number]) => l.stats?.length ?? 0
  const totalInk = drawn.reduce((s, l) => s + length(l), 0) || 1

  const contributions: AuthorContribution[] = authors.map((author) => {
    const own = drawn.filter((l) => l.userID === author)
    const times = own.flatMap((l) => { const t = strokeTimes(l.points); return t ? [{ start: t.start, end: t.end }] : [] })
    const ink = own.reduce((s, l) => s + length(l), 0)
    return {
      playerId: author,
      strokes: own.length,
      erasedStrokes: drawing.lines.filter((l) => l.userID === author).length - own.length,
      inkLength: round(ink),
      inkShare: round(ink / totalInk),
      drawingMs: times.length ? mergeIntervals(times).reduce((s, t) => s + t.end - t.start, 0) : null,
      firstMs: times.length ? axis.map(Math.min(...times.map((t) => t.start))) : null,
      lastMs: times.length ? axis.map(Math.max(...times.map((t) => t.end))) : null,
    }
  })

  const points = new Map<string, TaggedPoint[]>()
  for (const line of drawn) {
    for (const p of line.points) points.set(line.userID, [...(points.get(line.userID) ?? []), [p.x, p.y, p.z, line.id]])
  }
  const withPoints = authors.filter((a) => points.has(a))
  const pairs: ProximityPair[] = []
  for (let i = 0; i < withPoints.length; i++) {
    for (let j = i + 1; j < withPoints.length; j++) {
      const [a, b] = [withPoints[i], withPoints[j]]
      const ab = near(points.get(a)!, points.get(b)!, proximity)
      const ba = near(points.get(b)!, points.get(a)!, proximity)
      const closest = minDistance(points.get(a)!, points.get(b)!)
      pairs.push({
        a, b, aNearB: round(ab.share), bNearA: round(ba.share), touchingStrokesA: ab.touching.size, touchingStrokesB: ba.touching.size,
        minDistance: closest == null ? null : round(closest),
      })
    }
  }

  const strokes = drawn
    .flatMap((l) => { const t = strokeTimes(l.points); return t ? [{ start: t.start, end: t.end, author: l.userID }] : [] })
    .sort((a, b) => a.start - b.start)
  const absolute: { playerId: string; start: number; end: number }[] = []
  for (const s of strokes) {
    const last = absolute[absolute.length - 1]
    if (last && last.playerId === s.author && s.start - last.end <= turnGapSeconds * 1000) last.end = Math.max(last.end, s.end)
    else absolute.push({ playerId: s.author, start: s.start, end: s.end })
  }
  const blocks = absolute.map((b) => ({ playerId: b.playerId, startMs: axis.map(b.start), endMs: axis.map(b.end) }))
  const activeMs = mergeIntervals(strokes).reduce((s, t) => s + t.end - t.start, 0)
  const simultaneous = simultaneousMs(strokes)

  return {
    drawingId: drawing.metadata.id,
    multiAuthor: authors.length > 1,
    authors: contributions,
    proximity: { radius: proximity, pairs },
    turns: {
      gapSeconds: turnGapSeconds,
      blocks,
      switches: blocks.slice(1).filter((b, i) => b.playerId !== blocks[i].playerId).length,
      simultaneousMs: simultaneous,
      simultaneousShare: activeMs ? round(simultaneous / activeMs) : 0,
    },
  }
}

// --- Cohort (CMP-03) and history (PAR-01) ---

const MIN_COHORT = 3

export function percentileRank(values: number[], value: number): number {
  const below = values.filter((v) => v < value).length
  const equal = values.filter((v) => v === value).length
  return ((below + equal / 2) / values.length) * 100
}

export function compareWithCohort(
  drawingId: string, filters: CohortFilters, subject: Record<MetricId, number | null>, cohort: Record<MetricId, number | null>[],
): CohortResult {
  const metrics: CohortRow[] = metricCatalog.map((def) => {
    const values = cohort.map((m) => m[def.id]).filter((v): v is number => v != null)
    const mine = subject[def.id]
    const enough = mine != null && values.length >= MIN_COHORT
    return {
      id: def.id, value: mine, cohortSize: values.length,
      percentile: enough ? round(percentileRank(values, mine), 1) : null,
      min: values.length ? Math.min(...values) : null,
      median: values.length ? median(values) : null,
      max: values.length ? Math.max(...values) : null,
    }
  })
  return { drawingId, filters, cohortSize: cohort.length, sufficient: cohort.length >= MIN_COHORT, metrics }
}

export function historyRow(drawing: Drawing, meta: HistoryRow['meta'], sessions: Session[]): HistoryRow {
  const analysis = analyzeDrawing(drawing)
  return {
    meta,
    sessionName: sessions.find((s) => s.id === meta.sessionID)?.name ?? meta.sessionID,
    date: drawing.metadata.date,
    metrics: metricValues(analysis),
    flags: analysis.flags,
  }
}
