import type { MetricId } from '@/api/types'
import { formatDuration, formatNumber } from './format'

/**
 * The metric catalogue (requirement MET-02): id, group, unit and number of decimals.
 * Names, definitions and interpretation notes are in the translations (metrics.<id>.*), so the same text feeds the
 * tooltips and, later, the generated reports.
 */
export type MetricGroup =
  | 'space' | 'counts' | 'length' | 'time' | 'motion' | 'handUse' | 'colour' | 'behaviour'

export type MetricUnit = 'count' | 'm' | 'm3' | 's' | 'mps' | 'percent' | 'ratio'

export interface MetricDef {
  id: MetricId
  group: MetricGroup
  unit: MetricUnit
  decimals: number
}

export const metricGroups: MetricGroup[] = [
  'counts', 'length', 'time', 'motion', 'space', 'handUse', 'colour', 'behaviour',
]

export const metricCatalog: readonly MetricDef[] = [
  { id: 'strokesDrawn', group: 'counts', unit: 'count', decimals: 0 },
  { id: 'strokesErased', group: 'counts', unit: 'count', decimals: 0 },
  { id: 'pointCount', group: 'counts', unit: 'count', decimals: 0 },
  { id: 'totalLength', group: 'length', unit: 'm', decimals: 2 },
  { id: 'meanStrokeLength', group: 'length', unit: 'm', decimals: 2 },
  { id: 'drawingSpan', group: 'time', unit: 's', decimals: 0 },
  { id: 'activeTime', group: 'time', unit: 's', decimals: 0 },
  { id: 'idleTime', group: 'time', unit: 's', decimals: 0 },
  { id: 'meanSpeed', group: 'motion', unit: 'mps', decimals: 2 },
  { id: 'directionalChange', group: 'motion', unit: 'ratio', decimals: 3 },
  { id: 'meanPressure', group: 'motion', unit: 'ratio', decimals: 2 },
  { id: 'boundingVolume', group: 'space', unit: 'm3', decimals: 3 },
  { id: 'heightRange', group: 'space', unit: 'm', decimals: 2 },
  { id: 'figureDistance', group: 'space', unit: 'm', decimals: 2 },
  { id: 'leftHandShare', group: 'handUse', unit: 'percent', decimals: 0 },
  { id: 'warmShare', group: 'colour', unit: 'percent', decimals: 0 },
  { id: 'distinctColours', group: 'colour', unit: 'count', decimals: 0 },
  { id: 'eraseRatio', group: 'behaviour', unit: 'percent', decimals: 0 },
  { id: 'menuOpens', group: 'behaviour', unit: 'count', decimals: 0 },
  { id: 'toolChanges', group: 'behaviour', unit: 'count', decimals: 0 },
]

const byId = new Map(metricCatalog.map((def) => [def.id, def]))

export function metricDef(id: MetricId): MetricDef {
  const def = byId.get(id)
  if (!def) {
    throw new Error(`Unknown metric: ${id}`)
  }
  return def
}

const unitSymbols: Record<MetricUnit, string> = {
  count: '', m: ' m', m3: ' m³', s: '', mps: ' m/s', percent: ' %', ratio: '',
}

export function unitSymbol(unit: MetricUnit): string {
  return unitSymbols[unit]
}

export function formatMetricValue(def: MetricDef, value: number): string {
  if (def.unit === 's') {
    return formatDuration(value)
  }
  return `${formatNumber(value, def.decimals)}${unitSymbols[def.unit]}`
}
