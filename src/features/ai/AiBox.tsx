import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAiViewImage } from '@/api/hooks'
import type { AiEvidence, AiOutput } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatIsoDateTime } from '@/lib/format'

/**
 * THE marking of every AI output (requirements AI-04, AI-05, SC-07). One component, used for all of them, so nothing
 * AI-generated can be shown without it: a violet frame that no other part of the app uses, the "AI-generated" badge, the
 * sentence that it is decision support and not a diagnosis and has to be reviewed by a psychologist, a note while the
 * function was not yet evaluated with psychologists (AI-07), and the provenance (model, parameters, prompt or rules,
 * confidence, evidence). The text carries the meaning, the colour only helps.
 */

export function AiBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-violet-700 px-2.5 py-0.5 text-xs font-semibold text-white', className)}>
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M8 0l1.6 5.2L15 6.8 9.6 8.4 8 14 6.4 8.4 1 6.8l5.4-1.6z" />
      </svg>
      {t('ai.label')}
    </span>
  )
}

/** The notice in place of a result: switched off, unavailable, not enough data. */
export function AiNotice({ output, className }: { output: Pick<AiOutput<unknown>, 'status' | 'reason' | 'params' | 'notes'>; className?: string }) {
  const { t } = useTranslation()
  const detail = output.notes[0]
  const have = output.params.have as number | undefined
  const need = output.params.need as number | undefined
  return (
    <div className={cn('rounded-lg border border-dashed px-3 py-2 text-sm', output.status === 'unavailable' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-slate-50 text-slate-600', className)}>
      <p>{t(`ai.reasons.${output.reason ?? 'failed'}`)}</p>
      {output.status === 'notEnoughData' && have !== undefined && need !== undefined && (
        <p className="mt-0.5 text-xs">{t('ai.notEnough', { have, need })}</p>
      )}
      {output.status === 'unavailable' && (
        <p className="mt-0.5 text-xs">
          {detail && <>{detail} </>}
          <Link to="/ai" className="font-medium underline">{t('ai.openSettings')}</Link>
        </p>
      )}
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function EvidenceView({ drawingId, evidence }: { drawingId: string; evidence: Extract<AiEvidence, { kind: 'view' }> }) {
  const { t } = useTranslation()
  const image = useAiViewImage(drawingId, evidence.view, evidence.groupId)
  return (
    <figure className="w-24 text-center">
      {image.data
        ? <img src={image.data} alt={t('ai.evidence.viewAlt', { view: t(`ai.views.${evidence.view}`) })} className="h-24 w-24 rounded border border-slate-200 bg-white object-contain" />
        : <div className="flex h-24 w-24 items-center justify-center rounded border border-slate-200 bg-white text-[10px] text-slate-400">{image.isError ? '-' : '…'}</div>}
      <figcaption className="mt-0.5 text-[11px] text-slate-500">
        {t(`ai.views.${evidence.view}`)}{evidence.groupId ? ` · ${evidence.groupId}` : ''}
      </figcaption>
    </figure>
  )
}

function Provenance({ output, drawingId }: { output: AiOutput<unknown>; drawingId?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const metrics = output.evidence.filter((e): e is Extract<AiEvidence, { kind: 'metric' }> => e.kind === 'metric')
  const views = output.evidence.filter((e): e is Extract<AiEvidence, { kind: 'view' }> => e.kind === 'view')
  const facts = output.evidence.find((e): e is Extract<AiEvidence, { kind: 'facts' }> => e.kind === 'facts')
  const drawings = output.evidence.filter((e) => e.kind === 'drawing').length
  const params = Object.entries(output.params).filter(([, value]) => value !== null && value !== undefined)
  const rows: [string, ReactNode][] = [
    [t('ai.provenance.model'), `${output.model.name} (${output.model.id})`],
    [t('ai.provenance.version'), output.model.version],
    [t('ai.provenance.licence'), output.model.licence],
    [t('ai.provenance.kind'), t(`ai.kinds.${output.model.kind}` as 'ai.kinds.statistical', { defaultValue: output.model.kind })],
    [t('ai.provenance.prompt'), output.promptVersion ?? t('common.none')],
    [t('ai.provenance.confidence'), output.confidence !== null
      ? `${Math.round(output.confidence * 100)} % · ${t(`ai.confidenceKinds.${output.confidenceKind ?? 'unknown'}` as 'ai.confidenceKinds.unknown', { defaultValue: output.confidenceKind ?? '' })}`
      : t('ai.provenance.noConfidence')],
    [t('ai.provenance.generated'), formatIsoDateTime(output.generatedAt)],
    [t('ai.provenance.evaluated'), output.evaluated ? t('common.yes') : t('ai.provenance.notEvaluated')],
  ]
  return (
    <details className="border-t border-violet-200 px-4 py-2 text-xs text-slate-600" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium text-violet-900">{t('ai.provenance.title')}</summary>
      {open && (
        <div className="mt-2 space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-slate-900">{value}</dd>
              </div>
            ))}
            {params.length > 0 && (
              <>
                <dt className="text-slate-500">{t('ai.provenance.parameters')}</dt>
                <dd className="break-words text-slate-900">{params.map(([key, value]) => `${key}: ${formatValue(value)}`).join(' · ')}</dd>
              </>
            )}
          </dl>

          {(metrics.length > 0 || views.length > 0 || facts || drawings > 0) && (
            <div>
              <p className="mb-1 font-medium text-slate-700">{t('ai.provenance.evidence')}</p>
              {metrics.length > 0 && (
                <p className="text-slate-600">
                  {t('ai.evidence.metrics')}: {metrics.map((m) => `${t(`metrics.${m.id}.name`)}${m.value !== null ? ` (${Math.round(m.value * 1000) / 1000})` : ''}`).join(', ')}
                </p>
              )}
              {drawings > 0 && <p className="text-slate-600">{t('ai.evidence.drawings', { count: drawings })}</p>}
              {facts && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-slate-600">{t('ai.evidence.facts')}</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">{JSON.stringify(facts.facts, null, 2)}</pre>
                </details>
              )}
              {views.length > 0 && drawingId && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {views.map((view) => <EvidenceView key={`${view.view}-${view.groupId ?? ''}`} drawingId={drawingId} evidence={view} />)}
                </div>
              )}
            </div>
          )}

          {output.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
              {output.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
        </div>
      )}
    </details>
  )
}

export function AiBox({ title, output, drawingId, actions, children, className }: {
  title: ReactNode
  output: AiOutput<unknown>
  /** The drawing the output is about: needed to show the views a model was given. */
  drawingId?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('ai.label')} className={cn('overflow-hidden rounded-xl border-2 border-violet-300 bg-violet-50/40', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-violet-200 bg-violet-100/70 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AiBadge />
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-xs font-medium text-violet-900">{t('ai.warning')}</p>
        </div>
        {actions}
      </header>
      {!output.evaluated && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          <Badge tone="amber" className="mr-2">{t('ai.unevaluatedBadge')}</Badge>{t('ai.notEvaluated')}
        </p>
      )}
      <div className="p-4">{children}</div>
      <Provenance output={output} drawingId={drawingId} />
    </section>
  )
}
