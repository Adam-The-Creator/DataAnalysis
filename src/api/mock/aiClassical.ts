import type {
  AiCohortRow, AiGroups, AiIndicator, AiIndicators, AiInsight, AiLabels, AiMap, AiStrokeGroup, Drawing, FuzzyLevel, MetricId,
} from '@/api/types'
import { rgbToHex } from '@/lib/colors'
import { computeLineStats, pointTime } from '@/lib/geometry'
import { buildTimeAxis } from '@/lib/timeAxis'
import ruleBaseJson from './fuzzyRules.json'

/**
 * STAND-IN for the classical parts of the server's AI module (DatabaseServer, ai/features.py, cohort_ml.py,
 * clustering.py, fuzzy.py, insights.py). It is a port, kept in step with them: the same definitions, break points and
 * edge cases. The real one is the reference. Two differences, both visible in the answers: the isolation forest (a second
 * opinion that needs scikit-learn) is not ported, and the DBSCAN here is a grid search instead of scikit-learn's.
 * The rule base is a JSON copy of ai/rules/fuzzy_rules.toml (made by reading it with the server's own loader).
 */

export type MetricRow = Partial<Record<MetricId, number | null>>

/** Rounds half up like the server's number(), and turns -0 into 0. */
const round = (value: number, digits: number) => Math.floor(value * 10 ** digits + 0.5) / 10 ** digits + 0

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// --- features.py ---

export const VECTOR_METRICS: MetricId[] = [
  'strokesDrawn', 'totalLength', 'meanStrokeLength', 'boundingVolume', 'heightRange', 'activeTime', 'meanSpeed',
  'directionalChange', 'leftHandShare', 'warmShare', 'distinctColours', 'eraseRatio',
]
const LOG_METRICS = new Set<MetricId>(['strokesDrawn', 'totalLength', 'meanStrokeLength', 'boundingVolume', 'activeTime', 'meanSpeed'])
/** The smallest spread that counts (see MIN_SCALE in ai/features.py): 0.1 on a log scale is a difference of 10 %. */
const MIN_SCALE: Record<string, number> = {
  strokesDrawn: 0.1, totalLength: 0.1, meanStrokeLength: 0.1, boundingVolume: 0.1, activeTime: 0.1,
  meanSpeed: 0.1, heightRange: 0.05, directionalChange: 0.01, leftHandShare: 5, warmShare: 5, eraseRatio: 5, distinctColours: 0.5,
}
export const Z_LIMIT = 3.5
const Z_CLIP = 6
const MIN_COVERAGE = 0.5
const NOTABLE_Z = 2.0
const NEIGHBOURS = 3

const transform = (metric: MetricId, value: number) => (LOG_METRICS.has(metric) ? Math.log1p(Math.max(value, 0)) : value)

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]
  const position = ((sorted.length - 1) * q) / 100
  const low = Math.floor(position)
  const high = Math.min(low + 1, sorted.length - 1)
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

/** [median, scale, tied]: the MAD / 0.6745, or 1.253314 times the mean deviation when the MAD is 0 (then tied is true). */
function robustScale(values: number[]): [number, number, boolean] {
  const centre = median(values)
  const deviations = values.map((v) => Math.abs(v - centre))
  const mad = median(deviations)
  if (mad > 0) return [centre, mad / 0.6745, false]
  const meanDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
  return [centre, meanDeviation > 0 ? meanDeviation / 1.253314 : 0, true]
}

const present = (row: MetricRow, metric: MetricId) => row[metric] != null

function usableMetrics(rows: MetricRow[]): MetricId[] {
  const needed = Math.max(2, Math.ceil(rows.length * MIN_COVERAGE))
  return VECTOR_METRICS.filter((metric) => {
    const values = rows.filter((r) => present(r, metric)).map((r) => transform(metric, r[metric] as number))
    return values.length >= needed && robustScale(values)[1] > 0
  })
}

