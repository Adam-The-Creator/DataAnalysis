import type {
  Drawing, DrawingAnalysis, Line, MetricDistribution, MetricId, MetricValue, PaletteEntry, ParticipantRow,
  QualityFlagId, SessionStats, UnavailableReason,
} from '@/api/types'
import { hueOf, isWarmHue, rgbToHex } from '@/lib/colors'
import { computeLineStats, strokeTimes } from '@/lib/geometry'
import { metricCatalog } from '@/lib/metricCatalog'

/**
 * STAND-IN for the server side analysis module (requirements MET-01..08, TEC-02). It lets the demo mode show real
 * numbers that match the 3D view. It is NOT the real implementation: the real one runs in the DatabaseServer
 * (Python), and the metric definitions still have to be reviewed (MET-03).
 */

export const ANALYZER_VERSION = 'demo-0.1'

const value = (id: MetricId, v: number): MetricValue => ({ id, value: v })
const missing = (id: MetricId, reason: UnavailableReason): MetricValue => ({ id, value: null, unavailableReason: reason })

const statsOf = (line: Line) => line.stats ?? computeLineStats(line.points)

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function analyzeDrawing(drawing: Drawing): DrawingAnalysis {
  const drawn = drawing.lines.filter((line) => line.status === 1)
  const erased = drawing.lines.length - drawn.length
  const metrics: MetricValue[] = []
  const none = drawn.length === 0

  metrics.push(value('strokesDrawn', drawn.length), value('strokesErased', erased))
  metrics.push(value('eraseRatio', drawing.lines.length ? (erased / drawing.lines.length) * 100 : 0))

  const stats = drawn.map(statsOf)
  const totalLength = stats.reduce((sum, s) => sum + s.length, 0)
  metrics.push(value('pointCount', stats.reduce((sum, s) => sum + s.pointCount, 0)))
  metrics.push(none ? missing('totalLength', 'noStrokes') : value('totalLength', totalLength))
  metrics.push(none ? missing('meanStrokeLength', 'noStrokes') : value('meanStrokeLength', totalLength / drawn.length))

  // Space
  if (none) {
    metrics.push(missing('boundingVolume', 'noStrokes'), missing('heightRange', 'noStrokes'))
  } else {
    const span = (min: number[], max: number[]) => Math.max(...max) - Math.min(...min)
    const dx = span(stats.map((s) => s.boundsMinX), stats.map((s) => s.boundsMaxX))
    const dy = span(stats.map((s) => s.boundsMinY), stats.map((s) => s.boundsMaxY))
    const dz = span(stats.map((s) => s.boundsMinZ), stats.map((s) => s.boundsMaxZ))
    metrics.push(value('boundingVolume', dx * dy * dz), value('heightRange', dy))
  }
  const figure = drawing.metadata.sadChildCoordinates
  if (!figure) {
    metrics.push(missing('figureDistance', 'noFigurePosition'))
  } else {
    let sum = 0
    let count = 0
    for (const line of drawn) {
      for (const p of line.points) {
        sum += Math.hypot(p.x - figure.x, p.y - figure.y, p.z - figure.z)
        count++
      }
    }
    metrics.push(count ? value('figureDistance', sum / count) : missing('figureDistance', 'noStrokes'))
  }

  // Time and speed
  const times = drawn.map((line) => strokeTimes(line.points)).filter((t): t is { start: number; end: number } => t !== null)
  if (times.length === 0) {
    metrics.push(missing('drawingSpan', none ? 'noStrokes' : 'noTimeData'), missing('activeTime', none ? 'noStrokes' : 'noTimeData'), missing('meanSpeed', none ? 'noStrokes' : 'noTimeData'))
  } else {
    const spanSeconds = (Math.max(...times.map((t) => t.end)) - Math.min(...times.map((t) => t.start))) / 1000
    const activeSeconds = times.reduce((sum, t) => sum + (t.end - t.start), 0) / 1000
    metrics.push(value('drawingSpan', spanSeconds), value('activeTime', activeSeconds))
    metrics.push(activeSeconds > 0 ? value('meanSpeed', totalLength / activeSeconds) : missing('meanSpeed', 'noTimeData'))
  }

  // Directional change: mean turning angle between consecutive segments, 0 (straight) to 1 (turns back)
  let angleSum = 0
  let angleCount = 0
  for (const line of drawn) {
    const p = line.points
    for (let i = 1; i < p.length - 1; i++) {
      const v1 = [p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z]
      const v2 = [p[i + 1].x - p[i].x, p[i + 1].y - p[i].y, p[i + 1].z - p[i].z]
      const m1 = Math.hypot(v1[0], v1[1], v1[2])
      const m2 = Math.hypot(v2[0], v2[1], v2[2])
      if (m1 < 1e-6 || m2 < 1e-6) continue
      const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (m1 * m2)
      angleSum += Math.acos(Math.max(-1, Math.min(1, cos)))
      angleCount++
    }
  }
  metrics.push(angleCount ? value('directionalChange', angleSum / angleCount / Math.PI) : missing('directionalChange', 'noStrokes'))

  // Pressure (only drawings of schema version 2 have it)
  const pressures = drawn.flatMap((line) => line.points.map((p) => p.pressure).filter((x): x is number => x != null))
  metrics.push(pressures.length ? value('meanPressure', pressures.reduce((a, b) => a + b, 0) / pressures.length) : missing('meanPressure', none ? 'noStrokes' : 'noPressure'))

  // Hand use
  metrics.push(none ? missing('leftHandShare', 'noStrokes') : value('leftHandShare', (drawn.filter((l) => l.hand === -1).length / drawn.length) * 100))

  // Colour: ink length per (coarsely quantised) colour
  const bins = new Map<string, { hex: string; ink: number }>()
  let warmInk = 0
  let coolInk = 0
  drawn.forEach((line, i) => {
    const ink = stats[i].length
    const c = line.startColor
    const key = `${c.r >> 5},${c.g >> 5},${c.b >> 5}`
    const bin = bins.get(key) ?? { hex: rgbToHex(c), ink: 0 }
    bin.ink += ink
    bins.set(key, bin)
    const { hue, chromatic } = hueOf(c)
    if (chromatic) {
      if (isWarmHue(hue)) warmInk += ink
      else coolInk += ink
    }
  })
  const ranked = [...bins.values()].sort((a, b) => b.ink - a.ink)
  const palette: PaletteEntry[] = totalLength > 0 ? ranked.slice(0, 5).map((b) => ({ hex: b.hex, share: b.ink / totalLength })) : []
  metrics.push(warmInk + coolInk > 0 ? value('warmShare', (warmInk / (warmInk + coolInk)) * 100) : missing('warmShare', none ? 'noStrokes' : 'noChromaticInk'))
  metrics.push(none ? missing('distinctColours', 'noStrokes') : value('distinctColours', ranked.filter((b) => b.ink / totalLength >= 0.02).length))

  // Data quality flags (MET-08)
  const flags: QualityFlagId[] = []
  if ((drawing.metadata.schemaVersion ?? 1) < 2) flags.push('legacySchema')
  if ((drawing.metadata.trackingDecimation ?? 1) > 1) flags.push('thinnedTracking')
  if (drawn.length > 0 && drawn.length < 3) flags.push('fewStrokes')
  if (drawn.length === 0 && erased > 0) flags.push('allErased')
  if (drawing.metadata.gameType === 0 && !figure) flags.push('missingFigurePosition')
  if (drawn.length > 0 && times.length === 0) flags.push('missingTimeData')

  // Same order as the catalogue, so the UI can rely on it
  const order = new Map(metricCatalog.map((def, i) => [def.id, i]))
  metrics.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  return {
    drawingId: drawing.metadata.id,
    analyzerVersion: ANALYZER_VERSION,
    generatedAt: new Date().toISOString(),
    metrics,
    palette,
    flags,
  }
}

