import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAiHeavy, useCancelAiJob, useDiscardAi, useStartAi } from '@/api/hooks'
import type { AiHeavyFeature, AiResultTypes } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorView, LoadingBlock } from '@/components/ui/states'
import { describeError } from '@/lib/describeError'
import { AiBadge, AiBox } from './AiBox'

/**
 * A function that needs a model and runs as a background job (requirements AI-02, AI-12, AI-13, AI-16): a button starts
 * it, a progress bar follows it, it can be cancelled, and the result is stored and shown in the AI frame. A stored
 * result stays visible when it is out of date, marked as such, so the psychologist always knows what it was made from.
 */
export function HeavySection<F extends AiHeavyFeature>({ drawingId, feature, title, render }: {
  drawingId: string
  feature: F
  title: string
  render: (result: AiResultTypes[F]) => ReactNode
}) {
  const { t } = useTranslation()
  const state = useAiHeavy(drawingId, feature)
  const start = useStartAi(drawingId, feature)
  const cancel = useCancelAiJob(drawingId, feature)
  const discard = useDiscardAi(drawingId, feature)
  const [confirming, setConfirming] = useState(false)

  if (state.isPending) return <LoadingBlock />
  if (state.isError) return <ErrorView error={state.error} onRetry={() => void state.refetch()} />

  const { result, job, available, reason, stale } = state.data
  const running = job?.status === 'queued' || job?.status === 'running'
  const failed = job?.status === 'failed' && (!result || result.generatedAt < (job.finishedAt ?? ''))

  const runButton = (regenerate: boolean, label: string) => (
    <Button variant={regenerate ? 'secondary' : 'primary'} className={regenerate ? 'px-2 py-1 text-xs' : undefined}
      disabled={!available || running || start.isPending} onClick={() => start.mutate(regenerate)}>
      {label}
    </Button>
  )

  const progress = running && job && (
    <div className="space-y-2" role="status">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
        <span>{job.message || t('ai.job.working')}</span>
        <Button variant="secondary" className="px-2 py-1 text-xs" disabled={cancel.isPending} onClick={() => cancel.mutate(job.id)}>{t('ai.job.cancel')}</Button>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)}>
        <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </div>
      <p className="text-xs text-slate-500">{t('ai.job.hint')}</p>
    </div>
  )

  const problem = (failed && job?.error) || start.isError
  const problemText = failed && job?.error ? job.error : start.isError ? describeError(t, start.error) : null

  if (!result) {
    return (
      <section className="rounded-xl border-2 border-dashed border-violet-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AiBadge />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-600">{t(`ai.${feature}.about`)}</p>
        <div className="mt-3 space-y-2">
          {progress}
          {problem && problemText && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{problemText}</p>}
          {!available && (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t(`ai.reasons.${reason ?? 'failed'}`)}{' '}
              <Link to="/ai" className="font-medium underline">{t('ai.openSettings')}</Link>
            </p>
          )}
          {!running && runButton(false, failed ? t('ai.job.retry') : t('ai.job.run'))}
        </div>
      </section>
    )
  }

  return (
    <>
      <AiBox
        title={title} output={result} drawingId={drawingId}
        actions={
          <div className="flex gap-1.5">
            {runButton(true, t('ai.job.regenerate'))}
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setConfirming(true)}>{t('ai.job.discard')}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {stale && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('ai.job.stale')}</p>}
          {progress}
          {problem && problemText && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{problemText}</p>}
          {result.result && render(result.result)}
        </div>
      </AiBox>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('ai.job.discardTitle')}>
        <p className="text-sm text-slate-700">{t('ai.job.discardBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={discard.isPending} onClick={() => discard.mutate(undefined, { onSettled: () => setConfirming(false) })}>
            {t('ai.job.discard')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
