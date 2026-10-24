import { useTranslation } from 'react-i18next'
import { useTracking } from '@/api/hooks'
import type { TrackedPlayer } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { QueryBoundary } from '@/components/ui/states'
import { formatDuration, formatNumber } from '@/lib/format'

/** Twelve sectors of 30 degrees as a polar bar chart. The share of every sector is in its tooltip and in the list. */
function YawChart({ shares, label }: { shares: number[]; label: string }) {
  const size = 150
  const centre = size / 2
  const max = Math.max(...shares, 0.01)
  const wedge = (index: number) => {
    const radius = 12 + (shares[index] / max) * (centre - 16)
    const a0 = ((index * 30 - 90) * Math.PI) / 180
    const a1 = (((index + 1) * 30 - 90) * Math.PI) / 180
    const [x0, y0, x1, y1] = [centre + radius * Math.cos(a0), centre + radius * Math.sin(a0), centre + radius * Math.cos(a1), centre + radius * Math.sin(a1)]
    return `M${centre} ${centre} L${x0.toFixed(1)} ${y0.toFixed(1)} A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-36 w-36 shrink-0" role="img" aria-label={label}>
      <circle cx={centre} cy={centre} r={centre - 4} fill="#f8fafc" stroke="#e2e8f0" />
      {shares.map((share, i) => (
        <path key={i} d={wedge(i)} fill="#0072b2" fillOpacity="0.7" stroke="#fff" strokeWidth="1">
          <title>{`${i * 30}°–${(i + 1) * 30}°: ${formatNumber(share * 100, 0)} %`}</title>
        </path>
      ))}
    </svg>
  )
}

function PlayerBlock({ player, name }: { player: TrackedPlayer; name: string }) {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    [t('tracking.headMovement'), `${formatNumber(player.movement.head, 1)} m`],
    [t('tracking.rightHandMovement'), `${formatNumber(player.movement.rightHand, 1)} m`],
    [t('tracking.leftHandMovement'), `${formatNumber(player.movement.leftHand, 1)} m`],
    [t('tracking.bodyMovement'), `${formatNumber(player.movement.player, 1)} m`],
    [t('tracking.duration'), player.durationMs != null ? formatDuration(player.durationMs / 1000) : t('common.notAvailable')],
  ]
  if (player.explored) {
    rows.push(
      [t('tracking.exploredArea'), `${formatNumber(player.explored.areaM2, 2)} m²`],
      [t('tracking.headHeight'), `${formatNumber(player.explored.headHeightMin, 2)}–${formatNumber(player.explored.headHeightMax, 2)} m`],
    )
  }
  const direction = player.headDirection
  return (
    <div className="flex flex-wrap gap-6 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <div className="min-w-60 flex-1">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">{name}</h3>
        <dl className="text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-1">
              <dt className="text-slate-500">{label}</dt>
              <dd className="tabular-nums text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {direction && (
        <div className="flex items-center gap-4">
          <YawChart shares={direction.yawShares} label={t('tracking.yawLabel')} />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900">{t('tracking.headDirection')}</p>
            <p>{t('tracking.meanYaw', { yaw: formatNumber(direction.meanYawDeg, 0) })}</p>
            <p>{t('tracking.meanPitch', { pitch: formatNumber(direction.meanPitchDeg, 0) })}</p>
            <p>{t('tracking.coverage', { count: direction.yawCoverage })}</p>
            <p className="mt-2 max-w-52 text-xs text-slate-500">{t('tracking.yawHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Head and hand movement, where the head was turned and how much space was explored (requirement DRW-08). */
export function TrackingPanel({ drawingId, authorNames }: { drawingId: string; authorNames: Record<string, string> }) {
  const { t } = useTranslation()
  const query = useTracking(drawingId)

  return (
    <Card title={t('tracking.title')} subtitle={t('tracking.subtitle')}>
      <QueryBoundary query={query}>
        {(data) =>
          !data.available ? (
            <p className="text-sm text-slate-500">{t('tracking.none')}</p>
          ) : (
            <div className="space-y-4">
              {data.approximate && <Badge tone="amber">{t('tracking.approximate', { n: data.decimation ?? 1 })}</Badge>}
              {data.players.map((player) => (
                <PlayerBlock key={player.playerId} player={player} name={authorNames[player.playerId] ?? `#${player.playerId.slice(0, 8)}`} />
              ))}
              <p className="text-xs text-slate-500">{t('tracking.layerHint')}</p>
            </div>
          )
        }
      </QueryBoundary>
    </Card>
  )
}
