import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useRecentDrawings } from '@/api/hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { CompareCohort } from './CompareCohort'
import { CompareDrawings } from './CompareDrawings'
import { CompareOverTime } from './CompareOverTime'

type Mode = 'drawings' | 'time' | 'cohort'
const modes: Mode[] = ['drawings', 'time', 'cohort']

/**
 * Comparison (requirements CMP-01..03): two drawings side by side, a participant over time, and a drawing against a
 * group. The choices are kept in the address, so a comparison can be bookmarked and linked from other screens.
 */
export function ComparePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const drawings = useRecentDrawings()
  const mode: Mode = modes.includes(params.get('mode') as Mode) ? (params.get('mode') as Mode) : 'drawings'

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('compare.title')} subtitle={t('compare.subtitle')} />
      <div role="tablist" aria-label={t('compare.modes')} className="mb-6 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium sm:inline-flex">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => update({ mode: m })}
            className={cn('rounded-md px-4 py-1.5', mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
          >
            {t(`compare.mode.${m}`)}
          </button>
        ))}
      </div>

      <QueryBoundary query={drawings}>
        {(items) => {
          const a = params.get('a') ?? items[0]?.meta.id
          const b = params.get('b') ?? items[1]?.meta.id
          if (mode === 'drawings') return <CompareDrawings items={items} a={a} b={b} onChange={(x, y) => update({ a: x, b: y })} />
          if (mode === 'time') return <CompareOverTime participantId={params.get('p') ?? items[0]?.meta.playerID} onChange={(id) => update({ p: id })} />
          return <CompareCohort items={items} drawingId={params.get('d') ?? items[0]?.meta.id} onChange={(id) => update({ d: id })} />
        }}
      </QueryBoundary>
    </>
  )
}
