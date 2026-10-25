import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuestionnaireResults } from '@/api/hooks'
import type {
  AgeBand, CountingRule, FeedbackTarget, ResultFilters, ResultGroup, SenderRole, SmileyStats, SusStats, TrendPoint, UeqStats,
} from '@/api/types'
import { BarList } from '@/components/charts/BarList'
import { LineChart } from '@/components/charts/LineChart'
import { ScaleChart } from '@/components/charts/ScaleChart'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { StatTile } from '@/components/ui/StatTile'
import { ageBandLabel, instrumentName, senderRoleLabel, subjectLabel, targetLabel } from '@/lib/feedbackLabels'
import { formatDate, formatNumber } from '@/lib/format'
import type { SmileyItemId, SusItemId, UeqItemId } from '@/lib/instruments'
import { FACES } from '../feedback/faces'
import { QuestionnaireExport } from './ExportMenu'
import { FilterDate, FilterSelect } from './FilterSelect'

interface FilterState {
  target: '' | FeedbackTarget
  role: '' | '0' | '1'
  ageBand: '' | AgeBand
  version: string
  dateFrom: string
  dateTo: string
  counting: CountingRule
}

const noFilters: FilterState = { target: '', role: '', ageBand: '', version: '', dateFrom: '', dateTo: '', counting: 'latest' }

function toFilters(state: FilterState): ResultFilters {
  return {
    counting: state.counting,
    ...(state.target ? { target: state.target } : {}),
    ...(state.role ? { role: Number(state.role) as SenderRole } : {}),
    ...(state.ageBand ? { ageBand: state.ageBand } : {}),
    ...(state.version ? { version: Number(state.version) } : {}),
    ...(state.dateFrom ? { dateFrom: state.dateFrom } : {}),
    ...(state.dateTo ? { dateTo: state.dateTo } : {}),
  }
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value, 2)}`

/**
 * The results of the questionnaires (requirements ADM-06..ADM-10): per questionnaire, target and sender role, with the
 * scores of SUS and UEQ and the faces of the smiley rating. A group with too few submissions shows only its size. The
 * counting rule chooses between one submission per person and every submission, because people can send again.
 */
export function QuestionnaireResultsTab() {
  const { t } = useTranslation()
  const [state, setState] = useState<FilterState>(noFilters)
  const filters = toFilters(state)
  const results = useQuestionnaireResults(filters)
  const set = <K extends keyof FilterState>(key: K) => (value: string) => setState((s) => ({ ...s, [key]: value as FilterState[K] }))

  // The versions to choose from: those in the answer, and the chosen one (so it can be left again)
  const versions = [...new Set([...(results.data?.groups.flatMap((g) => g.versions) ?? []), ...(state.version ? [Number(state.version)] : [])])].sort()

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label={t('admin.feedback.filters.target')} value={state.target} onChange={set('target')} allLabel={t('admin.feedback.all')}
            options={(['game', 'webapp'] as const).map((value) => ({ value, label: targetLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.role')} value={state.role} onChange={set('role')} allLabel={t('admin.feedback.all')}
            options={([0, 1] as const).map((value) => ({ value: String(value), label: senderRoleLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.ageBand')} value={state.ageBand} onChange={set('ageBand')} allLabel={t('admin.feedback.all')}
            options={(['child', 'teen', 'adult', 'unknown'] as const).map((value) => ({ value, label: ageBandLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.version')} value={state.version} onChange={set('version')} allLabel={t('admin.feedback.all')}
            options={versions.map((v) => ({ value: String(v), label: String(v) }))}
          />
          <FilterDate label={t('admin.feedback.filters.from')} value={state.dateFrom} onChange={set('dateFrom')} />
          <FilterDate label={t('admin.feedback.filters.to')} value={state.dateTo} onChange={set('dateTo')} />
          <label className="flex flex-col text-xs font-medium text-slate-600">
            {t('admin.feedback.filters.counting')}
            <select
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500"
              value={state.counting}
              onChange={(e) => set('counting')(e.target.value)}
            >
              {(['latest', 'all'] as const).map((rule) => <option key={rule} value={rule}>{t(`admin.feedback.counting.${rule}`)}</option>)}
            </select>
          </label>
          <Button variant="ghost" onClick={() => setState(noFilters)}>{t('admin.feedback.filters.clear')}</Button>
          <div className="ml-auto"><QuestionnaireExport filters={filters} /></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('admin.feedback.countingHint')}</p>
      </Card>

      <QueryBoundary query={results} isEmpty={(data) => data.groups.length === 0} empty={<EmptyState title={t('admin.results.empty')} />}>
        {(data) => (
          <>
            <p className="text-sm text-slate-600">{t('admin.results.summary', { counted: data.counted, total: data.submissions })}</p>
            {data.groups.map((group) => (
              <GroupCard
                key={`${group.instrument}-${group.target}-${group.role}`}
                group={group}
                minGroupSize={data.minGroupSize}
                trend={data.trend.filter((p) => p.instrument === group.instrument && p.target === group.target && p.role === group.role)}
              />
            ))}
          </>
        )}
      </QueryBoundary>
    </div>
  )
}

function GroupCard({ group, trend, minGroupSize }: { group: ResultGroup; trend: TrendPoint[]; minGroupSize: number }) {
  const { t } = useTranslation()
  return (
    <Card
      title={`${instrumentName(t, group.instrument)} · ${targetLabel(t, group.target)} · ${senderRoleLabel(t, group.role)}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{t('admin.results.submissions', { count: group.n })} · {t('admin.results.people', { count: group.accounts })}</span>
          {(Object.entries(group.ageBands) as [AgeBand, number][]).map(([band, count]) => (
            <Badge key={band}>{ageBandLabel(t, band)}: {count}</Badge>
          ))}
        </span>
      }
    >
      <div className="space-y-6">
        {!group.enough && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('admin.results.notEnough', { count: group.n, min: minGroupSize })}</p>
        )}
        {group.sus && <SusSection stats={group.sus} target={group.target} />}
        {group.ueq && <UeqSection stats={group.ueq} />}
        {group.smiley && <SmileySection stats={group.smiley} />}
        {trend.length > 0 && <TrendSection trend={trend} instrument={group.instrument} minGroupSize={minGroupSize} />}
      </div>
    </Card>
  )
}

