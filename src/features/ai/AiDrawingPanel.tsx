import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAiCohort, useAiGroups, useAiIndicators, useAiStatus } from '@/api/hooks'
import type { AiGroups, AiIndicator, AiIndicators, AiScope, FuzzyLevel, MetricId } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { InfoTip } from '@/components/ui/InfoTip'
import { cn } from '@/lib/cn'
import { formatMetricValue, metricDef } from '@/lib/metricCatalog'
import { AiBox } from './AiBox'
import { DescriptionContent, LabelsContent, SummaryContent } from './AiContents'
import { AiSection as Section } from './AiSection'
import { CohortMap } from './CohortMap'
import { HeavySection } from './HeavySection'

/**
 * The AI decision support of a drawing (requirements AI-10..AI-16). Everything in it is marked as AI-generated and is
 * for the psychologist to review (AiBox). The indicators, the comparison and the stroke groups are calculated on request,
 * the labels, the description and the conclusion are started by a button and run as background jobs.
 */

const SCOPES: AiScope[] = ['gameType', 'session', 'all']
const levels: FuzzyLevel[] = ['low', 'medium', 'high']

function metricValueText(metric: MetricId, value: number | null): string {
  return value === null ? '-' : formatMetricValue(metricDef(metric), value)
}

// --- AI-14: indicators ---

function LevelMeter({ indicator }: { indicator: AiIndicator }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1" role="img" aria-label={levels.map((l) => `${t(`ai.levels.${l}`)} ${Math.round(indicator.degrees[l] * 100)} %`).join(', ')}>
      {levels.map((level) => (
        <div key={level} className="w-14 text-center">
          <div className={cn('h-2 overflow-hidden rounded bg-slate-200', indicator.level === level && 'ring-1 ring-violet-700')}>
            <div className="h-full bg-violet-600" style={{ width: `${Math.round(indicator.degrees[level] * 100)}%` }} />
          </div>
          <span className={cn('text-[10px]', indicator.level === level ? 'font-semibold text-slate-900' : 'text-slate-500')}>{t(`ai.levels.${level}`)}</span>
        </div>
      ))}
    </div>
  )
}