function zMatrix(rows: MetricRow[]) {
  const metrics = usableMetrics(rows)
  const columns = metrics.map((metric) =>
    robustScale(rows.filter((r) => present(r, metric)).map((r) => transform(metric, r[metric] as number))))
  const z: number[][] = []
  const imputed: boolean[][] = []
  for (const row of rows) {
    z.push(metrics.map((metric, c) => {
      if (!present(row, metric)) return 0
      const [centre, scale] = columns[c]
      return Math.max(-Z_CLIP, Math.min(Z_CLIP, (transform(metric, row[metric] as number) - centre) / Math.max(scale, MIN_SCALE[metric])))
    }))
    imputed.push(metrics.map((metric) => !present(row, metric)))
  }
  return { metrics, z, imputed, tied: columns.map((c) => c[2]) }
}

// --- cohort_ml.py ---

/** Eigenvalues and eigenvectors (columns) of a small symmetric matrix by Jacobi rotations. */
function jacobi(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length
  const a = matrix.map((row) => [...row])
  const v: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2
    if (off < 1e-20) break
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: v }
}

function buildMap(z: number[][], ids: string[], metrics: MetricId[]): AiMap | null {
  if (ids.length < 4 || metrics.length < 2) return null
  const n = ids.length
  const p = metrics.length
  const mean = metrics.map((_, c) => z.reduce((sum, row) => sum + row[c], 0) / n)
  const centred = z.map((row) => row.map((value, c) => value - mean[c]))
  const covariance = metrics.map((_, i) => metrics.map((__, j) => centred.reduce((sum, row) => sum + row[i] * row[j], 0) / (n - 1)))
  const { values, vectors } = jacobi(covariance)
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a])
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0)
  const components = order.slice(0, 2).map((index) => {
    const component = Array.from({ length: p }, (_, r) => vectors[r][index])
    const strongest = component.reduce((best, value, r) => (Math.abs(value) > Math.abs(component[best]) ? r : best), 0)
    return component[strongest] >= 0 ? component : component.map((value) => -value)
  })
  const scores = centred.map((row) => components.map((component) => row.reduce((sum, value, c) => sum + value * component[c], 0)))
  return {
    points: ids.map((id, i) => ({ id, x: round(scores[i][0], 3), y: round(scores[i][1], 3) })),
    axes: components.map((component, axis) => ({
      explained: round(Math.max(values[order[axis]], 0) / total, 3),
      top: component.map((loading, r) => ({ r, loading })).sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading) || a.r - b.r)
        .slice(0, 3).map(({ r, loading }) => ({ metric: metrics[r], loading: round(loading, 3) })),
    })),
  }
}

export interface CohortAnalysis {
  cohortSize: number
  metrics: MetricId[]
  zLimit: number
  drawings: AiCohortRow[]
  map: AiMap | null
}

/** entries: the whole group. With a subjectId only that drawing's row is returned (the map always shows the group). */
export function analyzeCohort(entries: { id: string; metrics: MetricRow }[], subjectId?: string): CohortAnalysis {
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ids = sorted.map((e) => e.id)
  const { metrics, z, imputed, tied } = zMatrix(sorted.map((e) => e.metrics))
  const rows: AiCohortRow[] = []
  sorted.forEach((entry, index) => {
    if (subjectId !== undefined && entry.id !== subjectId) return
    const found = metrics.flatMap((metric, c) => {
      const value = z[index][c]
      if (imputed[index][c] || Math.abs(value) < NOTABLE_Z) return []
      return [{
        metric, z: round(value, 2), value: entry.metrics[metric] ?? null, direction: (value > 0 ? 'high' : 'low') as 'high' | 'low',
        beyondLimit: Math.abs(value) >= Z_LIMIT && !tied[c],
      }]
    }).sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || (a.metric < b.metric ? -1 : a.metric > b.metric ? 1 : 0))
    const peers = sorted.flatMap((other, o) => {
      if (o === index) return []
      return [{ d: Math.sqrt(z[index].reduce((sum, value, c) => sum + (value - z[o][c]) ** 2, 0)), id: other.id }]
    }).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    rows.push({
      id: entry.id,
      maxAbsZ: round(Math.max(0, ...found.map((f) => Math.abs(f.z))), 2),
      atypical: found.some((f) => f.beyondLimit),
      notable: found.slice(0, 3),
      isolation: null, // the second opinion of the isolation forest needs scikit-learn (server only)
      similar: peers.slice(0, NEIGHBOURS).map((p) => ({ id: p.id, distance: round(p.d, 3), similarity: round(1 / (1 + p.d), 3) })),
    })
  })
  return { cohortSize: sorted.length, metrics, zLimit: Z_LIMIT, drawings: rows, map: buildMap(z, ids, metrics) }
}

