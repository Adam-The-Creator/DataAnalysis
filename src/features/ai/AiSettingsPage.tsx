import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiDownload, useAiJobs, useAiModels, useAiRules, useAiStatus, useAiVocabulary } from '@/api/hooks'
import type { AiModelEntry } from '@/api/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { InfoTip } from '@/components/ui/InfoTip'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { describeError } from '@/lib/describeError'
import { AiBadge } from './AiBox'

/**
 * The AI settings page (requirements AI-03, AI-06, AI-07, AI-14): which functions are on, whether they were evaluated with
 * psychologists, every model and library with its version, licence and status, an explicit download of a model, and the
 * rule base and the vocabulary that steer the fuzzy indicators and the labelling. The switches live in the server's
 * configuration (config.py), the rule base and the vocabulary are files on the server: this page shows them.
 */

const statusTone: Record<AiModelEntry['status'], BadgeTone> = {
  installed: 'emerald', notInstalled: 'rose', notDownloaded: 'amber', unreachable: 'amber', invalid: 'rose',
}

function FunctionsCard() {
  const { t } = useTranslation()
  const status = useAiStatus()
  return (
    <Card title={t('ai.settings.functions')} subtitle={t('ai.settings.functionsHint')} bodyClassName="p-0">
      <QueryBoundary query={status}>
        {(info) => (
          <>
            {!info.enabled && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{t('ai.settings.allOff')}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('ai.settings.function')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('ai.settings.switch')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('ai.settings.evaluation')} <InfoTip text={t('ai.settings.evaluationHint')} /></th>
                    <th className="px-4 py-2.5 font-medium">{t('ai.settings.availability')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {info.features.map((feature) => (
                    <tr key={feature.id}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-900">{t(`ai.features.${feature.id}`)}</span>
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={feature.enabled ? 'emerald' : 'slate'}>{feature.enabled ? t('ai.settings.on') : t('ai.settings.off')}</Badge></td>
                      <td className="px-4 py-2.5"><Badge tone={feature.evaluated ? 'emerald' : 'amber'}>{feature.evaluated ? t('ai.settings.evaluated') : t('ai.settings.notEvaluated')}</Badge></td>
                      <td className="px-4 py-2.5">
                        {!feature.enabled
                          ? <span className="text-slate-500">{t('ai.reasons.switchedOff')}</span>
                          : feature.available
                            ? <Badge tone="emerald">{t('ai.settings.available')}</Badge>
                            : <span className="text-amber-800">{t(`ai.reasons.${feature.reason ?? 'failed'}`)}{feature.detail ? ` (${feature.detail})` : ''}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{t('ai.settings.switchHint')}</p>
          </>
        )}
      </QueryBoundary>
    </Card>
  )
}

function ModelsCard() {
  const { t } = useTranslation()
  const models = useAiModels()
  const jobs = useAiJobs()
  const download = useAiDownload()
  const [asking, setAsking] = useState<AiModelEntry | null>(null)

  const activeDownload = (id: string) => jobs.data?.find((j) => j.kind === 'download' && j.targetId === id && (j.status === 'queued' || j.status === 'running'))
  const failedDownload = (id: string) => jobs.data?.find((j) => j.kind === 'download' && j.targetId === id && j.status === 'failed')

  return (
    <Card title={t('ai.settings.models')} subtitle={t('ai.settings.modelsHint')} bodyClassName="p-0" actions={<Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => void models.refetch()}>{t('ai.settings.refresh')}</Button>}>
      <QueryBoundary query={models}>
        {(entries) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('ai.settings.model')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('ai.settings.licence')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('ai.settings.status')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('ai.settings.usedBy')}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const running = activeDownload(entry.id)
                  const failed = failedDownload(entry.id)
                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{entry.name}</p>
                        <p className="text-xs text-slate-500">{t(`ai.kinds.${entry.kind}`)} · {entry.version}{entry.sizeHint ? ` · ${entry.sizeHint}` : ''}</p>
                        <p className="text-xs text-slate-400">{entry.source}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-800">{entry.licence}</p>
                        {!entry.licenceChecked && <Badge tone="amber" className="mt-1">{t('ai.settings.licenceUnchecked')}</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusTone[entry.status]}>{t(`ai.settings.modelStatus.${entry.status}`)}</Badge>
                        {entry.statusDetail && <p className="mt-1 max-w-xs text-xs text-slate-600">{entry.statusDetail}</p>}
                        {entry.hint && <p className="mt-1 max-w-xs text-xs text-slate-500">{entry.hint}</p>}
                        {running && (
                          <div className="mt-2 max-w-xs" role="status">
                            <div className="h-2 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(running.progress * 100)}>
                              <div className="h-full bg-violet-600" style={{ width: `${Math.round(running.progress * 100)}%` }} />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{running.message || t('ai.job.working')}</p>
                          </div>
                        )}
                        {failed?.error && !running && <p role="alert" className="mt-1 max-w-xs text-xs text-rose-700">{failed.error}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{entry.usedBy.map((f) => t(`ai.features.${f}`)).join(', ')}</td>
                      <td className="px-4 py-2.5 text-right">
                        {entry.downloadable && !running && <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setAsking(entry)}>{t('ai.settings.download')}</Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
      <Dialog open={asking !== null} onClose={() => setAsking(null)} title={t('ai.settings.downloadTitle', { name: asking?.name ?? '' })}>
        {asking && (
          <>
            <p className="text-sm text-slate-700">{t('ai.settings.downloadBody', { size: asking.sizeHint ?? t('ai.settings.sizeUnknown') })}</p>
            <p className="mt-2 text-sm text-slate-700">{t('ai.settings.downloadLicence', { licence: asking.licence })}</p>
            {!asking.licenceChecked && <p className="mt-2 text-sm text-amber-800">{t('ai.settings.licenceUncheckedLong')}</p>}
            {download.isError && <p role="alert" className="mt-2 text-sm text-rose-700">{describeError(t, download.error)}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAsking(null)}>{t('common.cancel')}</Button>
              <Button disabled={download.isPending} onClick={() => download.mutate(asking.id, { onSuccess: () => setAsking(null) })}>{t('ai.settings.download')}</Button>
            </div>
          </>
        )}
      </Dialog>
    </Card>
  )
}

function RulesCard() {
  const { t } = useTranslation()
  const rules = useAiRules()
  return (
    <Card title={t('ai.settings.rules')} subtitle={t('ai.settings.rulesHint')}>
      <QueryBoundary query={rules}>
        {(info) => info.ruleBase === null ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-medium">{t('ai.settings.rulesInvalid', { file: info.file })}</p>
            <ul className="mt-1 list-disc pl-5">{info.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              {info.ruleBase.name} v{info.ruleBase.version} · <span className="font-mono text-xs">{info.file}</span>{' '}
              <Badge tone={info.ruleBase.status === 'reviewed' ? 'emerald' : 'amber'}>{t(`ai.indicators.status.${info.ruleBase.status}`)}</Badge>
              {info.ruleBase.reviewed && <span className="ml-2 text-slate-600">{t('ai.settings.reviewedBy', { who: info.ruleBase.reviewed })}</span>}
            </p>
            <p className="text-slate-600">{info.ruleBase.description}</p>
            <p className="text-xs text-slate-500">{t('ai.settings.rulesEdit')}</p>
            {info.ruleBase.indicators.map((indicator) => (
              <details key={indicator.id} className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 font-medium text-slate-900">{indicator.name} <span className="font-normal text-slate-500">· {t('ai.settings.ruleCount', { count: indicator.rules.length })}</span></summary>
                <div className="border-t border-slate-100 px-3 py-2">
                  <p className="text-slate-600">{indicator.rationale}</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                    {indicator.rules.map((rule) => (
                      <li key={rule.id}>
                        <span className="font-mono">{rule.id}</span>: {t('ai.indicators.ruleDefinition', { condition: rule.if, level: indicator.levels[rule.then], weight: rule.weight })}
                        <br /><span className="text-slate-500">{rule.rationale}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}

function VocabularyCard() {
  const { t } = useTranslation()
  const vocabulary = useAiVocabulary()
  return (
    <Card title={t('ai.settings.vocabulary')} subtitle={t('ai.settings.vocabularyHint')}>
      <QueryBoundary query={vocabulary}>
        {(info) => info.vocabulary === null ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{info.problem}</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-slate-700">{info.vocabulary.name} v{info.vocabulary.version} · <span className="font-mono text-xs">{info.file}</span></p>
            <p className="flex flex-wrap gap-1.5">
              {info.vocabulary.labels.map((label) => <Badge key={label.id} tone={label.other ? 'amber' : 'slate'}>{label.name}</Badge>)}
            </p>
            <p className="text-xs text-slate-500">{t('ai.settings.vocabularyOther')}</p>
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}

export function AiSettingsPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-3">{t('ai.settings.title')}<AiBadge /></span>} subtitle={t('ai.settings.subtitle')} />
      <div className="space-y-6">
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">{t('ai.settings.principles')}</p>
        <FunctionsCard />
        <ModelsCard />
        <RulesCard />
        <VocabularyCard />
      </div>
    </>
  )
}
