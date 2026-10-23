import { useTranslation } from 'react-i18next'
import { useDrawingAnalysis } from '@/api/hooks'
import { PaletteBar } from '@/components/charts/PaletteBar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { InfoTip } from '@/components/ui/InfoTip'
import { QueryBoundary } from '@/components/ui/states'
import { formatIsoDateTime } from '@/lib/format'
import { formatMetricValue, metricDef, metricGroups } from '@/lib/metricCatalog'

/**
 * Metrics, colour palette and data quality flags of a drawing, all computed by the server side analysis module
 * (requirements MET-01..08, DRW-04). In live mode it shows "not implemented" until that module exists.
 */
export function AnalysisPanel({ drawingId }: { drawingId: string }) {
  const { t } = useTranslation()
  const query = useDrawingAnalysis(drawingId)

  return (
    <Card title={t('analysis.title')} subtitle={t('analysis.subtitle')}>
      <QueryBoundary query={query}>
        {(analysis) => (
          <div className="space-y-5">
            <section aria-labelledby="flags-heading">
              <h3 id="flags-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('analysis.flags')}</h3>
              {analysis.flags.length === 0 ? (
                <p className="text-sm text-slate-600">{t('analysis.noFlags')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {analysis.flags.map((flag) => (
                    <li key={flag} className="flex items-start gap-2 text-sm text-slate-700">
                      <Badge tone="amber" className="mt-0.5 shrink-0">{t('analysis.flag')}</Badge>
                      {t(`flags.${flag}`)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {metricGroups.map((group) => {
              const metrics = analysis.metrics.filter((m) => metricDef(m.id).group === group)
              if (metrics.length === 0) return null
              return (
                <section key={group}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`metricGroups.${group}`)}</h3>
                  <dl className="divide-y divide-slate-100">
                    {metrics.map((metric) => {
                      const def = metricDef(metric.id)
                      return (
                        <div key={metric.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                          <dt className="text-slate-600">
                            {t(`metrics.${metric.id}.name`)}{' '}
                            <InfoTip text={`${t(`metrics.${metric.id}.definition`)} ${t(`metrics.${metric.id}.note`)}`} />
                          </dt>
                          <dd className="text-right tabular-nums text-slate-900">
                            {metric.value != null ? (
                              formatMetricValue(def, metric.value)
                            ) : (
                              <span className="text-slate-400">
                                {t('common.notAvailable')}
                                <span className="block text-xs">{t(`metricReasons.${metric.unavailableReason ?? 'noStrokes'}`)}</span>
                              </span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </section>
              )
            })}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('analysis.palette')}</h3>
              {analysis.palette.length > 0 ? (
                <PaletteBar palette={analysis.palette} ariaLabel={t('analysis.paletteLabel')} />
              ) : (
                <p className="text-sm text-slate-500">{t('common.none')}</p>
              )}
            </section>

            <p className="text-xs text-slate-400">
              {t('analysis.version', { version: analysis.analyzerVersion, time: formatIsoDateTime(analysis.generatedAt) })}
            </p>
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}
