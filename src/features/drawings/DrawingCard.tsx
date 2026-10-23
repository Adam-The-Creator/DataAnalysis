import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useThumbnail } from '@/api/hooks'
import { NotImplementedError } from '@/api/errors'
import type { DrawingMeta } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/states'
import { gameTypeLabel } from '@/lib/gameTypes'

/** The thumbnail comes from the analysis API (requirements SES-02, PLY-01). Without it a placeholder is shown. */
function Thumbnail({ drawingId }: { drawingId: string }) {
  const { t } = useTranslation()
  const query = useThumbnail(drawingId)

  if (query.data) {
    return <img src={query.data} alt="" className="h-36 w-full rounded-t-xl object-cover" loading="lazy" />
  }
  return (
    <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-t-xl bg-slate-100 px-3 text-center text-xs text-slate-400">
      {query.isPending ? (
        <Spinner />
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 0v18M3 8l9 5 9-5" strokeLinejoin="round" />
          </svg>
          {query.error instanceof NotImplementedError && <span>{t('gallery.noThumbnail')}</span>}
        </>
      )}
    </div>
  )
}

export function DrawingCard({ meta, to, subtitle }: { meta: DrawingMeta; to: string; subtitle?: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-300 hover:shadow focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <Thumbnail drawingId={meta.id} />
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700" title={meta.name}>{meta.name}</p>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        <Badge tone="indigo">{gameTypeLabel(t, meta.gameType)}</Badge>
      </div>
    </Link>
  )
}