function IndicatorRow({ indicator }: { indicator: AiIndicator }) {
  const { t } = useTranslation()
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {indicator.name} <InfoTip text={indicator.rationale} />
          </p>
          <p className="text-sm text-slate-700">
            {indicator.text ?? <span className="text-slate-400">{t('ai.indicators.noRule')}</span>}
            {indicator.level && <span className="ml-1 text-xs text-slate-500">({Math.round(indicator.degree * 100)} %)</span>}
          </p>
        </div>
        <LevelMeter indicator={indicator} />
      </div>
      <details className="mt-1 text-xs text-slate-600">
        <summary className="cursor-pointer">{t('ai.indicators.why')}</summary>
        <div className="mt-2 space-y-2">
          <div>
            <p className="font-medium text-slate-700">{t('ai.indicators.inputs')}</p>
            <ul className="space-y-0.5">
              {indicator.inputs.map((input) => (
                <li key={input.metric}>
                  {t(`metrics.${input.metric}.name`)}: {metricValueText(input.metric, input.value)}
                  {input.sets
                    ? ` → ${levels.map((l) => `${t(`ai.levels.${l}`)} ${Math.round(input.sets![l] * 100)} %`).join(', ')} (${t(`ai.indicators.basis.${input.basis ?? 'fixed'}`)})`
                    : ` → ${t('ai.indicators.noValue')}`}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-700">{t('ai.indicators.rules')}</p>
            {indicator.fired.length === 0 ? <p>{t('common.none')}</p> : (
              <ul className="space-y-1">
                {indicator.fired.map((rule) => (
                  <li key={rule.rule}>
                    <span className="font-mono">{rule.rule}</span>: {t('ai.indicators.ruleText', { condition: rule.if, level: t(`ai.levels.${rule.then}`), strength: Math.round(rule.strength * 100), weight: rule.weight })}
                    <br /><span className="text-slate-500">{rule.rationale}</span>
                  </li>
                ))}
              </ul>
            )}
            {indicator.skipped.length > 0 && (
              <p className="mt-1 text-slate-500">{t('ai.indicators.skipped', { rules: indicator.skipped.map((s) => s.rule).join(', ') })}</p>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}

function IndicatorsContent({ result }: { result: AiIndicators }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        {t(`ai.indicators.basisNote.${result.basis}`, { count: result.cohortSize })}{' '}
        {t('ai.indicators.ruleBase', { name: result.ruleBase.name, version: result.ruleBase.version })}{' '}
        <Badge tone={result.ruleBase.status === 'reviewed' ? 'emerald' : 'amber'}>{t(`ai.indicators.status.${result.ruleBase.status}`)}</Badge>
      </p>
      <ul className="divide-y divide-slate-100">{result.indicators.map((indicator) => <IndicatorRow key={indicator.id} indicator={indicator} />)}</ul>
    </div>
  )
}

function IndicatorsSection({ drawingId, scope }: { drawingId: string; scope: AiScope }) {
  const { t } = useTranslation()
  const query = useAiIndicators(drawingId, scope)
  return (
    <Section query={query}>
      {(output) => <AiBox title={t('ai.indicators.title')} output={output} drawingId={drawingId}><IndicatorsContent result={output.result} /></AiBox>}
    </Section>
  )
}

// --- AI-10: comparison with the group ---

function CohortSection({ drawingId, scope }: { drawingId: string; scope: AiScope }) {
  const { t } = useTranslation()
  const query = useAiCohort(drawingId, scope)
  return (
    <Section query={query}>
      {(output) => {
        const { subject, directory } = output.result
        return (
          <AiBox title={t('ai.cohort.title')} output={output} drawingId={drawingId}>
            <div className="space-y-4">
              <p className="text-sm text-slate-800">
                {subject.atypical ? t('ai.cohort.atypical') : t('ai.cohort.typical')}{' '}
                <span className="text-xs text-slate-500">{t('ai.cohort.size', { count: output.result.cohortSize })}</span>
              </p>
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.cohort.notable')}</h4>
                {subject.notable.length === 0 ? <p className="text-sm text-slate-500">{t('ai.cohort.noNotable')}</p> : (
                  <ul className="space-y-1 text-sm text-slate-800">
                    {subject.notable.map((n) => (
                      <li key={n.metric}>
                        {t('ai.cohort.notableLine', { metric: t(`metrics.${n.metric}.name`), direction: t(`ai.cohort.direction.${n.direction}`), value: metricValueText(n.metric, n.value), z: n.z })}
                        {n.beyondLimit && <Badge tone="amber" className="ml-2">{t('ai.cohort.beyondLimit')}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-slate-500">{t('ai.cohort.zHint', { limit: output.result.zLimit })}</p>
                {subject.isolation && <p className="mt-1 text-xs text-slate-600">{t('ai.cohort.isolation', { rank: subject.isolation.rank, of: subject.isolation.of })}</p>}
              </section>
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.cohort.similar')}</h4>
                <ul className="space-y-0.5 text-sm">
                  {subject.similar.map((s) => (
                    <li key={s.id}>
                      <Link to={`/drawings/${s.id}`} className="text-indigo-700 hover:underline">{directory[s.id]?.name ?? s.id}</Link>
                      <span className="ml-2 text-xs text-slate-500">{t('ai.cohort.similarity', { value: Math.round(s.similarity * 100) })}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {output.result.map && <CohortMap map={output.result.map} directory={directory} highlightId={drawingId} />}
            </div>
          </AiBox>
        )
      }}
    </Section>
  )
}

// --- AI-11: stroke groups ---

function GroupsContent({ result, selected, onSelect }: { result: AiGroups; selected: string | null; onSelect: (groupId: string | null, strokeIds: string[]) => void }) {
  const { t } = useTranslation()
  if (result.groups.length === 0) return <p className="text-sm text-slate-500">{t('ai.groups.none')}</p>
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">{t('ai.groups.summary', { groups: result.groups.length, ungrouped: result.unclustered.length })}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-medium">{t('ai.groups.group')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('ai.groups.strokes')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('ai.groups.ink')}</th>
              <th className="px-3 py-1.5 font-medium">{t('ai.groups.size')}</th>
              <th className="px-3 py-1.5 font-medium">{t('ai.groups.colours')}</th>
              <th className="py-1.5 pl-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.groups.map((group) => (
              <tr key={group.id} className={cn(group.id === selected && 'bg-amber-50')}>
                <td className="py-1.5 pr-3 font-medium text-slate-900">{t('ai.groups.name', { id: group.id })}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{group.strokeCount}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(group.inkShare * 100)} %</td>
                <td className="px-3 py-1.5 tabular-nums">{group.size.map((s) => Math.round(s * 100)).join(' × ')} cm</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex gap-1">
                    {group.colours.map((c) => <span key={c.hex} title={`${c.hex} ${Math.round(c.share * 100)} %`} className="inline-block h-3.5 w-3.5 rounded border border-slate-300" style={{ background: c.hex }} />)}
                  </span>
                </td>
                <td className="py-1.5 pl-3 text-right">
                  <Button variant="secondary" className="px-2 py-0.5 text-xs" aria-pressed={group.id === selected} onClick={() => onSelect(group.id === selected ? null : group.id, group.strokeIds)}>
                    {group.id === selected ? t('ai.groups.clear') : t('ai.groups.show')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.truncated && <p className="text-xs text-slate-500">{t('ai.groups.truncated')}</p>}
    </div>
  )
}

function GroupsSection({ drawingId, selected, onSelect }: { drawingId: string; selected: string | null; onSelect: (groupId: string | null, strokeIds: string[]) => void }) {
  const { t } = useTranslation()
  const query = useAiGroups(drawingId)
  return (
    <Section query={query}>
      {(output) => <AiBox title={t('ai.groups.title')} output={output} drawingId={drawingId}><GroupsContent result={output.result} selected={selected} onSelect={onSelect} /></AiBox>}
    </Section>
  )
}

// --- The panel ---

export function AiDrawingPanel({ drawingId, onHighlight }: {
  drawingId: string
  /** The strokes to emphasise in the viewer (an empty list clears it). */
  onHighlight: (strokeIds: string[]) => void
}) {
  const { t } = useTranslation()
  const status = useAiStatus()
  const [scope, setScope] = useState<AiScope>('gameType')
  const [group, setGroup] = useState<string | null>(null)
  const select = (groupId: string | null, strokeIds: string[]) => {
    setGroup(groupId)
    onHighlight(groupId ? strokeIds : [])
  }
  const selectClass = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'

  const switchedOff = status.data && !status.data.enabled
  return (
    <Card
      title={t('ai.panel.title')}
      subtitle={t('ai.panel.subtitle')}
      className="border-violet-200"
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t('ai.panel.compareWith')}
          <select className={selectClass} value={scope} onChange={(e) => setScope(e.target.value as AiScope)}>
            {SCOPES.map((s) => <option key={s} value={s}>{t(`ai.scope.${s}`)}</option>)}
          </select>
        </label>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">{t('ai.panel.banner')}</p>
        {switchedOff ? (
          <p className="text-sm text-slate-600">{t('ai.panel.switchedOff')}</p>
        ) : (
          <>
            <IndicatorsSection drawingId={drawingId} scope={scope} />
            <CohortSection drawingId={drawingId} scope={scope} />
            <GroupsSection drawingId={drawingId} selected={group} onSelect={select} />
            <HeavySection drawingId={drawingId} feature="labels" title={t('ai.labels.title')}
              render={(result) => <LabelsContent result={result} selectedGroup={group} onSelectGroup={select} />} />
            <HeavySection drawingId={drawingId} feature="description" title={t('ai.description.title')}
              render={(result) => <DescriptionContent result={result} />} />
            <HeavySection drawingId={drawingId} feature="summary" title={t('ai.summary.title')}
              render={(result) => <SummaryContent result={result} />} />
          </>
        )}
        <p className="text-xs text-slate-500">
          {t('ai.panel.settingsHint')} <Link to="/ai" className="underline">{t('ai.openSettings')}</Link>
        </p>
      </div>
    </Card>
  )
}