export function analyzeSession(sessionId: string, drawings: Drawing[]): SessionStats {
  const analyses = drawings.map((drawing) => ({ drawing, analysis: analyzeDrawing(drawing) }))

  const distributions: MetricDistribution[] = []
  for (const def of metricCatalog) {
    const values = analyses
      .map(({ analysis }) => analysis.metrics.find((m) => m.id === def.id)?.value)
      .filter((v): v is number => v != null)
    if (values.length > 0) {
      distributions.push({ id: def.id, count: values.length, min: Math.min(...values), median: median(values), max: Math.max(...values) })
    }
  }

  const byPlayer = new Map<string, typeof analyses>()
  for (const entry of analyses) {
    const owner = entry.drawing.metadata.owner
    byPlayer.set(owner, [...(byPlayer.get(owner) ?? []), entry])
  }
  const perParticipant: ParticipantRow[] = [...byPlayer.entries()].map(([playerId, entries]) => {
    const metrics: ParticipantRow['metrics'] = {}
    for (const def of metricCatalog) {
      const values = entries.map((e) => e.analysis.metrics.find((m) => m.id === def.id)?.value).filter((v): v is number => v != null)
      if (values.length > 0) {
        metrics[def.id] = values.reduce((a, b) => a + b, 0) / values.length
      }
    }
    return { playerId, drawings: entries.length, metrics }
  })

  return { sessionId, drawingCount: drawings.length, distributions, perParticipant }
}
