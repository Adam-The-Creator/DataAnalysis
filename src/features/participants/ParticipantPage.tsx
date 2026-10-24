import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useParticipantHistory } from '@/api/hooks'
import type { HistoryRow, MetricId, ParticipantHistory } from '@/api/types'
import { LineChart } from '@/components/charts/LineChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { ReportButton } from '@/features/reports/ReportButton'
import { displayName, formatDate, formatDateTime } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { formatMetricValue, metricCatalog, metricDef } from '@/lib/metricCatalog'

/** The metrics that are offered for the trend chart and shown with a sparkline. */
const TREND_METRICS: MetricId[] = [
  'totalLength', 'strokesDrawn', 'activeTime', 'meanSpeed', 'idleTime', 'boundingVolume', 'meanPressure',
  'leftHandShare', 'warmShare', 'distinctColours', 'eraseRatio', 'toolChanges',
]

/** A participant over time: the numbers of every metric from the first to the latest drawing, with a trend line. */
export function TrendTable({ rows }: { rows: HistoryRow[] }) {
  const { t } = useTranslation()
  const lines = TREND_METRICS.flatMap((id) => {
    const values = rows.map((r) => r.metrics[id]).filter((v): v is number => v != null)
    return values.length >= 2 ? [{ id, values }] : []
  })
  if (lines.length === 0) return <p className="text-sm text-slate-500">{t('participant.noTrends')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4 font-medium">{t('report.metric')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('report.columns.first')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('report.columns.latest')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('report.columns.change')}</th>
            <th className="py-2 pl-3 font-medium">{t('report.columns.trend')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map(({ id, values }) => {
            const [first, last] = [values[0], values[values.length - 1]]
            const def = metricDef(id)
            const change = first !== 0 ? `${last - first >= 0 ? '+' : '−'}${Math.abs(((last - first) / Math.abs(first)) * 100).toFixed(0)} %` : t('common.notAvailable')
            return (
              <tr key={id}>
                <td className="py-2 pr-4 text-slate-700">{t(`metrics.${id}.name`)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetricValue(def, first)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMetricValue(def, last)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{change}</td>
                <td className="py-2 pl-3"><Sparkline values={values} ariaLabel={t('participant.sparkline', { metric: t(`metrics.${id}.name`) })} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ParticipantContent({ history }: { history: ParticipantHistory }) {
  const { t } = useTranslation()
  const { player, playerId } = history
  const gameTypes = useMemo(() => [...new Set(history.drawings.map((d) => d.meta.gameType))].sort(), [history.drawings])
  // The game type with the most drawings is where a trend says most
  const busiest = useMemo(
    () => gameTypes.slice().sort((a, b) => history.drawings.filter((d) => d.meta.gameType === b).length - history.drawings.filter((d) => d.meta.gameType === a).length)[0],
    [gameTypes, history.drawings],
  )
  const [gameType, setGameType] = useState<number | 'all'>('all')
  const [trendType, setTrendType] = useState<number | null>(busiest ?? null)
  const [metric, setMetric] = useState<MetricId>('totalLength')

  const shown = history.drawings.filter((d) => gameType === 'all' || d.meta.gameType === gameType)
  const trendRows = history.drawings.filter((d) => trendType === null || d.meta.gameType === trendType)
  const points = trendRows.flatMap((r) => (r.metrics[metric] != null ? [{ label: formatDate(r.date), value: r.metrics[metric] as number }] : []))
  const def = metricDef(metric)
  const select = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/participants" className="hover:text-indigo-700">← {t('participants.title')}</Link>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {displayName(player, playerId)}
            {player.age != null && <Badge tone="slate">{t('participant.age', { age: player.age })}</Badge>}
            {player.gender && <Badge tone="slate">{player.gender}</Badge>}
            {player.dominantHand && <Badge tone="slate">{t('participant.hand', { hand: player.dominantHand })}</Badge>}
          </span>
        }
        subtitle={t('participant.subtitle', { count: history.drawings.length })}
        actions={
          <>
            <Link to={`/compare?mode=time&p=${playerId}`} className={buttonClass('secondary')}>{t('participant.compareOverTime')}</Link>
            <ReportButton kind="participant" targetId={playerId} />
          </>
        }
      />

      <div className="space-y-6">
        <Card
          title={t('participant.trends')}
          subtitle={t('participant.trendsHint')}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
              <label>
                {t('sessions.gameType')}{' '}
                <select className={select} value={trendType ?? 'all'} onChange={(e) => setTrendType(e.target.value === 'all' ? null : Number(e.target.value))}>
                  <option value="all">{t('sessionDetail.all')}</option>
                  {gameTypes.map((id) => <option key={id} value={id}>{gameTypeLabel(t, id)}</option>)}
                </select>
              </label>
              <label>
                {t('report.metric')}{' '}
                <select className={select} value={metric} onChange={(e) => setMetric(e.target.value as MetricId)}>
                  {metricCatalog.map((m) => <option key={m.id} value={m.id}>{t(`metrics.${m.id}.name`)}</option>)}
                </select>
              </label>
            </div>
          }
        >
          {points.length === 0 ? (
            <EmptyState title={t('participant.noPoints')} />
          ) : (
            <div className="space-y-5">
              <LineChart points={points} ariaLabel={t('participant.chartLabel', { metric: t(`metrics.${metric}.name`) })} format={(v) => formatMetricValue(def, v)} />
              {trendType === null && gameTypes.length > 1 && <p className="text-xs text-amber-800">{t('participant.mixedTypes')}</p>}
              <TrendTable rows={trendRows} />
            </div>
          )}
        </Card>

        <Card
          title={t('participant.drawings')}
          actions={
            <label className="text-sm text-slate-600">
              {t('sessions.gameType')}{' '}
              <select className={select} value={gameType} onChange={(e) => setGameType(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">{t('sessionDetail.all')}</option>
                {gameTypes.map((id) => <option key={id} value={id}>{gameTypeLabel(t, id)}</option>)}
              </select>
            </label>
          }
          bodyClassName="p-0"
        >
          {shown.length === 0 ? (
            <div className="p-4"><EmptyState title={t('participant.noDrawings')} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('report.columns.date')}</th>
                    <th className="px-4 py-3 font-medium">{t('report.columns.drawing')}</th>
                    <th className="px-4 py-3 font-medium">{t('report.columns.session')}</th>
                    <th className="px-4 py-3 font-medium">{t('sessions.gameType')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('metrics.strokesDrawn.name')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('metrics.totalLength.name')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('metrics.activeTime.name')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('analysis.flags')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((row) => {
                    const cell = (id: MetricId) => (row.metrics[id] != null ? formatMetricValue(metricDef(id), row.metrics[id] as number) : '–')
                    return (
                      <tr key={row.meta.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(row.date)}</td>
                        <td className="px-4 py-3"><Link to={`/drawings/${row.meta.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{row.meta.name}</Link></td>
                        <td className="px-4 py-3 text-slate-600">{row.sessionName}</td>
                        <td className="px-4 py-3"><Badge tone="indigo">{gameTypeLabel(t, row.meta.gameType)}</Badge></td>
                        <td className="px-4 py-3 text-right tabular-nums">{cell('strokesDrawn')}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{cell('totalLength')}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{cell('activeTime')}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.flags.length > 0 ? <Badge tone="amber">{row.flags.length}</Badge> : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

/** One participant (requirement PAR-01): the drawings across all sessions and the metric trends over time. */
export function ParticipantPage() {
  const { playerId } = useParams()
  const history = useParticipantHistory(playerId)
  return <QueryBoundary query={history}>{(data) => <ParticipantContent key={data.playerId} history={data} />}</QueryBoundary>
}
