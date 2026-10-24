import { useTranslation } from 'react-i18next'
import type { PlacedModel } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { formatNumber } from '@/lib/format'

/** The models that were placed in the scene (requirement DRW-09). The viewer draws them as boxes (layer "Placed models"). */
export function PlacedModelsPanel({ models }: { models: PlacedModel[] }) {
  const { t } = useTranslation()
  return (
    <Card title={t('models.title')} subtitle={t('models.subtitle')}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">{t('models.name')}</th>
              <th className="px-3 py-2 font-medium">{t('models.position')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('models.scale')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {models.map((m, i) => (
              <tr key={`${m.modelName}-${i}`}>
                <td className="py-2 pr-4 font-medium text-slate-900">{m.modelName}</td>
                <td className="px-3 py-2 tabular-nums text-slate-600">
                  {formatNumber(m.positionX, 2)}, {formatNumber(m.positionY, 2)}, {formatNumber(m.positionZ, 2)} m
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber((m.scaleX + m.scaleY + m.scaleZ) / 3, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
