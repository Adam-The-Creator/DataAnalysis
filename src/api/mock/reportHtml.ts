import type { Drawing, DrawingAnalysis, PlayerInfo, Session, SessionStats } from '@/api/types'
import i18n from '@/i18n'
import { formatIsoDateTime, formatDateTime, formatDuration, formatNumber, displayName } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { formatMetricValue, metricDef } from '@/lib/metricCatalog'
import { toViewerStrokes } from '@/lib/strokes'
import { drawingSvg } from '@/lib/thumbnail'

/**
 * STAND-IN for the server side report generator (requirements REP-01..05). A report is one self-contained HTML
 * file: inline styles, inline SVG snapshots, no external resources. All user-provided text is escaped (REP-05).
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
  th { color: #475569; font-weight: 600; } .def { color: #64748b; font-size: 12px; }
  .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid #cbd5e1; vertical-align: -2px; margin-right: 6px; }
  .views { display: flex; flex-wrap: wrap; gap: 12px; } .views figure { margin: 0; } figcaption { font-size: 12px; color: #64748b; }
  @media print { body { background: #fff; } section { break-inside: avoid; } }
`

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>${styles}</style></head><body><main>${body}</main></body></html>`
}

function header(title: string): string {
  return `<h1>${esc(title)}</h1>` +
    `<p class="note">${esc(t('report.generated', { time: formatIsoDateTime(new Date().toISOString()) }))}</p>` +
    `<div class="banner">${esc(t('report.demoNote'))}</div>`
}

function metricRows(analysis: DrawingAnalysis): string {
  return analysis.metrics
    .map((metric) => {
      const def = metricDef(metric.id)
      const shown = metric.value != null
        ? esc(formatMetricValue(def, metric.value))
        : esc(t('report.unavailable', { reason: t(`metricReasons.${metric.unavailableReason ?? 'noStrokes'}`) }))
      return `<tr><td>${esc(t(`metrics.${metric.id}.name`))}<div class="def">${esc(t(`metrics.${metric.id}.definition`))}</div></td><td>${shown}</td></tr>`
    })
    .join('')
}

function paletteRows(analysis: DrawingAnalysis): string {
  if (analysis.palette.length === 0) {
    return `<p class="note">${esc(t('common.none'))}</p>`
  }
  return '<table>' + analysis.palette
    .map((c) => `<tr><td><span class="swatch" style="background:${esc(c.hex)}"></span>${esc(c.hex)}</td><td>${esc(formatNumber(c.share * 100, 0))} %</td></tr>`)
    .join('') + '</table>'
}

function flagList(analysis: DrawingAnalysis): string {
  if (analysis.flags.length === 0) {
    return `<p class="note">${esc(t('report.noFlags'))}</p>`
  }
  return '<ul>' + analysis.flags.map((flag) => `<li>${esc(t(`flags.${flag}`))}</li>`).join('') + '</ul>'
}

export function buildDrawingReport(
  drawing: Drawing, analysis: DrawingAnalysis, title: string, player: PlayerInfo | undefined, session: Session | undefined,
): string {
  const strokes = toViewerStrokes(drawing)
  const views = (['front', 'top', 'side'] as const)
    .map((view) => `<figure>${drawingSvg(strokes, view)}<figcaption>${esc(t(`report.views.${view}`))}</figcaption></figure>`)
    .join('')
  const info: [string, string][] = [
    [t('report.info.participant'), displayName(player, drawing.metadata.owner)],
    [t('report.info.age'), player?.age != null ? String(player.age) : t('common.none')],
    [t('report.info.gender'), player?.gender ?? t('common.none')],
    [t('report.info.dominantHand'), player?.dominantHand ?? t('common.none')],
    [t('report.info.session'), session?.name ?? drawing.metadata.sessionID],
    [t('report.info.gameType'), gameTypeLabel(t, drawing.metadata.gameType)],
    [t('report.info.date'), formatDateTime(drawing.metadata.date)],
  ]

  return page(title,
    header(title) +
    `<section><h2>${esc(t('report.sectionInfo'))}</h2><table>${info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></section>` +
    `<section><h2>${esc(t('report.sectionSnapshots'))}</h2><div class="views">${views}</div></section>` +
    `<section><h2>${esc(t('report.sectionMetrics'))}</h2><table>${metricRows(analysis)}</table></section>` +
    `<section><h2>${esc(t('report.sectionPalette'))}</h2>${paletteRows(analysis)}</section>` +
    `<section><h2>${esc(t('report.sectionFlags'))}</h2>${flagList(analysis)}</section>` +
    `<p class="note">${esc(t('report.disclaimer'))}</p>`,
  )
}

export function buildSessionReport(
  session: Session, stats: SessionStats, players: Map<string, PlayerInfo>,
): string {
  const title = session.name
  const distribution = stats.distributions
    .map((d) => {
      const def = metricDef(d.id)
      return `<tr><td>${esc(t(`metrics.${d.id}.name`))}</td><td>${esc(formatMetricValue(def, d.min))}</td><td>${esc(formatMetricValue(def, d.median))}</td><td>${esc(formatMetricValue(def, d.max))}</td></tr>`
    })
    .join('')
  const participants = stats.perParticipant
    .map((row) => {
      const cells = (['strokesDrawn', 'totalLength', 'activeTime'] as const)
        .map((id) => {
          const v = row.metrics[id]
          return `<td>${v == null ? esc(t('common.none')) : esc(id === 'activeTime' ? formatDuration(v) : formatMetricValue(metricDef(id), v))}</td>`
        })
        .join('')
      return `<tr><td>${esc(displayName(players.get(row.playerId), row.playerId))}</td><td>${row.drawings}</td>${cells}</tr>`
    })
    .join('')

  return page(title,
    header(title) +
    `<section><h2>${esc(t('report.sectionInfo'))}</h2><table>` +
    `<tr><th>${esc(t('report.info.session'))}</th><td>${esc(session.name)}</td></tr>` +
    `<tr><th>${esc(t('report.info.description'))}</th><td>${esc(session.description ?? t('common.none'))}</td></tr>` +
    `<tr><th>${esc(t('report.info.period'))}</th><td>${esc(formatDateTime(session.startDate))} – ${esc(session.endDate ? formatDateTime(session.endDate) : t('status.open'))}</td></tr>` +
    `<tr><th>${esc(t('report.info.drawings'))}</th><td>${stats.drawingCount}</td></tr></table></section>` +
    `<section><h2>${esc(t('report.sectionParticipants'))}</h2><table><tr><th>${esc(t('report.info.participant'))}</th><th>${esc(t('report.info.drawings'))}</th>` +
    `<th>${esc(t('metrics.strokesDrawn.name'))}</th><th>${esc(t('metrics.totalLength.name'))}</th><th>${esc(t('metrics.activeTime.name'))}</th></tr>${participants}</table></section>` +
    `<section><h2>${esc(t('report.sectionDistribution'))}</h2><table><tr><th>${esc(t('report.metric'))}</th><th>${esc(t('report.min'))}</th><th>${esc(t('report.median'))}</th><th>${esc(t('report.max'))}</th></tr>${distribution}</table></section>` +
    `<p class="note">${esc(t('report.disclaimer'))}</p>`,
  )
}
