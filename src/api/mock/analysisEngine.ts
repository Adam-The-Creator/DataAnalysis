import type {
  Drawing, DrawingAnalysis, Line, MetricDistribution, MetricId, MetricValue, NarrativeItem, PaletteEntry,
  ParticipantRow, QualityFlagId, SessionStats, UnavailableReason,
} from '@/api/types'
import { DrawingEventType } from '@/api/types'
import { hueOf, isWarmHue, rgbToHex } from '@/lib/colors'
import { computeLineStats, strokeTimes } from '@/lib/geometry'
import { metricCatalog } from '@/lib/metricCatalog'
import {
  breaksBetween, IDLE_GAP_SECONDS, idlePeriods, mergeIntervals, type Interval,
} from '@/lib/timeAxis'

/**
 * STAND-IN for the server side analysis module (DatabaseServer, analysis/metrics.py). It lets the demo mode show real
 * numbers that match the 3D view. It is a port of the real implementation, kept in step with it: the same
 * definitions, the same edge cases. The real one is the reference.
 */

export const ANALYZER_VERSION = 'demo-0.2'

const value = (id: MetricId, v: number): MetricValue => ({ id, value: v })
const missing = (id: MetricId, reason: UnavailableReason): MetricValue => ({ id, value: null, unavailableReason: reason })

const statsOf = (line: Line) => line.stats ?? computeLineStats(line.points)

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

