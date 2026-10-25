import type {
  AiDescription, AiDrawingCohort, AiGroups, AiIndicators, AiInsights, AiLabels, AiOutput, AiSummary, FuzzyLevel,
} from '@/api/types'
import i18n from '@/i18n'
import { formatIsoDateTime } from '@/lib/format'

/**
 * STAND-IN for the AI sections of the server's reports (DatabaseServer, ai/reporting.py). Every section carries the same
 * marking as the screens: the "AI-generated" badge, the sentence that it is decision support and not a diagnosis, and the
 * provenance, printed in full. All text is escaped.
 */

const t = i18n.t.bind(i18n)
const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => escapes[c])

export const aiReportStyles = `
  section.ai { border: 2px solid #7c3aed; background: #faf5ff; }
  .ai-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; } .ai-head h2 { margin: 0; }
  .ai-badge { background: #7c3aed; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .ai-warn { margin: 0 0 10px; font-size: 13px; color: #5b21b6; font-weight: 600; }
  .ai-prov { margin-top: 12px; border-top: 1px dashed #c4b5fd; padding-top: 8px; font-size: 12px; color: #475569; }
  .ai-prov td, .ai-prov th { padding: 2px 8px 2px 0; border: 0; font-size: 12px; }
  .ai ul { margin: 4px 0 8px; padding-left: 20px; }
`

