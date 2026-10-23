import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useActiveSessionId, useDrawingsOverTime, useOverview, useRecentDrawings } from '@/api/hooks'
import { BarList } from '@/components/charts/BarList'
import { LineChart } from '@/components/charts/LineChart'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { SessionStatusBadge } from '@/components/ui/StatusBadges'
import { StatTile } from '@/components/ui/StatTile'
import { formatDate, formatDateTime, sessionStatus } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'

/** Overview of the sessions with some statistics (requirements DASH-01..03). */
export function DashboardPage() {
  const { t } = useTranslation()
  const overview = useOverview()
  const activeId = useActiveSessionId()
  const overTime = useDrawingsOverTime()
  const recent = useRecentDrawings(5)

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <QueryBoundary query={overview}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label={t('dashboard.sessions')}
                value={data.sessions.total}
                hint={t('dashboard.sessionsHint', { open: data.sessions.open, closed: data.sessions.closed })}
              />
              <StatTile label={t('dashboard.drawings')} value={data.drawings} />
              <StatTile label={t('dashboard.participants')} value={data.participants} />
              <StatTile
                label={t('dashboard.activeSession')}
                value={
                  data.activeSession ? (
                    <Link to={`/sessions/${data.activeSession.id}`} className="text-indigo-700 hover:underline">
                      {data.activeSession.name}
                    </Link>
                  ) : (
                    t('common.none')
                  )
                }
                hint={data.activeSession ? t('dashboard.since', { date: formatDate(data.activeSession.startDate) }) : undefined}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title={t('dashboard.byGameType')}>
                {data.drawingsByGameType.length > 0 ? (
                  <BarList
                    ariaLabel={t('dashboard.byGameType')}
                    data={data.drawingsByGameType.map((d) => ({ label: gameTypeLabel(t, d.gameType), value: d.count }))}
                  />
                ) : (
                  <p className="text-sm text-slate-500">{t('common.empty')}</p>
                )}
              </Card>

              <Card title={t('dashboard.overTime')}>
                <QueryBoundary query={overTime} isEmpty={(points) => points.length === 0}>
                  {(points) => (
                    <LineChart ariaLabel={t('dashboard.overTime')} points={points.map((p) => ({ label: p.date.slice(5), value: p.count }))} />
                  )}
                </QueryBoundary>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card
                title={t('dashboard.recentSessions')}
                actions={<Link to="/sessions" className="text-sm text-indigo-600 hover:underline">{t('common.viewAll')}</Link>}
              >
                <ul className="divide-y divide-slate-100">
                  {data.recentSessions.map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link to={`/sessions/${session.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-700">
                          {session.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(session.startDate)} · {t('dashboard.drawingsCount', { count: session.drawingCount })}
                        </p>
                      </div>
                      <SessionStatusBadge status={sessionStatus(session, activeId.data)} />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title={t('dashboard.recentDrawings')}>
                <QueryBoundary query={recent} isEmpty={(items) => items.length === 0}>
                  {(items) => (
                    <ul className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <li key={item.meta.id} className="py-2.5">
                          <Link to={`/drawings/${item.meta.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-700">
                            {item.meta.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {item.playerName} · {gameTypeLabel(t, item.meta.gameType)} · {formatDateTime(item.date)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </QueryBoundary>
              </Card>
            </div>
          </div>
        )}
      </QueryBoundary>
    </>
  )
}