// --- clustering.py ---

const SPACING = 0.02
const MIN_POINTS = 3
const MAX_GROUPS = 60

function resample(points: { x: number; y: number; z: number }[]): number[] {
  if (points.length === 0) return []
  const keep = [0]
  let last = points[0]
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    if (Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) >= SPACING) {
      keep.push(i)
      last = p
    }
  }
  if (points.length > 1) keep.push(points.length - 1)
  return keep
}

/** DBSCAN with the Chebyshev distance (a neighbour is within eps on every axis), found through a grid of cells of size eps. */
function dbscan(points: number[][], eps: number, minSamples: number): number[] {
  const dims = points[0]?.length ?? 0
  const cell = (p: number[]) => p.map((v) => Math.floor(v / eps))
  const grid = new Map<string, number[]>()
  points.forEach((p, i) => {
    const key = cell(p).join(',')
    grid.set(key, [...(grid.get(key) ?? []), i])
  })
  const offsets: number[][] = [[]]
  for (let d = 0; d < dims; d++) offsets.splice(0, offsets.length, ...offsets.flatMap((o) => [-1, 0, 1].map((x) => [...o, x])))
  const neighbours = (i: number): number[] => {
    const base = cell(points[i])
    const found: number[] = []
    for (const offset of offsets) {
      for (const j of grid.get(base.map((c, d) => c + offset[d]).join(',')) ?? []) {
        if (points[j].every((v, d) => Math.abs(v - points[i][d]) <= eps)) found.push(j)
      }
    }
    return found.sort((a, b) => a - b)
  }
  const labels = points.map(() => -1)
  const visited = points.map(() => false)
  let cluster = 0
  for (let i = 0; i < points.length; i++) {
    if (visited[i]) continue
    visited[i] = true
    const around = neighbours(i)
    if (around.length < minSamples) continue
    labels[i] = cluster
    const queue = [...around]
    while (queue.length) {
      const j = queue.shift()!
      if (labels[j] === -1) labels[j] = cluster
      if (visited[j]) continue
      visited[j] = true
      const next = neighbours(j)
      if (next.length >= minSamples) queue.push(...next)
    }
    cluster++
  }
  return labels
}

