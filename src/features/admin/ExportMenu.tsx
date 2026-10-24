import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '@/api'
import type { CsvDialect, InstrumentId, MessageFilters, ResultFilters } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ErrorView } from '@/components/ui/states'
import { downloadBlob } from '@/lib/download'
import { instrumentName } from '@/lib/feedbackLabels'

/** The file format choice, the same two dialects as the session export (requirement EXP-01, ADM-13). */
function DialectChoice({ dialect, onChange, name }: { dialect: CsvDialect; onChange: (value: CsvDialect) => void; name: string }) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('admin.export.format')}</legend>
      {(['r', 'excel'] as const).map((option) => (
        <label key={option} className="flex items-start gap-2 text-slate-700">
          <input type="radio" name={name} className="mt-1" checked={dialect === option} onChange={() => onChange(option)} />
          <span>{t(`admin.export.${option}`)}<span className="block text-xs text-slate-500">{t(`admin.export.${option}Hint`)}</span></span>
        </label>
      ))}
    </fieldset>
  )
}

/** CSV of the answers and scores of one questionnaire, with the senders as codes (requirement ADM-13). */
export function QuestionnaireExport({ filters }: { filters: ResultFilters }) {
  const { t } = useTranslation()
  const [instrument, setInstrument] = useState<InstrumentId>('SUS')
  const [dialect, setDialect] = useState<CsvDialect>('r')
  const download = useMutation({
    mutationFn: async () => {
      downloadBlob(await getApi().admin.exportQuestionnaires(instrument, dialect, filters), `questionnaire-${instrument.toLowerCase()}-${dialect}.csv`)
    },
  })
  return (
    <Menu label={t('admin.export.button')}>
      <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('admin.export.instrument')}
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-800"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value as InstrumentId)}
        >
          {(['SUS', 'UEQ', 'SMILEY'] as const).map((id) => <option key={id} value={id}>{instrumentName(t, id)}</option>)}
        </select>
      </label>
      <DialectChoice dialect={dialect} onChange={setDialect} name="questionnaire-dialect" />
      <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{t('admin.export.pseudonymised')}</p>
      <Button variant="primary" className="mt-3 w-full" disabled={download.isPending} onClick={() => download.mutate()}>
        {t('admin.export.download')}
      </Button>
      {download.isError && <div className="mt-3"><ErrorView error={download.error} /></div>}
    </Menu>
  )
}

/** CSV of the messages (with the filters of the list). The messages are free text, so the menu says so. */
export function MessageExport({ filters }: { filters: MessageFilters }) {
  const { t } = useTranslation()
  const [dialect, setDialect] = useState<CsvDialect>('r')
  const download = useMutation({
    mutationFn: async () => {
      downloadBlob(await getApi().admin.exportMessages(dialect, filters), `messages-${dialect}.csv`)
    },
  })
  return (
    <Menu label={t('admin.export.button')}>
      <DialectChoice dialect={dialect} onChange={setDialect} name="message-dialect" />
      <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">{t('admin.export.pseudonymised')} {t('admin.export.freeText')}</p>
      <Button variant="primary" className="mt-3 w-full" disabled={download.isPending} onClick={() => download.mutate()}>
        {t('admin.export.download')}
      </Button>
      {download.isError && <div className="mt-3"><ErrorView error={download.error} /></div>}
    </Menu>
  )
}