export function analyzeDrawing(drawing: Drawing, idleGapSeconds = IDLE_GAP_SECONDS): DrawingAnalysis {
  const drawn = drawing.lines.filter((line) => line.status === 1)
  const erased = drawing.lines.length - drawn.length
  const nothingDrawn = drawn.length === 0
  const metrics: MetricValue[] = []

  const stats = drawn.map(statsOf)
  const totalLength = sum(stats.map((s) => s.length))

  metrics.push(value('strokesDrawn', drawn.length), value('strokesErased', erased))
  metrics.push(value('eraseRatio', drawing.lines.length ? (erased / drawing.lines.length) * 100 : 0))
  metrics.push(value('pointCount', sum(stats.map((s) => s.pointCount))))
  metrics.push(nothingDrawn ? missing('totalLength', 'noStrokes') : value('totalLength', totalLength))
  metrics.push(nothingDrawn ? missing('meanStrokeLength', 'noStrokes') : value('meanStrokeLength', totalLength / drawn.length))

  // Space
  if (nothingDrawn) {
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
    const distances = drawn.flatMap((l) => l.points.map((p) => Math.hypot(p.x - figure.x, p.y - figure.y, p.z - figure.z)))
    metrics.push(distances.length ? value('figureDistance', sum(distances) / distances.length) : missing('figureDistance', 'noStrokes'))
  }

  // Time, pauses and speed
  const times: Interval[] = drawn.flatMap((line) => {
    const t = strokeTimes(line.points)
    return t ? [{ start: t.start, end: t.end }] : []
  })
  const noTime: UnavailableReason = nothingDrawn ? 'noStrokes' : 'noTimeData'
  const sittings = breaksBetween(times)
  if (times.length === 0) {
    metrics.push(missing('drawingSpan', noTime), missing('activeTime', noTime), missing('idleTime', noTime), missing('meanSpeed', noTime))
  } else {
    // The breaks between sittings are not part of the time span
    const span = (Math.max(...times.map((t) => t.end)) - Math.min(...times.map((t) => t.start)) - sum(sittings.map((b) => b.end - b.start))) / 1000
    const active = sum(mergeIntervals(times).map((t) => t.end - t.start)) / 1000
    const pauses = idlePeriods(times, idleGapSeconds * 1000)
    metrics.push(value('drawingSpan', span), value('activeTime', active))
    metrics.push(value('idleTime', sum(pauses.map((p) => p.end - p.start)) / 1000))
    metrics.push(active > 0 ? value('meanSpeed', totalLength / active) : missing('meanSpeed', 'noTimeData'))
  }

  // Directional change: mean turning angle between consecutive segments, 0 (straight) to 1 (turning back)
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
  metrics.push(pressures.length ? value('meanPressure', sum(pressures) / pressures.length) : missing('meanPressure', nothingDrawn ? 'noStrokes' : 'noPressure'))

  // Hand use
  metrics.push(nothingDrawn ? missing('leftHandShare', 'noStrokes') : value('leftHandShare', (drawn.filter((l) => l.hand === -1).length / drawn.length) * 100))

  // Colour: ink length per (coarsely quantised) colour of the stroke start
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
  // Strokes of zero length (a tap) have no ink, so shares of the ink cannot be told
  const noInk: UnavailableReason = nothingDrawn ? 'noStrokes' : 'noInk'
  metrics.push(
    warmInk + coolInk > 0
      ? value('warmShare', (warmInk / (warmInk + coolInk)) * 100)
      : missing('warmShare', totalLength <= 0 ? noInk : 'noChromaticInk'),
  )
  metrics.push(
    totalLength <= 0
      ? missing('distinctColours', noInk)
      : value('distinctColours', ranked.filter((b) => b.ink / totalLength >= 0.02).length),
  )

  // Tool behaviour: events exist from schema version 2 on (an empty list there means "none happened")
  if ((drawing.metadata.schemaVersion ?? 1) < 2) {
    metrics.push(missing('menuOpens', 'noEvents'), missing('toolChanges', 'noEvents'))
  } else {
    const events = drawing.events ?? []
    const toolTypes: number[] = [DrawingEventType.ModeChange, DrawingEventType.ColorChange, DrawingEventType.WidthChange]
    metrics.push(
      value('menuOpens', events.filter((e) => e.type === DrawingEventType.MenuOpen).length),
      value('toolChanges', events.filter((e) => toolTypes.includes(e.type)).length),
    )
  }

  // Data quality flags (MET-08)
  const flags: QualityFlagId[] = []
  if ((drawing.metadata.schemaVersion ?? 1) < 2) flags.push('legacySchema')
  if ((drawing.metadata.trackingDecimation ?? 1) > 1) flags.push('thinnedTracking')
  if (drawn.length > 0 && drawn.length < 3) flags.push('fewStrokes')
  if (drawn.length === 0 && erased > 0) flags.push('allErased')
  if (drawing.metadata.gameType === 0 && !figure) flags.push('missingFigurePosition')
  if (drawn.length > 0 && times.length === 0) flags.push('missingTimeData')
  if (sittings.length > 0) flags.push('multipleSittings')

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

export function metricValues(analysis: DrawingAnalysis): Record<MetricId, number | null> {
  return Object.fromEntries(analysis.metrics.map((m) => [m.id, m.value])) as Record<MetricId, number | null>
}

// --- The template-based narrative (REP-07), same sentences as analysis/narrative.py ---

const round = (v: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(v * factor) / factor
}

export function buildNarrative(
  analysis: DrawingAnalysis, dominantHand: string | null, idleGapSeconds = IDLE_GAP_SECONDS,
): NarrativeItem[] {
  const v = metricValues(analysis)
  const items: NarrativeItem[] = []
  const add = (id: NarrativeItem['id'], params: NarrativeItem['params']) => items.push({ id, params })

  if (v.strokesDrawn && v.totalLength != null) {
    if (v.activeTime != null && v.drawingSpan != null) {
      add('activityTimed', { strokes: v.strokesDrawn, length: round(v.totalLength, 1), active: round(v.activeTime), span: round(v.drawingSpan) })
    } else {
      add('activity', { strokes: v.strokesDrawn, length: round(v.totalLength, 1) })
    }
  }
  if (v.meanSpeed != null) add('speed', { speed: round(v.meanSpeed, 2) })
  if (v.boundingVolume != null && v.heightRange != null) add('space', { volume: round(v.boundingVolume, 3), height: round(v.heightRange, 2) })
  if (v.leftHandShare != null) {
    if (dominantHand) add('handDominant', { left: round(v.leftHandShare), dominant: dominantHand })
    else add('hand', { left: round(v.leftHandShare) })
  }
  if (v.distinctColours != null) {
    if (v.warmShare != null) add('colour', { colours: v.distinctColours, warm: round(v.warmShare) })
    else add('colourNeutral', { colours: v.distinctColours })
  }
  if (v.strokesErased) add('erase', { erased: v.strokesErased, ratio: round(v.eraseRatio ?? 0) })
  if (v.menuOpens != null && v.toolChanges != null) add('tools', { menu: v.menuOpens, tools: v.toolChanges })
  if (v.idleTime) add('pauses', { gap: round(idleGapSeconds, 1), seconds: round(v.idleTime) })
  if (analysis.flags.length) add('quality', { notes: analysis.flags.length })
  return items
}

// --- Session statistics ---

export function analyzeSession(sessionId: string, drawings: Drawing[]): SessionStats {
  const analyses = drawings.map((drawing) => ({ owner: drawing.metadata.owner, analysis: analyzeDrawing(drawing) }))

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
    byPlayer.set(entry.owner, [...(byPlayer.get(entry.owner) ?? []), entry])
  }
  const perParticipant: ParticipantRow[] = [...byPlayer.entries()].map(([playerId, entries]) => {
    const means: ParticipantRow['metrics'] = {}
    for (const def of metricCatalog) {
      const values = entries.map((e) => e.analysis.metrics.find((m) => m.id === def.id)?.value).filter((v): v is number => v != null)
      if (values.length > 0) means[def.id] = sum(values) / values.length
    }
    return { playerId, drawings: entries.length, metrics: means }
  })

  return { sessionId, drawingCount: drawings.length, distributions, perParticipant }
}
