import type {
  Drawing, DrawingAnalysis, HistoryRow, MetricId, NarrativeItem, PlayerInfo, Session, SessionStats,
} from '@/api/types'
import i18n from '@/i18n'
import { geometryFromDrawing } from '@/lib/drawingGeometry'
import { displayName, formatDateTime, formatIsoDateTime, formatNumber } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { formatMetricValue, metricDef } from '@/lib/metricCatalog'
import { toViewerStrokes } from '@/lib/strokes'
import { drawingSvg } from '@/lib/thumbnail'
import { aiReportStyles } from './aiReportHtml'

/**
 * STAND-IN for the server side report generator (DatabaseServer, analysis/reports.py). A report is one self-contained
 * HTML file: inline styles, inline SVG snapshots, no external resources. All user-provided text in it is escaped
 * (REP-05). The real reports also have an interactive 3D view, the demo ones only the static snapshots.
 */

const t = i18n.t.bind(i18n)

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => escapes[c])

const styles = `
  body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 0 0 12px; }
  .note { color: #64748b; font-size: 13px; }
  .banner { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 12px; font-size: 13px; margin: 16px 0; }
  section { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  th { color: #475569; font-weight: 600; } .def { color: #64748b; font-size: 12px; } .num { text-align: right; white-space: nowrap; }
  .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid #cbd5e1; vertical-align: -2px; margin-right: 6px; }
  .views { display: flex; flex-wrap: wrap; gap: 12px; } .views figure { margin: 0; } figcaption { font-size: 12px; color: #64748b; }
  @media print { body { background: #fff; } section { break-inside: avoid; } }
` + aiReportStyles

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>${styles}</style></head><body><main>${body}</main></body></html>`
}

function header(title: string): string {
  return `<h1>${esc(title)}</h1>` +
    `<p class="note">${esc(t('report.generated', { time: formatIsoDateTime(new Date().toISOString()) }))}</p>` +
    `<div class="banner">${esc(t('report.demoNote'))}</div>`
}

const none = () => t('common.none')

function metricRows(analysis: DrawingAnalysis): string {
  return analysis.metrics
    .map((metric) => {
      const def = metricDef(metric.id)
      const shown = metric.value != null
        ? esc(formatMetricValue(def, metric.value))
        : esc(t('report.unavailable', { reason: t(`metricReasons.${metric.unavailableReason ?? 'noStrokes'}`) }))
      return `<tr><td>${esc(t(`metrics.${metric.id}.name`))}<div class="def">${esc(t(`metrics.${metric.id}.definition`))}</div></td><td class="num">${shown}</td></tr>`
    })
    .join('')
}

function paletteRows(analysis: DrawingAnalysis): string {
  if (analysis.palette.length === 0) return `<p class="note">${esc(none())}</p>`
  return '<table>' + analysis.palette
    .map((c) => `<tr><td><span class="swatch" style="background:${esc(c.hex)}"></span>${esc(c.hex)}</td><td class="num">${esc(formatNumber(c.share * 100, 0))} %</td></tr>`)
    .join('') + '</table>'
}

export function buildDrawingReport(
  drawing: Drawing, analysis: DrawingAnalysis, narrative: NarrativeItem[], title: string,
  player: PlayerInfo | undefined, session: Session | undefined, aiHtml = '',
): string {
  const strokes = toViewerStrokes(geometryFromDrawing(drawing))
  const views = (['front', 'top', 'side'] as const)
    .map((view) => `<figure>${drawingSvg(strokes, view)}<figcaption>${esc(t(`report.views.${view}`))}</figcaption></figure>`)
    .join('')
  const info: [string, string][] = [
    [t('report.info.participant'), displayName(player, drawing.metadata.owner)],
    [t('report.info.age'), player?.age != null ? String(player.age) : none()],
    [t('report.info.gender'), player?.gender ?? none()],
    [t('report.info.dominantHand'), player?.dominantHand ?? none()],
    [t('report.info.session'), session?.name ?? drawing.metadata.sessionID],
    [t('report.info.sessionDescription'), session?.description || none()],
    [t('report.info.gameType'), gameTypeLabel(t, drawing.metadata.gameType)],
    [t('report.info.date'), formatDateTime(drawing.metadata.date)],
  ]
  const sentences = narrative.map((item) => `<p>${esc(t(`narrative.${item.id}`, item.params))}</p>`).join('') || `<p class="note">${esc(none())}</p>`
  const flags = analysis.flags.length === 0
    ? `<p class="note">${esc(t('report.noFlags'))}</p>`
    : '<ul>' + analysis.flags.map((flag) => `<li>${esc(t(`flags.${flag}`))}</li>`).join('') + '</ul>'

  return page(title,
    header(title) +
    `<section><h2>${esc(t('report.sectionInfo'))}</h2><table>${info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></section>` +
    `<section><h2>${esc(t('report.sectionSnapshots'))}</h2><div class="views">${views}</div></section>` +
    `<section><h2>${esc(t('report.sectionSummary'))}</h2>${sentences}</section>` +
    aiHtml +
    `<section><h2>${esc(t('report.sectionMetrics'))}</h2><table>${metricRows(analysis)}</table></section>` +
    `<section><h2>${esc(t('report.sectionPalette'))}</h2>${paletteRows(analysis)}</section>` +
    `<section><h2>${esc(t('report.sectionFlags'))}</h2>${flags}</section>` +
    `<p class="note">${esc(t('report.disclaimer'))}</p>`,
  )
}

export function buildSessionReport(session: Session, stats: SessionStats, players: Map<string, PlayerInfo>, aiHtml = ''): string {
  const title = session.name
  const distribution = stats.distributions
    .map((d) => {
      const def = metricDef(d.id)
      return `<tr><td>${esc(t(`metrics.${d.id}.name`))}</td><td class="num">${esc(formatMetricValue(def, d.min))}</td><td class="num">${esc(formatMetricValue(def, d.median))}</td><td class="num">${esc(formatMetricValue(def, d.max))}</td></tr>`
    })
    .join('')
  const cell = (id: MetricId, value: number | undefined) => `<td class="num">${value == null ? esc(none()) : esc(formatMetricValue(metricDef(id), value))}</td>`
  const participants = stats.perParticipant
    .map((row) => `<tr><td>${esc(displayName(players.get(row.playerId), row.playerId))}</td><td class="num">${row.drawings}</td>` +
      cell('strokesDrawn', row.metrics.strokesDrawn) + cell('totalLength', row.metrics.totalLength) + cell('activeTime', row.metrics.activeTime) + '</tr>')
    .join('')

  return page(title,
    header(title) +
    `<section><h2>${esc(t('report.sectionInfo'))}</h2><table>` +
    `<tr><th>${esc(t('report.info.session'))}</th><td>${esc(session.name)}</td></tr>` +
    `<tr><th>${esc(t('report.info.description'))}</th><td>${esc(session.description ?? none())}</td></tr>` +
    `<tr><th>${esc(t('report.info.period'))}</th><td>${esc(formatDateTime(session.startDate))} - ${esc(session.endDate ? formatDateTime(session.endDate) : t('status.open'))}</td></tr>` +
    `<tr><th>${esc(t('report.info.drawings'))}</th><td>${stats.drawingCount}</td></tr></table></section>` +
    `<section><h2>${esc(t('report.sectionParticipants'))}</h2><table><tr><th>${esc(t('report.info.participant'))}</th><th class="num">${esc(t('report.info.drawings'))}</th>` +
    `<th class="num">${esc(t('metrics.strokesDrawn.name'))}</th><th class="num">${esc(t('metrics.totalLength.name'))}</th><th class="num">${esc(t('metrics.activeTime.name'))}</th></tr>${participants}</table></section>` +
    aiHtml +
    `<section><h2>${esc(t('report.sectionDistribution'))}</h2><table><tr><th>${esc(t('report.metric'))}</th><th class="num">${esc(t('report.min'))}</th><th class="num">${esc(t('report.median'))}</th><th class="num">${esc(t('report.max'))}</th></tr>${distribution}</table></section>` +
    `<p class="note">${esc(t('report.disclaimer'))}</p>`,
  )
}

// --- Participant history report (REP-08) ---

const TREND_METRICS: MetricId[] = ['strokesDrawn', 'totalLength', 'activeTime', 'meanSpeed', 'boundingVolume', 'leftHandShare', 'warmShare', 'eraseRatio']

function sparkline(values: number[]): string {
  const low = Math.min(...values)
  const span = Math.max(...values) - low || 1
  const [width, height, pad] = [90, 24, 3]
  const step = (width - 2 * pad) / Math.max(1, values.length - 1)
  const points = values.map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - low) / span) * (height - 2 * pad)).toFixed(1)}`).join(' ')
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t('report.columns.trend'))}"><polyline points="${points}" fill="none" stroke="#4f46e5" stroke-width="2"/></svg>`
}

