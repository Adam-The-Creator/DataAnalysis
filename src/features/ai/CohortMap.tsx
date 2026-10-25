import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { usePlayerInfos } from '@/api/hooks'
import type { AiDirectoryEntry, AiMap } from '@/api/types'
import { ScatterChart, type ScatterPoint } from '@/components/charts/ScatterChart'
import { displayName } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'

/**
 * The 2D map of a group of drawings (requirement AI-10): the drawings placed by a PCA of their measurements, coloured and
 * shaped by participant or by game type. Close points are drawings with similar measurements. The axes have no unit of
 * their own: they are mixtures of the measurements, and the text names the ones that weigh most.
 */
export function CohortMap({ map, directory, highlightId, atypicalIds }: {
  map: AiMap
  directory: Record<string, AiDirectoryEntry>
  highlightId?: string
  atypicalIds?: Set<string>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [by, setBy] = useState<'participant' | 'gameType'>('participant')
  const playerIds = useMemo(() => [...new Set(Object.values(directory).map((d) => d.playerId))], [directory])
  const infos = usePlayerInfos(playerIds)

  const key = (entry: AiDirectoryEntry | undefined) => (by === 'participant' ? entry?.playerId ?? '?' : String(entry?.gameType ?? '?'))
  const keys = useMemo(() => [...new Set(map.points.map((p) => key(directory[p.id])))].sort(), [map.points, directory, by]) // eslint-disable-line react-hooks/exhaustive-deps
  const nameOfKey = (k: string) => (by === 'participant' ? displayName(infos.data?.get(k), k) : gameTypeLabel(t, Number(k)))

  const points: ScatterPoint[] = map.points.map((p) => {
    const entry = directory[p.id]
    return {
      id: p.id, x: p.x, y: p.y, group: keys.indexOf(key(entry)),
      label: `${entry?.name ?? p.id} · ${nameOfKey(key(entry))}${atypicalIds?.has(p.id) ? ` · ${t('ai.cohort.atypicalShort')}` : ''}`,
      ring: atypicalIds?.has(p.id),
    }
  })
  const axisLabel = (axis: number) => {
    const info = map.axes[axis]
    return t('ai.map.axis', {
      n: axis + 1, explained: Math.round(info.explained * 100), metrics: info.top.map((m) => t(`metrics.${m.metric}.name`)).join(', '),
    })
  }

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.map.title')}</h4>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          {t('ai.map.colourBy')}
          <select className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs" value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
            <option value="participant">{t('ai.map.participant')}</option>
            <option value="gameType">{t('ai.map.gameType')}</option>
          </select>
        </label>
      </div>
      <ScatterChart
        points={points} groups={keys.map(nameOfKey)} highlightId={highlightId}
        onSelect={(id) => void navigate(`/drawings/${id}`)}
        xLabel={axisLabel(0)} yLabel={axisLabel(1)} ariaLabel={t('ai.map.label', { count: points.length })}
      />
      <p className="mt-1 text-xs text-slate-500">{t('ai.map.hint')}</p>
    </section>
  )
}
