import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import {
  useActiveSessionId, usePlayerInfos, useSession, useSessionDrawings, useSessionStats,
} from '@/api/hooks'
import type { DrawingMeta, Session, SessionStats } from '@/api/types'
import { RangeBar } from '@/components/charts/RangeBar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlannedPanel } from '@/components/ui/PlannedPanel'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { SessionStatusBadge } from '@/components/ui/StatusBadges'
import { DrawingCard } from '@/features/drawings/DrawingCard'
import { ReportButton } from '@/features/reports/ReportButton'
import { displayName, formatDateTime, sessionStatus } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { formatMetricValue, metricDef } from '@/lib/metricCatalog'

/** Session detail: info, participants, statistics and the drawing gallery (requirements SES-02..04). */
export function SessionDetailPage() {
  const { sessionId } = useParams()
  const session = useSession(sessionId)

  return (
    <QueryBoundary query={session}>
      {(data) => <SessionContent session={data} />}
    </QueryBoundary>
  )
}

function SessionContent({ session }: { session: Session }) {
  const { t } = useTranslation()
  const active = useActiveSessionId()
  const drawings = useSessionDrawings(session.id)
  const status = sessionStatus(session, active.data)

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/sessions" className="hover:text-indigo-700">← {t('sessions.title')}</Link>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {session.name}
            <SessionStatusBadge status={status} />
            {session.multiplayer === 1 && <Badge tone="sky">{t('sessions.multiplayer')}</Badge>}
          </span>
        }
        subtitle={session.description ?? undefined}
        actions={<ReportButton kind="session" targetId={session.id} />}
      />

      <div className="space-y-6">
        <Card>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('sessionDetail.started')}</dt>
              <dd className="mt-0.5 text-slate-900">{formatDateTime(session.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('sessionDetail.ended')}</dt>
              <dd className="mt-0.5 text-slate-900">{session.endDate ? formatDateTime(session.endDate) : t('status.open')}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('sessionDetail.figures')}</dt>
              <dd className="mt-0.5 text-slate-900">
                {[session.showBoy ? t('sessionDetail.boy') : null, session.showGirl ? t('sessionDetail.girl') : null]
                  .filter(Boolean).join(', ') || t('common.none')}
              </dd>
            </div>
          </dl>
        </Card>

        <QueryBoundary query={drawings} isEmpty={(items) => items.length === 0} empty={<Card><EmptyState title={t('sessionDetail.noDrawings')} /></Card>}>
          {(metas) => <SessionBody session={session} metas={metas} />}
        </QueryBoundary>

        <PlannedPanel ids={['SES-05']} />
      </div>
    </>
  )
}

function SessionBody({ session, metas }: { session: Session; metas: DrawingMeta[] }) {
  const { t } = useTranslation()
  const playerIds = useMemo(() => [...new Set(metas.map((m) => m.playerID))], [metas])
  const infos = usePlayerInfos(playerIds)
  const stats = useSessionStats(session.id)
  const nameOf = (id: string) => displayName(infos.data?.get(id), id)

  const [participant, setParticipant] = useState('all')
  const [gameType, setGameType] = useState('all')
  const gameTypes = [...new Set(metas.map((m) => m.gameType))].sort()
  const shown = metas.filter(
    (m) => (participant === 'all' || m.playerID === participant) && (gameType === 'all' || m.gameType === Number(gameType)),
  )
  const select = 'ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'

  return (
    <>
      <Card title={t('sessionDetail.participants')} subtitle={t('sessionDetail.participantsHint')} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('participants.name')}</th>
                <th className="px-4 py-2.5 font-medium">{t('participants.age')}</th>
                <th className="px-4 py-2.5 font-medium">{t('participants.gender')}</th>
                <th className="px-4 py-2.5 font-medium">{t('participants.dominantHand')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('sessions.columns.drawings')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {playerIds.map((id) => {
                const info = infos.data?.get(id)
                return (
                  <tr key={id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{nameOf(id)}</td>
                    <td className="px-4 py-2.5">{info?.age ?? '–'}</td>
                    <td className="px-4 py-2.5">{info?.gender ?? '–'}</td>
                    <td className="px-4 py-2.5">{info?.dominantHand ?? '–'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{metas.filter((m) => m.playerID === id).length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('sessionDetail.statistics')} subtitle={t('sessionDetail.statisticsHint')}>
        <QueryBoundary query={stats}>{(data) => <StatisticsTables stats={data} nameOf={nameOf} />}</QueryBoundary>
      </Card>

      <Card
        title={t('sessionDetail.gallery', { count: shown.length })}
        actions={
          <div className="flex flex-wrap items-center justify-end text-sm text-slate-600">
            <label>
              {t('sessionDetail.filterParticipant')}
              <select className={select} value={participant} onChange={(e) => setParticipant(e.target.value)}>
                <option value="all">{t('sessionDetail.all')}</option>
                {playerIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
            </label>
            <label className="ml-3">
              {t('sessions.gameType')}
              <select className={select} value={gameType} onChange={(e) => setGameType(e.target.value)}>
                <option value="all">{t('sessionDetail.all')}</option>
                {gameTypes.map((id) => <option key={id} value={id}>{gameTypeLabel(t, id)}</option>)}
              </select>
            </label>
          </div>
        }
      >
        {shown.length === 0 ? (
          <EmptyState title={t('sessionDetail.noMatch')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((meta) => (
              <DrawingCard key={meta.id} meta={meta} to={`/drawings/${meta.id}`} subtitle={nameOf(meta.playerID)} />
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

/** The distribution of every metric over the session's drawings, and a table per participant (requirement SES-03). */
function StatisticsTables({ stats, nameOf }: { stats: SessionStats; nameOf: (id: string) => string }) {
  const { t } = useTranslation()
  const columns = ['strokesDrawn', 'totalLength', 'activeTime', 'meanSpeed', 'leftHandShare'] as const

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">{t('report.metric')}</th>
              <th className="px-4 py-2 font-medium">{t('statistics.range')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('report.min')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('report.median')}</th>
              <th className="py-2 pl-4 text-right font-medium">{t('report.max')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.distributions.map((d) => {
              const def = metricDef(d.id)
              const name = t(`metrics.${d.id}.name`)
              return (
                <tr key={d.id}>
                  <td className="py-2 pr-4 text-slate-700">{name}{d.count < stats.drawingCount && <span className="ml-1 text-xs text-slate-400">({d.count}/{stats.drawingCount})</span>}</td>
                  <td className="w-40 px-4 py-2">
                    <RangeBar min={d.min} median={d.median} max={d.max} ariaLabel={t('statistics.rangeLabel', { metric: name })} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMetricValue(def, d.min)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">{formatMetricValue(def, d.median)}</td>
                  <td className="py-2 pl-4 text-right tabular-nums">{formatMetricValue(def, d.max)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('statistics.perParticipant')}</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">{t('participants.name')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('sessions.columns.drawings')}</th>
              {columns.map((id) => <th key={id} className="px-4 py-2 text-right font-medium">{t(`metrics.${id}.name`)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.perParticipant.map((row) => (
              <tr key={row.playerId}>
                <td className="py-2 pr-4 font-medium text-slate-900">{nameOf(row.playerId)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.drawings}</td>
                {columns.map((id) => {
                  const value = row.metrics[id]
                  return <td key={id} className="px-4 py-2 text-right tabular-nums">{value == null ? '–' : formatMetricValue(metricDef(id), value)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