export function buildParticipantReport(player: PlayerInfo, history: HistoryRow[]): string {
  const title = t('report.participantTitle', { name: player.name ?? t('report.info.participant') })
  const cell = (row: HistoryRow, id: MetricId) => {
    const v = row.metrics[id]
    return `<td class="num">${v == null ? esc(none()) : esc(formatMetricValue(metricDef(id), v))}</td>`
  }

  const sections = [...new Set(history.map((h) => h.meta.gameType))].sort((a, b) => a - b).map((gameType) => {
    const rows = history.filter((h) => h.meta.gameType === gameType)
    const table = `<table><tr><th>${esc(t('report.columns.date'))}</th><th>${esc(t('report.columns.drawing'))}</th><th>${esc(t('report.columns.session'))}</th>` +
      `<th class="num">${esc(t('metrics.strokesDrawn.name'))}</th><th class="num">${esc(t('metrics.totalLength.name'))}</th><th class="num">${esc(t('metrics.activeTime.name'))}</th></tr>` +
      rows.map((r) => `<tr><td>${esc(formatDateTime(r.date))}</td><td>${esc(r.meta.name)}</td><td>${esc(r.sessionName)}</td>${cell(r, 'strokesDrawn')}${cell(r, 'totalLength')}${cell(r, 'activeTime')}</tr>`).join('') + '</table>'
    let trend = ''
    if (rows.length >= 2) {
      const lines = TREND_METRICS.flatMap((id) => {
        const values = rows.map((r) => r.metrics[id]).filter((v): v is number => v != null)
        if (values.length < 2) return []
        const [first, last] = [values[0], values[values.length - 1]]
        const change = first ? `${(((last - first) / first) * 100 >= 0 ? '+' : '')}${(((last - first) / first) * 100).toFixed(0)} %` : t('common.notAvailable')
        const def = metricDef(id)
        return [`<tr><td>${esc(t(`metrics.${id}.name`))}</td><td class="num">${esc(formatMetricValue(def, first))}</td><td class="num">${esc(formatMetricValue(def, last))}</td><td class="num">${esc(change)}</td><td>${sparkline(values)}</td></tr>`]
      })
      trend = `<h2 style="margin-top:16px">${esc(t('report.changeTitle'))}</h2><table><tr><th>${esc(t('report.metric'))}</th><th class="num">${esc(t('report.columns.first'))}</th><th class="num">${esc(t('report.columns.latest'))}</th><th class="num">${esc(t('report.columns.change'))}</th><th>${esc(t('report.columns.trend'))}</th></tr>${lines.join('')}</table>`
    }
    return `<section><h2>${esc(t('report.gameTypeSection', { type: gameTypeLabel(t, gameType), count: rows.length }))}</h2>${table}${trend}</section>`
  })

  const info = [
    [t('report.info.participant'), player.name ?? none()], [t('report.info.age'), player.age != null ? String(player.age) : none()],
    [t('report.info.gender'), player.gender ?? none()], [t('report.info.dominantHand'), player.dominantHand ?? none()],
    [t('report.info.drawings'), String(history.length)],
  ]
  return page(title,
    header(title) +
    `<section><h2>${esc(t('report.sectionParticipant'))}</h2><table>${info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></section>` +
    sections.join('') + `<p class="note">${esc(t('report.disclaimer'))}</p>`,
  )
}
