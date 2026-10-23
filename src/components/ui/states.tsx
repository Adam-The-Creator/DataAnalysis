import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NotImplementedError } from '@/api/errors'
import { describeError } from '@/lib/describeError'
import { Badge } from './Badge'
import { Button } from './Button'

/** Loading, empty and error states of every view (requirement TEC-07). */

export function Spinner({ className = 'h-5 w-5 text-indigo-600' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500">
      <Spinner />
      {label ?? t('common.loading')}
    </div>
  )
}

export function EmptyState({ title, hint }: { title?: string; hint?: string }) {
  const { t } = useTranslation()
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title ?? t('common.empty')}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-medium">{t('errors.title')}</p>
      <p className="mt-1">{describeError(t, error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

/** Shown where the live server cannot answer yet, because the analysis module is not built (requirement TEC-02). */
export function NotImplementedPanel({ error }: { error: NotImplementedError }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">{t('notImplemented.title')}</p>
      <p className="mt-1">{t('notImplemented.body', { feature: t(`notImplemented.features.${error.feature}`) })}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {error.requirements.map((id) => (
          <Badge key={id} tone="amber">{id}</Badge>
        ))}
      </div>
      <p className="mt-2 text-xs text-amber-800">{t('notImplemented.hint')}</p>
    </div>
  )
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return error instanceof NotImplementedError
    ? <NotImplementedPanel error={error} />
    : <ErrorPanel error={error} onRetry={onRetry} />
}

/** Renders loading, error (or "not implemented") and empty states around the data of a query. */
export function QueryBoundary<T>({ query, children, isEmpty, empty }: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
}) {
  if (query.isPending) {
    return <LoadingBlock />
  }
  if (query.isError) {
    return <ErrorView error={query.error} onRetry={() => void query.refetch()} />
  }
  if (isEmpty?.(query.data)) {
    return <>{empty ?? <EmptyState />}</>
  }
  return <>{children(query.data)}</>
}