const Heading = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="mb-2">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
)

function SusSection({ stats, target }: { stats: SusStats; target: FeedbackTarget }) {
  const { t } = useTranslation()
  const subject = subjectLabel(t, target)
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label={t('admin.results.mean')} value={formatNumber(stats.mean, 1)} />
        <StatTile label={t('admin.results.sd')} value={formatNumber(stats.sd, 1)} />
        <StatTile label={t('admin.results.median')} value={formatNumber(stats.median, 1)} />
        <StatTile label={t('admin.results.range')} value={`${formatNumber(stats.min, 1)} - ${formatNumber(stats.max, 1)}`} />
      </div>
      <p className="text-xs text-slate-500">{t('admin.results.susReference')}</p>
      <div>
        <Heading title={t('admin.results.histogram')} />
        <BarList ariaLabel={t('admin.results.histogram')} data={stats.histogram.map((b) => ({ label: `${b.from} - ${b.to}`, value: b.count }))} />
      </div>
      <div>
        <Heading title={t('admin.results.susItems')} hint={t('admin.results.susItemsHint')} />
        <ScaleChart
          ariaLabel={t('admin.results.susItems')} min={0} max={4} format={(v) => formatNumber(v, 2)}
          rows={stats.items.map((item) => ({ label: t(`instruments.sus.items.${item.id as SusItemId}`, { subject }), value: item.mean }))}
        />
      </div>
    </>
  )
}

function UeqSection({ stats }: { stats: UeqStats }) {
  const { t } = useTranslation()
  return (
    <>
      <div>
        <Heading title={t('admin.results.ueqScales')} hint={t('admin.results.ueqScalesHint')} />
        <ScaleChart
          ariaLabel={t('admin.results.ueqScales')} min={-3} max={3} format={signed}
          rows={stats.scales.map((s) => ({ label: t(`instruments.ueq.scales.${s.id}`), value: s.mean, low: s.low, high: s.high }))}
        />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-600">{t('admin.results.pragmatic')}</dt><dd className="font-medium tabular-nums">{signed(stats.pragmatic)}</dd></div>
        <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-600">{t('admin.results.hedonic')}</dt><dd className="font-medium tabular-nums">{signed(stats.hedonic)}</dd></div>
      </dl>
      <details>
        <summary className="cursor-pointer text-sm text-slate-700">{t('admin.results.ueqItems')}</summary>
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">{t('admin.results.ueqItemsHint')}</p>
          <ScaleChart
            ariaLabel={t('admin.results.ueqItems')} min={-3} max={3} format={signed}
            rows={stats.items.map((item) => ({ label: uePair(t, item.id as UeqItemId), value: item.mean }))}
          />
        </div>
      </details>
    </>
  )
}

const uePair = (t: TFunction, id: UeqItemId) => `${t(`instruments.ueq.items.${id}.left`)} - ${t(`instruments.ueq.items.${id}.right`)}`

function SmileySection({ stats }: { stats: SmileyStats }) {
  const { t } = useTranslation()
  return (
    <div>
      <Heading title={t('admin.results.mean')} hint={t('admin.results.smileyHint')} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-600">
            <tr>
              <th className="py-1.5 pr-3 font-medium">&nbsp;</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('admin.results.mean')}</th>
              {FACES.map((face, i) => (
                <th key={i} className="px-2 py-1.5 text-center font-medium" title={t(`feedback.faces.${(i + 1) as 1 | 2 | 3 | 4 | 5}`)}>
                  <span aria-hidden="true" className="text-lg">{face}</span>
                  <span className="sr-only">{t('admin.results.faceCount', { face: i + 1 })}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-800">{t(`instruments.smiley.items.${item.id as SmileyItemId}`)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">{formatNumber(item.mean, 2)}</td>
                {item.distribution.map((count, i) => <td key={i} className="px-2 py-2 text-center tabular-nums">{count}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The mean per week. A line for SUS and the smiley rating (which have no negative values), always the table. */
function TrendSection({ trend, instrument, minGroupSize }: { trend: TrendPoint[]; instrument: string; minGroupSize: number }) {
  const { t } = useTranslation()
  return (
    <div>
      <Heading title={t('admin.results.trend')} hint={t('admin.results.trendHint', { min: minGroupSize })} />
      {instrument !== 'UEQ' && trend.length > 1 && (
        <LineChart ariaLabel={t('admin.results.trend')} points={trend.map((p) => ({ label: p.week.slice(5), value: p.mean }))} />
      )}
      <table className="mt-2 w-full max-w-md text-left text-sm">
        <thead className="text-xs text-slate-600">
          <tr>
            <th className="py-1 pr-3 font-medium">{t('admin.results.week')}</th>
            <th className="px-2 py-1 text-right font-medium">{t('admin.results.n')}</th>
            <th className="px-2 py-1 text-right font-medium">{t('admin.results.mean')}</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((p) => (
            <tr key={p.week} className="border-t border-slate-100">
              <td className="py-1 pr-3">{formatDate(`${p.week.replace(/-/g, '.')}-00:00`)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{p.n}</td>
              <td className="px-2 py-1 text-right tabular-nums">{instrument === 'UEQ' ? signed(p.mean) : formatNumber(p.mean, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
