import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '@/api'
import type { CsvDialect } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ErrorView } from '@/components/ui/states'
import { downloadBlob, fileSafe } from '@/lib/download'

/** CSV export of a session's metrics for SPSS, R or Excel (requirement EXP-01). It contains personal data, so it says so. */
export function SessionCsvMenu({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const { t } = useTranslation()
  const [dialect, setDialect] = useState<CsvDialect>('r')
  const download = useMutation({
    mutationFn: async () => {
      const blob = await getApi().analysis.exportSessionCsv(sessionId, dialect)
      downloadBlob(blob, `session-${fileSafe(sessionName)}-${dialect}.csv`)
    },
  })

  return (
    <Menu label={t('export.csv')}>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('export.format')}</legend>
        {(['r', 'excel'] as const).map((option) => (
          <label key={option} className="flex items-start gap-2 text-slate-700">
            <input type="radio" name="csv-dialect" className="mt-1" checked={dialect === option} onChange={() => setDialect(option)} />
            <span>{t(`export.dialects.${option}`)}<span className="block text-xs text-slate-500">{t(`export.dialectHints.${option}`)}</span></span>
          </label>
        ))}
      </fieldset>
      <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">{t('export.personalData')}</p>
      <Button variant="primary" className="mt-3 w-full" disabled={download.isPending} onClick={() => download.mutate()}>
        {t('export.download')}
      </Button>
      {download.isError && <div className="mt-3"><ErrorView error={download.error} /></div>}
    </Menu>
  )
}
