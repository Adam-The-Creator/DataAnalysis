import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePlayerList } from '@/api/hooks'
import { Role } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { displayName } from '@/lib/format'

/** The participants (requirement PAR-01). Every row opens the participant's page with the history and the trends. */
export function ParticipantsPage() {
  const { t } = useTranslation()
  const players = usePlayerList()

  return (
    <>
      <PageHeader title={t('participants.title')} subtitle={t('participants.subtitle')} />
      <QueryBoundary query={players}>
        {(list) => {
          const participants = list.filter((p) => p.role === Role.Player)
          return (
            <Card bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('participants.name')}</th>
                      <th className="px-4 py-3 font-medium">{t('participants.age')}</th>
                      <th className="px-4 py-3 font-medium">{t('participants.gender')}</th>
                      <th className="px-4 py-3 font-medium">{t('participants.dominantHand')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participants.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link to={`/participants/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                            {displayName(p.info, p.id)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{p.info.age ?? '–'}</td>
                        <td className="px-4 py-3">{p.info.gender ?? '–'}</td>
                        <td className="px-4 py-3">{p.info.dominantHand ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }}
      </QueryBoundary>
    </>
  )
}