export function clusterStrokes(drawing: Drawing, spaceEps = 0.1, timeEps = 20): AiGroups {
  const lines = drawing.lines.filter((l) => l.status === 1 && l.points.length > 0)
  const axis = buildTimeAxis(drawing)
  const coords: number[][] = []
  const owner: number[] = []
  const times: number[] = []
  let timed = true
  lines.forEach((line, index) => {
    for (const i of resample(line.points)) {
      const p = line.points[i]
      const moment = pointTime(p)
      if (moment == null) timed = false
      else times.push(axis.map(moment) / 1000)
      coords.push([p.x, p.y, p.z])
      owner.push(index)
    }
  })
  const matrix = timed ? coords.map((c, i) => [...c, (times[i] / timeEps) * spaceEps]) : coords
  const labels = coords.length ? dbscan(matrix, spaceEps, MIN_POINTS) : []

  const parent = lines.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const firstInCluster = new Map<number, number>()
  const clustered = new Set<number>()
  labels.forEach((label, p) => {
    if (label < 0) return
    const stroke = owner[p]
    clustered.add(stroke)
    const first = firstInCluster.get(label)
    if (first !== undefined) parent[find(stroke)] = find(first)
    else firstInCluster.set(label, stroke)
  })
  const members = new Map<number, number[]>()
  for (const stroke of [...clustered].sort((a, b) => a - b)) {
    const root = find(stroke)
    members.set(root, [...(members.get(root) ?? []), stroke])
  }

  const stats = lines.map((l) => l.stats ?? computeLineStats(l.points))
  const totalInk = stats.reduce((sum, s) => sum + s.length, 0)
  const groups: Omit<AiStrokeGroup, 'id'>[] = [...members.values()].map((indices) => {
    const own = indices.map((i) => stats[i])
    const ink = own.reduce((sum, s) => sum + s.length, 0)
    const low = [Math.min(...own.map((s) => s.boundsMinX)), Math.min(...own.map((s) => s.boundsMinY)), Math.min(...own.map((s) => s.boundsMinZ))]
    const high = [Math.max(...own.map((s) => s.boundsMaxX)), Math.max(...own.map((s) => s.boundsMaxY)), Math.max(...own.map((s) => s.boundsMaxZ))]
    const spans = indices.flatMap((i) => {
      const start = pointTime(lines[i].points[0])
      const end = pointTime(lines[i].points[lines[i].points.length - 1])
      return start != null && end != null ? [[axis.map(start), axis.map(end)]] : []
    })
    const bins = new Map<string, { hex: string; ink: number }>()
    for (const i of indices) {
      const c = lines[i].startColor
      const key = `${c.r >> 5},${c.g >> 5},${c.b >> 5}`
      const bin = bins.get(key) ?? { hex: rgbToHex(c), ink: 0 }
      bin.ink += stats[i].length
      bins.set(key, bin)
    }
    return {
      strokeIds: indices.map((i) => lines[i].id),
      strokeCount: indices.length,
      authors: [...new Set(indices.map((i) => lines[i].userID).filter(Boolean))].sort(),
      length: round(ink, 4),
      inkShare: totalInk > 0 ? round(ink / totalInk, 3) : 0,
      boundsMin: low.map((v) => round(v, 3)),
      boundsMax: high.map((v) => round(v, 3)),
      size: low.map((l, d) => round(high[d] - l, 3)),
      centre: low.map((l, d) => round((l + high[d]) / 2, 3)),
      colours: [...bins.values()].sort((a, b) => b.ink - a.ink).slice(0, 3)
        .map((b) => ({ hex: b.hex, share: ink > 0 ? round(b.ink / ink, 3) : 0 })),
      startMs: spans.length ? Math.min(...spans.map((s) => s[0])) : null,
      endMs: spans.length ? Math.max(...spans.map((s) => s[1])) : null,
    }
  })
  groups.sort((a, b) => b.length - a.length || (a.strokeIds[0] ?? '').localeCompare(b.strokeIds[0] ?? ''))
  return {
    strokeCount: lines.length,
    groups: groups.slice(0, MAX_GROUPS).map((g, i) => ({ ...g, id: `g${i + 1}` })),
    unclustered: lines.filter((_, i) => !clustered.has(i)).map((l) => l.id),
    timeUsed: timed && coords.length > 0,
    truncated: groups.length > MAX_GROUPS,
  }
}

// --- fuzzy.py ---

const LEVELS: FuzzyLevel[] = ['low', 'medium', 'high']

export interface RuleBase {
  name: string
  version: string
  status: 'proposal' | 'reviewed'
  reviewed: string
  description: string
  fallbackRanges: Record<string, number[]>
  indicators: {
    id: string
    name: string
    rationale: string
    levels: Record<FuzzyLevel, string>
    rules: { id: string; if: string; then: FuzzyLevel; weight: number; rationale: string }[]
  }[]
}

export const ruleBase = ruleBaseJson as RuleBase

