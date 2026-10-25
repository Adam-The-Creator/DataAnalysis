import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAiSessionCohort, useAiSessionInsights } from '@/api/hooks'
import type { AiDirectoryEntry, AiInsight, AiInsights, AiSessionCohort, FuzzyLevel } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { metricDef, formatMetricValue } from '@/lib/metricCatalog'
import { AiBox } from './AiBox'
import { AiSection } from './AiSection'
import { CohortMap } from './CohortMap'

/**
 * The AI decision support of a session (requirements AI-10, AI-15): which drawings stand out from the others in the
 * session, a map of the drawings, and what recurs across the drawings and the participants. Marked as AI-generated.
 */

const levels: FuzzyLevel[] = ['low', 'medium', 'high']

function DrawingLinks({ ids, directory }: { ids: string[]; directory: Record<string, AiDirectoryEntry> }) {
  return (
    <span>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ', '}
          <Link to={`/drawings/${id}`} className="text-indigo-700 hover:underline">{directory[id]?.name ?? id}</Link>
        </span>
      ))}
    </span>
  )
}

function CohortContent({ result }: { result: AiSessionCohort }) {
  const { t } = useTranslation()
  const atypical = useMemo(() => result.drawings.filter((d) => d.atypical), [result.drawings])
  const atypicalIds = useMemo(() => new Set(atypical.map((d) => d.id)), [atypical])
  return (
    <div className="space-y-4">
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.sessionCohort.atypical')}</h4>
        {atypical.length === 0 ? <p className="text-sm text-slate-600">{t('ai.sessionCohort.none')}</p> : (
          <ul className="space-y-1.5 text-sm text-slate-800">
            {atypical.map((drawing) => (
              <li key={drawing.id}>
                <Link to={`/drawings/${drawing.id}`} className="font-medium text-indigo-700 hover:underline">{result.directory[drawing.id]?.name ?? drawing.id}</Link>
                <span className="text-slate-600">
                  {': '}{drawing.notable.filter((n) => n.beyondLimit).map((n) => t('ai.cohort.notableShort', {
                    metric: t(`metrics.${n.metric}.name`), direction: t(`ai.cohort.direction.${n.direction}`), value: n.value === null ? '-' : formatMetricValue(metricDef(n.metric), n.value),
                  })).join('; ')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-500">{t('ai.cohort.zHint', { limit: result.zLimit })}</p>
      </section>
      {result.map && <CohortMap map={result.map} directory={result.directory} atypicalIds={atypicalIds} />}
    </div>
  )
}

function InsightLine({ insight, directory }: { insight: AiInsight; directory: Record<string, AiDirectoryEntry> }) {
  const { t } = useTranslation()
  if (insight.kind === 'recurringLabel') {
    return (
      <li>
        {t('ai.insights.recurring', { label: insight.name, drawings: insight.drawings, participants: insight.participants })}
        <span className="block text-xs text-slate-500"><DrawingLinks ids={insight.drawingIds} directory={directory} /></span>
      </li>
    )
  }
  if (insight.kind === 'indicatorLevels') {
    return (
      <li>
        <span className="font-medium">{insight.name}:</span>{' '}
        {levels.map((level) => `${t(`ai.levels.${level}`)} ${insight.counts[level]}`).join(' · ')}
        {insight.common && <Badge tone="violet" className="ml-2">{t('ai.insights.mostly', { level: t(`ai.levels.${insight.common}`) })}</Badge>}
      </li>
    )
  }
  return (
    <li>
      {t('ai.insights.atypical', { count: insight.drawings })}
      <span className="block text-xs text-slate-500"><DrawingLinks ids={insight.drawingIds} directory={directory} /></span>
    </li>
  )
}

function InsightsContent({ result }: { result: AiInsights }) {
  const { t } = useTranslation()
  const order = { recurringLabel: 0, atypical: 1, indicatorLevels: 2 } as const
  const sorted = [...result.insights].sort((a, b) => order[a.kind] - order[b.kind])
  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm text-slate-800">
        {sorted.map((insight, i) => <InsightLine key={`${insight.kind}-${i}`} insight={insight} directory={result.directory} />)}
        {sorted.length === 0 && <li className="text-slate-500">{t('ai.insights.none')}</li>}
      </ul>
      <p className="text-xs text-slate-500">
        {t('ai.insights.coverage', { labels: result.coverage.labels, total: result.drawingCount })}
        {result.atypicalSkipped && ` ${t('ai.insights.atypicalSkipped')}`}
      </p>
    </div>
  )
}

export function AiSessionPanel({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const cohort = useAiSessionCohort(sessionId)
  const insights = useAiSessionInsights(sessionId)
  return (
    <Card title={t('ai.sessionPanel.title')} subtitle={t('ai.sessionPanel.subtitle')} className="border-violet-200">
      <div className="space-y-4">
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">{t('ai.panel.banner')}</p>
        <AiSection query={insights}>
          {(output) => <AiBox title={t('ai.insights.title')} output={output}><InsightsContent result={output.result} /></AiBox>}
        </AiSection>
        <AiSection query={cohort}>
          {(output) => <AiBox title={t('ai.sessionCohort.title')} output={output}><CohortContent result={output.result} /></AiBox>}
        </AiSection>
      </div>
    </Card>
  )
}
