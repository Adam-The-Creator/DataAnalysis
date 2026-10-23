import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions, breadcrumb }: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-2 text-sm text-slate-500">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
