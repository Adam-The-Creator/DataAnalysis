import { useTranslation } from 'react-i18next'
import type { MetricId } from '@/api/types'
import { formatMetricValue, metricCatalog, metricDef } from '@/lib/metricCatalog'

type Values = Partial<Record<MetricId, number | null>>

function formatDelta(id: MetricId, delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  return `${sign}${formatMetricValue(metricDef(id), Math.abs(delta))}`
}

/**
 * A against B for every metric: both values, the difference and the change in per cent (requirements CMP-01, CMP-02).
 * A metric that either side does not have is shown as "n/a", never as zero.
 */
export function MetricDifferenceTable({ a, b, labelA, labelB }: { a: Values; b: Values; labelA: string; labelB: string }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4 font-medium">{t('report.metric')}</th>
            <th className="px-3 py-2 text-right font-medium">{labelA}</th>
            <th className="px-3 py-2 text-right font-medium">{labelB}</th>
            <th className="px-3 py-2 text-right font-medium">{t('compare.difference')}</th>
            <th className="py-2 pl-3 text-right font-medium">{t('compare.change')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {metricCatalog.map((def) => {
            const [va, vb] = [a[def.id] ?? null, b[def.id] ?? null]
            const both = va != null && vb != null
            const na = <span className="text-slate-400">{t('common.notAvailable')}</span>
            return (
              <tr key={def.id}>
                <td className="py-2 pr-4 text-slate-700">{t(`metrics.${def.id}.name`)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{va != null ? formatMetricValue(def, va) : na}</td>
                <td className="px-3 py-2 text-right tabular-nums">{vb != null ? formatMetricValue(def, vb) : na}</td>
                <td className="px-3 py-2 text-right tabular-nums">{both ? formatDelta(def.id, vb - va) : na}</td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {both && va !== 0 ? `${vb - va > 0 ? '+' : vb - va < 0 ? '−' : ''}${Math.abs(((vb - va) / Math.abs(va)) * 100).toFixed(0)} %` : na}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