const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="note">${esc(t('common.none'))}</p>`)
const levelText = (level: FuzzyLevel) => t(`ai.levels.${level}`)

function indicators(result: AiIndicators): string {
  const rows = result.indicators.map((ind) =>
    `<tr><td>${esc(ind.name)}</td><td>${esc(ind.text ?? t('ai.indicators.noRule'))}</td><td class="num">${Math.round(ind.degree * 100)} %</td>` +
    `<td>${esc(ind.fired.slice(0, 3).map((f) => `${f.rule} (${Math.round(f.strength * 100)} %)`).join('; ') || t('common.none'))}</td></tr>`).join('')
  return `<p class="note">${esc(t(`ai.indicators.basisNote.${result.basis}`, { count: result.cohortSize }))} ` +
    `${esc(t('ai.indicators.ruleBase', { name: result.ruleBase.name, version: result.ruleBase.version }))} ${esc(t(`ai.indicators.status.${result.ruleBase.status}`))}</p>` +
    `<table><tr><th>${esc(t('ai.report.indicator'))}</th><th>${esc(t('ai.report.level'))}</th><th class="num">${esc(t('ai.report.degree'))}</th><th>${esc(t('ai.report.rules'))}</th></tr>${rows}</table>`
}

function cohort(result: AiDrawingCohort): string {
  const { subject, directory } = result
  const notable = subject.notable.map((n) => t('ai.cohort.notableLine', {
    metric: t(`metrics.${n.metric}.name`), direction: t(`ai.cohort.direction.${n.direction}`), value: n.value ?? '-', z: n.z,
  }))
  const similar = subject.similar.map((s) => `${directory[s.id]?.name ?? s.id} (${t('ai.cohort.similarity', { value: Math.round(s.similarity * 100) })})`)
  return `<p>${esc(subject.atypical ? t('ai.cohort.atypical') : t('ai.cohort.typical'))} (${esc(t('ai.cohort.size', { count: result.cohortSize }))})</p>` +
    `<h3>${esc(t('ai.cohort.notable'))}</h3>${list(notable)}<h3>${esc(t('ai.cohort.similar'))}</h3>${list(similar)}`
}

function groups(result: AiGroups): string {
  const rows = result.groups.map((g) =>
    `<tr><td>${esc(t('ai.groups.name', { id: g.id }))}</td><td class="num">${g.strokeCount}</td><td class="num">${Math.round(g.inkShare * 100)} %</td>` +
    `<td>${g.size.map((s) => Math.round(s * 100)).join(' × ')} cm</td><td>${g.colours.map((c) => `<span class="swatch" style="background:${esc(c.hex)}"></span>`).join('')}</td></tr>`).join('')
  return `<p>${esc(t('ai.groups.summary', { groups: result.groups.length, ungrouped: result.unclustered.length }))}</p>` +
    `<table><tr><th>${esc(t('ai.groups.group'))}</th><th class="num">${esc(t('ai.groups.strokes'))}</th><th class="num">${esc(t('ai.groups.ink'))}</th><th>${esc(t('ai.groups.size'))}</th><th>${esc(t('ai.groups.colours'))}</th></tr>${rows}</table>`
}

function labels(result: AiLabels): string {
  const line = (name: string, verdict: AiLabels['whole']) =>
    `<tr><td>${esc(name)}</td><td>${esc(verdict.top.map((e) => `${e.name} ${Math.round(e.score * 100)} %`).join(', '))}${verdict.unspecific ? ` (${esc(t('ai.labels.unspecific'))})` : ''}</td></tr>`
  return `<table><tr><th>${esc(t('ai.report.subject'))}</th><th>${esc(t('ai.report.bestMatching'))}</th></tr>` +
    line(t('ai.labels.whole'), result.whole) + result.groups.map((g) => line(t('ai.groups.name', { id: g.groupId }), g as unknown as AiLabels['whole'])).join('') + '</table>'
}

function description(result: AiDescription): string {
  return `<p>${esc(result.scene)}</p><h3>${esc(t('ai.description.objects'))}</h3>` +
    list(result.depictedObjects.map((o) => `${o.name} (${t(`ai.description.certainty.${o.certainty}`)})`)) +
    `<h3>${esc(t('ai.description.features'))}</h3>${list(result.notableFeatures)}<h3>${esc(t('ai.description.colours'))}</h3>${list(result.colourMoodWords)}`
}

function summary(result: AiSummary): string {
  return `<p>${esc(result.overview)}</p><h3>${esc(t('ai.summary.observations'))}</h3>${list(result.observations)}` +
    `<h3>${esc(t('ai.summary.explore'))}</h3>${list(result.thingsToExplore)}<h3>${esc(t('ai.summary.limitations'))}</h3>${list(result.limitations)}`
}

function insights(result: AiInsights): string {
  const lines = result.insights.map((item) => {
    if (item.kind === 'recurringLabel') return t('ai.insights.recurring', { label: item.name, drawings: item.drawings, participants: item.participants })
    if (item.kind === 'indicatorLevels') {
      return `${item.name}: ${(['low', 'medium', 'high'] as const).map((l) => `${levelText(l)} ${item.counts[l]}`).join(' · ')}`
    }
    return `${t('ai.insights.atypical', { count: item.drawings })} ${item.drawingIds.map((id) => result.directory[id]?.name ?? id).join(', ')}`
  })
  return `<p>${esc(t('ai.report.drawingCount', { count: result.drawingCount }))}</p>${list(lines)}`
}

function provenance(output: AiOutput<unknown>): string {
  const rows: [string, string][] = [
    [t('ai.provenance.model'), `${output.model.name}, ${t('ai.provenance.version')} ${output.model.version}, ${t('ai.provenance.licence')} ${output.model.licence}`],
    [t('ai.provenance.parameters'), JSON.stringify(output.params)],
    [t('ai.provenance.prompt'), output.promptVersion ?? t('common.none')],
    [t('ai.provenance.confidence'), output.confidence !== null ? `${Math.round(output.confidence * 100)} % (${output.confidenceKind})` : t('ai.provenance.noConfidence')],
    [t('ai.provenance.evidence'), String(output.evidence.length)],
    [t('ai.provenance.generated'), formatIsoDateTime(output.generatedAt)],
    [t('ai.provenance.evaluated'), output.evaluated ? t('common.yes') : t('ai.provenance.notEvaluated')],
  ]
  return `<div class="ai-prov"><table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` +
    output.notes.map((n) => `<br>${esc(n)}`).join('') + '</div>'
}

const bodies: Record<string, (result: never) => string> = { indicators, cohort, groups, labels, description, summary, insights } as never

export function aiReportHtml(outputs: AiOutput<unknown>[]): string {
  return outputs.map((output) => {
    const body = output.status === 'ok' && output.result !== null
      ? bodies[output.feature](output.result as never)
      : `<p class="note">${esc(t(`ai.reasons.${output.reason ?? 'failed'}`))}</p>`
    return `<section class="ai" aria-label="AI-generated"><div class="ai-head"><span class="ai-badge">${esc(t('ai.label'))}</span>` +
      `<h2>${esc(t(`ai.report.titles.${output.feature}`))}</h2></div><p class="ai-warn">${esc(output.disclaimer)}</p>${body}${provenance(output)}</section>`
  }).join('')
}
