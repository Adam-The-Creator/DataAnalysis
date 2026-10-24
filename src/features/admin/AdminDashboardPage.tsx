import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useUsage } from '@/api/hooks'
import { LineChart } from '@/components/charts/LineChart'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { StatTile } from '@/components/ui/StatTile'
import { buttonClass } from '@/components/ui/buttonStyles'

/** The usage numbers of the admin (requirement ADM-05): how many accounts exist and how many used the game. */
export function AdminDashboardPage() {
  const { t } = useTranslation()
  const usage = useUsage()

  return (
    <>
      <PageHeader
        title={t('admin.usage.title')}
        subtitle={t('admin.usage.subtitle')}
        actions={<Link to="/admin/feedback" className={buttonClass('secondary')}>{t('admin.usage.openFeedback')}</Link>}
      />
      <QueryBoundary query={usage}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile
                label={t('admin.usage.registered')}
                value={data.registered.total}
                hint={t('admin.usage.registeredHint', {
                  players: data.registered.players, psychologists: data.registered.psychologists, admins: data.registered.admins,
                })}
              />
              <StatTile
                label={t('admin.usage.usedPlayers')}
                value={data.used.players}
                hint={t('admin.usage.usedOf', { count: data.registered.players })}
              />
              <StatTile
                label={t('admin.usage.usedPsychologists')}
                value={data.used.psychologists}
                hint={t('admin.usage.usedOf', { count: data.registered.psychologists })}
              />
              <StatTile label={t('admin.usage.questionnaires')} value={data.submissions.questionnaires} />
              <StatTile
                label={t('admin.usage.messages')}
                value={data.submissions.messages}
                hint={t('admin.usage.unread', { count: data.submissions.unreadMessages })}
              />
            </div>
            <p className="max-w-3xl text-xs text-slate-500">{t('admin.usage.usedDefinition')}</p>

            <Card title={t('admin.usage.perWeek')}>
              {data.accountsPerWeek.length > 0 ? (
                <LineChart
                  ariaLabel={t('admin.usage.perWeek')}
                  points={data.accountsPerWeek.map((w) => ({ label: w.weekStart.slice(5), value: w.total }))}
                />
              ) : (
                <p className="text-sm text-slate-500">{t('common.empty')}</p>
              )}
            </Card>
          </div>
        )}
      </QueryBoundary>
    </>
  )
}
