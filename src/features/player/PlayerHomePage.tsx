import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePlayerDrawings, usePlayerInfos, useSessionsByIds } from '@/api/hooks'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { useAuth } from '@/auth/authContext'
import { DrawingCard } from '@/features/drawings/DrawingCard'
import { displayName, formatDateTime } from '@/lib/format'

/**
 * The player's own records and nothing else (requirements ACC-02, PLY-01..03): the info stored about them, the
 * sessions they drew in, and their drawings.
 */
export function PlayerHomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const playerId = user?.playerId
  const drawings = usePlayerDrawings(playerId)
  const infos = usePlayerInfos(playerId ? [playerId] : [])
  const info = playerId ? infos.data?.get(playerId) : undefined

  const sessionIds = useMemo(() => [...new Set((drawings.data ?? []).map((d) => d.sessionID))], [drawings.data])
  const sessions = useSessionsByIds(sessionIds)
  const sessionName = (id: string) => sessions.data?.find((s) => s.id === id)?.name

  return (
    <>
      <PageHeader title={t('player.title')} subtitle={t('player.subtitle')} />
      <div className="space-y-6">
        <Card title={t('player.info')} actions={<Link to="/my/profile" className={buttonClass('secondary', 'px-2 py-1 text-xs')}>{t('profile.edit')}</Link>}>
          {info ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              {([
                [t('participants.name'), displayName(info, info.id)],
                [t('participants.age'), info.age ?? '-'],
                [t('participants.gender'), info.gender ?? '-'],
                [t('participants.dominantHand'), info.dominantHand ?? '-'],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">{t('common.loading')}</p>
          )}
        </Card>

        <Card title={t('player.sessions')}>
          <QueryBoundary query={sessions} isEmpty={(items) => items.length === 0} empty={<EmptyState title={t('player.noSessions')} />}>
            {(items) => (
              <ul className="divide-y divide-slate-100">
                {items.map((session) => (
                  <li key={session.id} className="py-2.5 text-sm">
                    <p className="font-medium text-slate-900">{session.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(session.startDate)}{session.description ? ` · ${session.description}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        </Card>

        <Card title={t('player.drawings')}>
          <QueryBoundary query={drawings} isEmpty={(items) => items.length === 0} empty={<EmptyState title={t('player.noDrawings')} />}>
            {(items) => (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((meta) => (
                  <DrawingCard key={meta.id} meta={meta} to={`/my/drawings/${meta.id}`} subtitle={sessionName(meta.sessionID)} />
                ))}
              </div>
            )}
          </QueryBoundary>
        </Card>
      </div>
    </>
  )
}