type Term = [metric: MetricId, level: FuzzyLevel, negated: boolean]

function parseCondition(text: string): Term[][] {
  return text.trim().split(/\s+or\s+/i).map((branch) =>
    branch.trim().split(/\s+and\s+/i).map((term): Term => {
      const match = /^([A-Za-z][A-Za-z0-9]*)\s+is\s+(not\s+)?(low|medium|high)$/i.exec(term.trim())
      if (!match) throw new Error(`cannot read "${term.trim()}"`)
      return [match[1] as MetricId, match[3].toLowerCase() as FuzzyLevel, !!match[2]]
    }))
}

function membershipDegrees(x: number, a: number, b: number, c: number): Record<FuzzyLevel, number> {
  const low = x <= a ? 1 : x < b ? (b - x) / (b - a) : 0
  const high = x >= c ? 1 : x > b ? (x - b) / (c - b) : 0
  const medium = x <= a || x >= c ? 0 : x < b ? (x - a) / (b - a) : (c - x) / (c - b)
  return { low, medium, high }
}

function breaks(metric: MetricId, cohortValues: number[], base: RuleBase, minCohort: number): [[number, number, number], 'cohort' | 'fixed'] | null {
  if (cohortValues.length >= minCohort) {
    const sorted = [...cohortValues].sort((a, b) => a - b)
    const [a, b, c] = [10, 50, 90].map((q) => percentile(sorted, q))
    if (a < b && b < c) return [[a, b, c], 'cohort']
  }
  const fixed = base.fallbackRanges[metric]
  return fixed ? [[fixed[0], fixed[1], fixed[2]], 'fixed'] : null
}

export function evaluateIndicators(subject: MetricRow, cohort: MetricRow[], minCohort: number, base: RuleBase = ruleBase): Omit<AiIndicators, 'ruleBase'> {
  const cache = new Map<MetricId, { value: number; basis: 'cohort' | 'fixed'; degrees: Record<FuzzyLevel, number> } | null>()
  const setsOf = (metric: MetricId) => {
    if (!cache.has(metric)) {
      const value = subject[metric]
      let found = null
      if (value != null) {
        const cohortValues = cohort.filter((c) => c[metric] != null).map((c) => c[metric] as number)
        const b = breaks(metric, cohortValues, base, minCohort)
        if (b) found = { value, basis: b[1], degrees: membershipDegrees(value, ...b[0]) }
      }
      cache.set(metric, found)
    }
    return cache.get(metric) ?? null
  }

  const results: AiIndicator[] = base.indicators.map((indicator) => {
    const degrees: Record<FuzzyLevel, number> = { low: 0, medium: 0, high: 0 }
    const fired: AiIndicator['fired'] = []
    const skipped: AiIndicator['skipped'] = []
    const used: MetricId[] = []
    for (const rule of indicator.rules) {
      let best: number | null = null
      const missing: MetricId[] = []
      for (const branch of parseCondition(rule.if)) {
        const terms: number[] = []
        let complete = true
        for (const [metric, level, negated] of branch) {
          if (!used.includes(metric)) used.push(metric)
          const found = setsOf(metric)
          if (!found) {
            missing.push(metric)
            complete = false
            break
          }
          terms.push(negated ? 1 - found.degrees[level] : found.degrees[level])
        }
        if (complete) {
          const strength = Math.min(...terms)
          best = best === null ? strength : Math.max(best, strength)
        }
      }
      if (best === null) {
        skipped.push({ rule: rule.id, missing: [...new Set(missing)].sort() })
        continue
      }
      const contribution = best * rule.weight
      if (contribution > 0) {
        fired.push({ rule: rule.id, if: rule.if, then: rule.then, weight: rule.weight, strength: round(best, 3), rationale: rule.rationale })
        degrees[rule.then] = Math.max(degrees[rule.then], contribution)
      }
    }
    const top = Math.max(...Object.values(degrees))
    const level = top > 0 ? LEVELS.find((l) => degrees[l] === top) ?? null : null
    fired.sort((a, b) => b.strength - a.strength || (a.rule < b.rule ? -1 : 1))
    return {
      id: indicator.id, name: indicator.name, rationale: indicator.rationale,
      level, text: level ? indicator.levels[level] : null, degree: round(top, 3),
      degrees: { low: round(degrees.low, 3), medium: round(degrees.medium, 3), high: round(degrees.high, 3) },
      inputs: used.map((metric) => {
        const sets = setsOf(metric)
        return {
          metric, value: sets?.value ?? subject[metric] ?? null, basis: sets?.basis ?? null,
          sets: sets ? { low: round(sets.degrees.low, 3), medium: round(sets.degrees.medium, 3), high: round(sets.degrees.high, 3) } : null,
        }
      }),
      fired, skipped,
    }
  })
  const bases = new Set(results.flatMap((r) => r.inputs.map((i) => i.basis).filter(Boolean)))
  return {
    cohortSize: cohort.length,
    basis: bases.size === 1 && bases.has('cohort') ? 'cohort' : bases.size === 1 && bases.has('fixed') ? 'fixed' : 'mixed',
    indicators: results,
  }
}

