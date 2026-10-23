import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCreateReport, useDeleteReport, useReports } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorView, QueryBoundary } from '@/components/ui/states'
import { formatIsoDateTime } from '@/lib/format'
import { openReport } from '@/lib/openReport'

/** Stored reports: open, regenerate (when stale or on demand) and delete (requirement REP-04). */
export function ReportsPage() {
  const { t } = useTranslation()
  const reports = useReports()
  const create = useCreateReport()
  const remove = useDeleteReport()
  const failure = create.error ?? remove.error

  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      {failure && <div className="mb-4"><ErrorView error={failure} /></div>}

      <QueryBoundary
        query={reports}
        isEmpty={(items) => items.length === 0}
        empty={<Card><p className="py-6 text-center text-sm text-slate-500">{t('reports.empty')}</p></Card>}
      >
        {(items) => (
          <Card bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('reports.columns.title')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.columns.kind')}</th>
                    <th className="px-4 py-3 font-medium">{t('reports.columns.created')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('reports.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((report) => (
                    <tr key={report.id}>
                      <td className="px-4 py-3">
                        <Link
                          to={report.kind === 'drawing' ? `/drawings/${report.targetId}` : `/sessions/${report.targetId}`}
                          className="font-medium text-slate-900 hover:text-indigo-700"
                        >
                          {report.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Badge tone="indigo">{t(`reports.kinds.${report.kind}`)}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatIsoDateTime(report.createdAt)}
                        {report.stale && <Badge tone="amber" className="ml-2">{t('reports.stale')}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => void openReport(report.id)}>{t('reports.open')}</Button>
                          <Button
                            variant={report.stale ? 'primary' : 'secondary'}
                            disabled={create.isPending}
                            onClick={() => create.mutate({ kind: report.kind, targetId: report.targetId, regenerate: true })}
                          >
                            {t('reports.regenerate')}
                          </Button>
                          <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(report.id)}>{t('reports.delete')}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryBoundary>
    </>
  )
}
