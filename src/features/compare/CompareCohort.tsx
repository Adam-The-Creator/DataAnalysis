import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCohort, usePlayerList } from '@/api/hooks'
import type { CohortFilters, RecentDrawing } from '@/api/types'
import { Role } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { displayName, formatDate, formatNumber } from '@/lib/format'
import { formatMetricValue, metricDef } from '@/lib/metricCatalog'
import { DrawingPicker } from './DrawingPicker'

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm'

/** The percentile as a bar from 0 to 100 with a marker. The number is always written next to it. */
function PercentileBar({ percentile }: { percentile: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-2.5 w-28 rounded-full bg-slate-100" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-indigo-200" style={{ width: `${percentile}%` }} />
        <span className="absolute -inset-y-0.5 w-1 rounded bg-indigo-700" style={{ left: `calc(${percentile}% - 2px)` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{formatNumber(percentile, 0)}</span>
    </span>
  )
}

const presets: { key: 'children' | 'teenagers' | 'adults'; ageMin?: number; ageMax?: number }[] = [
  { key: 'children', ageMax: 12 },
  { key: 'teenagers', ageMin: 13, ageMax: 17 },
  { key: 'adults', ageMin: 18 },
]

/**
 * Where a drawing stands among a group of other drawings (requirement CMP-03): the same session, the same game type
 * and/or participants in an age range. It only describes where the numbers lie, it says nothing about better or worse.
 */
export function CompareCohort({ items, drawingId, onChange }: {
  items: RecentDrawing[]
  drawingId: string | undefined
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const players = usePlayerList()
  const selected = items.find((i) => i.meta.id === drawingId)
  const participants = (players.data ?? []).filter((p) => p.role === Role.Player)
  const participantId = selected?.meta.playerID ?? participants[0]?.id

  const [sameSession, setSameSession] = useState(false)
  const [sameGameType, setSameGameType] = useState(true)
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')

  const filters: CohortFilters = {
    ...(sameSession && selected ? { sessionId: selected.meta.sessionID } : {}),
    ...(sameGameType && selected ? { gameType: selected.meta.gameType } : {}),
    ...(ageMin !== '' ? { ageMin: Number(ageMin) } : {}),
    ...(ageMax !== '' ? { ageMax: Number(ageMax) } : {}),
  }
  const query = useCohort(drawingId, filters)
  const own = items.filter((i) => i.meta.playerID === participantId)

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            {t('compare.participant')}
            <select
              className={field}
              value={participantId ?? ''}
              onChange={(e) => { const first = items.find((i) => i.meta.playerID === e.target.value); if (first) onChange(first.meta.id) }}
            >
              {participants.map((p) => <option key={p.id} value={p.id}>{displayName(p.info, p.id)}</option>)}
            </select>
          </label>
          <DrawingPicker label={t('compare.drawing')} value={drawingId} items={own} onChange={onChange} />
        </div>

        <fieldset className="mt-5 space-y-3">
          <legend className="text-sm font-medium text-slate-700">{t('compare.cohort.group')}</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={sameGameType} onChange={(e) => setSameGameType(e.target.checked)} />{t('compare.cohort.sameGameType')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={sameSession} onChange={(e) => setSameSession(e.target.checked)} />{t('compare.cohort.sameSession')}</label>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm text-slate-700">
            <label>{t('compare.cohort.ageFrom')}<input type="number" min={0} max={120} className={cn(field, 'w-24')} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></label>
            <label>{t('compare.cohort.ageTo')}<input type="number" min={0} max={120} className={cn(field, 'w-24')} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></label>
            {presets.map((preset) => (
              <Button key={preset.key} variant="secondary" onClick={() => { setAgeMin(preset.ageMin?.toString() ?? ''); setAgeMax(preset.ageMax?.toString() ?? '') }}>
                {t(`compare.cohort.presets.${preset.key}`)}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => { setAgeMin(''); setAgeMax('') }}>{t('compare.cohort.anyAge')}</Button>
          </div>
        </fieldset>
      </Card>

      {drawingId ? (
        <Card
          title={t('compare.cohort.result', { name: selected?.meta.name ?? '', date: selected ? formatDate(selected.date) : '' })}
          subtitle={t('compare.cohort.resultHint')}
        >
          <QueryBoundary query={query}>
            {(result) => (
              <div className="space-y-4">
                <p className="text-sm text-slate-700">{t('compare.cohort.size', { count: result.cohortSize })}</p>
                {!result.sufficient && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('compare.cohort.tooSmall', { count: result.cohortSize })}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2 pr-4 font-medium">{t('report.metric')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('compare.cohort.thisDrawing')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('report.min')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('report.median')}</th>
                        <th className="px-3 py-2 text-right font-medium">{t('report.max')}</th>
                        <th className="py-2 pl-3 font-medium">{t('compare.cohort.percentile')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.metrics.map((row) => {
                        const def = metricDef(row.id)
                        const show = (v: number | null) => (v != null ? formatMetricValue(def, v) : '-')
                        return (
                          <tr key={row.id}>
                            <td className="py-2 pr-4 text-slate-700">{t(`metrics.${row.id}.name`)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{show(row.value)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{show(row.min)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{show(row.median)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{show(row.max)}</td>
                            <td className="py-2 pl-3">{row.percentile != null ? <PercentileBar percentile={row.percentile} /> : <span className="text-slate-400">{t('common.notAvailable')}</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </QueryBoundary>
        </Card>
      ) : (
        <Card><EmptyState title={t('compare.pickDrawing')} /></Card>
      )}
    </div>
  )
}