// --- insights.py ---

export interface InsightDrawing {
  id: string
  playerId: string
  indicators: AiIndicator[]
  labels: AiLabels | null
  atypical: boolean | null
}

export function aggregateInsights(drawings: InsightDrawing[]): AiInsight[] {
  const insights: AiInsight[] = []

  const recurring = new Map<string, Extract<AiInsight, { kind: 'recurringLabel' }>>()
  for (const drawing of drawings) {
    if (!drawing.labels) continue
    const found = new Map<string, string>()
    for (const verdict of [drawing.labels.whole, ...drawing.labels.groups]) {
      if (!verdict.unspecific && !verdict.top[0].other) found.set(verdict.top[0].label, verdict.top[0].name)
    }
    for (const [label, name] of found) {
      const entry = recurring.get(label) ?? { kind: 'recurringLabel' as const, label, name, drawings: 0, participants: 0, drawingIds: [], playerIds: [] }
      entry.drawingIds.push(drawing.id)
      if (!entry.playerIds.includes(drawing.playerId)) entry.playerIds.push(drawing.playerId)
      recurring.set(label, entry)
    }
  }
  const sortedRecurring = [...recurring.values()].sort((a, b) => b.drawingIds.length - a.drawingIds.length || (a.label < b.label ? -1 : 1))
  for (const entry of sortedRecurring) {
    if (entry.drawingIds.length >= 2) insights.push({ ...entry, drawings: entry.drawingIds.length, participants: entry.playerIds.length })
  }

  const byIndicator = new Map<string, Extract<AiInsight, { kind: 'indicatorLevels' }>>()
  for (const drawing of drawings) {
    for (const indicator of drawing.indicators) {
      if (!indicator.level) continue
      const entry = byIndicator.get(indicator.id) ?? {
        kind: 'indicatorLevels' as const, indicator: indicator.id, name: indicator.name,
        counts: { low: 0, medium: 0, high: 0 }, drawingIds: { low: [], medium: [], high: [] }, total: 0, common: null,
      }
      entry.counts[indicator.level]++
      entry.drawingIds[indicator.level].push(drawing.id)
      byIndicator.set(indicator.id, entry)
    }
  }
  for (const entry of byIndicator.values()) {
    entry.total = LEVELS.reduce((sum, level) => sum + entry.counts[level], 0)
    const top = LEVELS.reduce((best, level) => (entry.counts[level] > entry.counts[best] ? level : best), LEVELS[0])
    entry.common = entry.total >= 3 && entry.counts[top] / entry.total >= 0.6 ? top : null
    insights.push(entry)
  }

  const atypical = drawings.filter((d) => d.atypical).map((d) => d.id)
  if (atypical.length) insights.push({ kind: 'atypical', drawingIds: atypical, drawings: atypical.length })
  return insights
}
