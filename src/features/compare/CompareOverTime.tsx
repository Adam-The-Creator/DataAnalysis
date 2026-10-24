import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParticipantHistory, usePlayerList } from '@/api/hooks'
import type { MetricId, ParticipantHistory } from '@/api/types'
import { Role } from '@/api/types'
import { LineChart } from '@/components/charts/LineChart'
import { Card } from '@/components/ui/Card'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { TrendTable } from '@/features/participants/ParticipantPage'
import { displayName, formatDate } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { formatMetricValue, metricCatalog, metricDef } from '@/lib/metricCatalog'
import { MetricDifferenceTable } from './MetricDifferenceTable'

const select = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm'
const label = 'block text-sm font-medium text-slate-700'

function Trend({ history }: { history: ParticipantHistory }) {
  const { t } = useTranslation()
  const gameTypes = useMemo(() => [...new Set(history.drawings.map((d) => d.meta.gameType))].sort(), [history.drawings])
  const [gameType, setGameType] = useState<number | undefined>(gameTypes[0])
  const rows = useMemo(() => history.drawings.filter((d) => d.meta.gameType === gameType), [history.drawings, gameType])
  const [metric, setMetric] = useState<MetricId>('totalLength')
  const [baselineId, setBaselineId] = useState<string | undefined>(undefined)
  const [followUpId, setFollowUpId] = useState<string | undefined>(undefined)

  // Baseline and follow-up default to the first and the latest drawing of the game type
  const baseline = rows.find((r) => r.meta.id === baselineId) ?? rows[0]
  const followUp = rows.find((r) => r.meta.id === followUpId) ?? rows[rows.length - 1]
  const def = metricDef(metric)
  const points = rows.flatMap((r) => (r.metrics[metric] != null ? [{ label: formatDate(r.date), value: r.metrics[metric] as number }] : []))
  const rowLabel = (r: (typeof rows)[number]) => `${r.meta.name} · ${formatDate(r.date)}`

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={label}>
            {t('sessions.gameType')}
            <select className={select} value={gameType ?? ''} onChange={(e) => { setGameType(Number(e.target.value)); setBaselineId(undefined); setFollowUpId(undefined) }}>
              {gameTypes.map((id) => <option key={id} value={id}>{gameTypeLabel(t, id)} ({history.drawings.filter((d) => d.meta.gameType === id).length})</option>)}
            </select>
          </label>
          <label className={label}>
            {t('report.metric')}
            <select className={select} value={metric} onChange={(e) => setMetric(e.target.value as MetricId)}>
              {metricCatalog.map((m) => <option key={m.id} value={m.id}>{t(`metrics.${m.id}.name`)}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {rows.length < 2 ? (
        <Card><EmptyState title={t('compare.time.tooFew')} hint={t('compare.time.tooFewHint')} /></Card>
      ) : (
        <>
          <Card title={t('compare.time.chart', { metric: t(`metrics.${metric}.name`) })}>
            {points.length === 0
              ? <EmptyState title={t('participant.noPoints')} />
              : <LineChart points={points} ariaLabel={t('participant.chartLabel', { metric: t(`metrics.${metric}.name`) })} format={(v) => formatMetricValue(def, v)} />}
          </Card>

          <Card title={t('compare.time.baselineVsFollowUp')} subtitle={t('compare.time.baselineHint')}>
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <label className={label}>
                {t('compare.time.baseline')}
                <select className={select} value={baseline?.meta.id} onChange={(e) => setBaselineId(e.target.value)}>
                  {rows.map((r) => <option key={r.meta.id} value={r.meta.id}>{rowLabel(r)}</option>)}
                </select>
              </label>
              <label className={label}>
                {t('compare.time.followUp')}
                <select className={select} value={followUp?.meta.id} onChange={(e) => setFollowUpId(e.target.value)}>
                  {rows.map((r) => <option key={r.meta.id} value={r.meta.id}>{rowLabel(r)}</option>)}
                </select>
              </label>
            </div>
            {baseline && followUp && (
              <MetricDifferenceTable a={baseline.metrics} b={followUp.metrics} labelA={t('compare.time.baseline')} labelB={t('compare.time.followUp')} />
            )}
          </Card>

          <Card title={t('participant.trends')}><TrendTable rows={rows} /></Card>
        </>
      )}
    </div>
  )
}

/** The same participant, the same game type, over several sessions: baseline versus follow-up (requirement CMP-02). */
export function CompareOverTime({ participantId, onChange }: { participantId: string | undefined; onChange: (id: string) => void }) {
  const { t } = useTranslation()
  const players = usePlayerList()
  const history = useParticipantHistory(participantId)
  const participants = (players.data ?? []).filter((p) => p.role === Role.Player)

  return (
    <div className="space-y-6">
      <Card>
        <label className={label}>
          {t('compare.participant')}
          <select className={select} value={participantId ?? ''} onChange={(e) => onChange(e.target.value)}>
            {!participantId && <option value="">{t('compare.choose')}</option>}
            {participants.map((p) => <option key={p.id} value={p.id}>{displayName(p.info, p.id)}</option>)}
          </select>
        </label>
      </Card>
      {participantId
        ? <QueryBoundary query={history}>{(data) => <Trend key={data.playerId} history={data} />}</QueryBoundary>
        : <Card><EmptyState title={t('compare.pickParticipant')} /></Card>}
    </div>
  )
}
