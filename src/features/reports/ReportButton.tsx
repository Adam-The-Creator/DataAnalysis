import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCreateReport } from '@/api/hooks'
import type { ReportKind } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Spinner, ErrorView } from '@/components/ui/states'
import { openReport } from '@/lib/openReport'

/**
 * Generates the report of a drawing or a session on the server and opens it. A stored report is reused instead of
 * regenerated (requirement REP-04), and the message says which of the two happened.
 */
export function ReportButton({ kind, targetId }: { kind: ReportKind; targetId: string }) {
  const { t } = useTranslation()
  const create = useCreateReport()

  async function run() {
    const { report } = await create.mutateAsync({ kind, targetId })
    await openReport(report.id)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="primary" disabled={create.isPending} onClick={() => void run()}>
        {create.isPending && <Spinner className="h-4 w-4 text-white" />}
        {t(kind === 'drawing' ? 'reports.generateDrawing' : kind === 'session' ? 'reports.generateSession' : 'reports.generateParticipant')}
      </Button>
      {create.data && (
        <p className="text-xs text-slate-500" role="status">
          {create.data.reused ? t('reports.reused') : t('reports.created')}{' '}
          <Link to="/reports" className="text-indigo-600 hover:underline">{t('reports.allReports')}</Link>
        </p>
      )}
      {create.isError && (
        <div className="w-80 text-left">
          <ErrorView error={create.error} />
        </div>
      )}
    </div>
  )
}
