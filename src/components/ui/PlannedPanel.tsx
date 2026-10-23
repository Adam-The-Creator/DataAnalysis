import { useTranslation } from 'react-i18next'
import { featureOf, type RequirementId } from '@/features/roadmap/registry'
import { Badge } from './Badge'
import { FeatureStatusBadge, PhaseBadge } from './StatusBadges'

/** A placeholder for features that are specified in requirements.md but not built yet. */
export function PlannedPanel({ ids, title }: { ids: RequirementId[]; title?: string }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
      <p className="text-sm font-medium text-slate-700">{title ?? t('planned.title')}</p>
      <ul className="mt-3 space-y-2">
        {ids.map((id) => {
          const feature = featureOf(id)
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Badge tone="slate">{id}</Badge>
              <span>{t(`roadmap.items.${id}`)}</span>
              <PhaseBadge phase={feature.phase} />
              <FeatureStatusBadge status={feature.status} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
