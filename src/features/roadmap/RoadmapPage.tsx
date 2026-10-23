import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { FeatureStatusBadge, PhaseBadge } from '@/components/ui/StatusBadges'
import { StatTile } from '@/components/ui/StatTile'
import { cn } from '@/lib/cn'
import { areaOf, decisionIds, featureList, futureIds, type Phase } from './registry'

const phases: Phase[] = ['MVP', 'P2', 'P3']

/** The big picture: where every requirement of requirements.md stands, the agreed decisions and the future ideas. */
export function RoadmapPage() {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('MVP')
  const shown = featureList.filter((f) => f.phase === phase)

  return (
    <>
      <PageHeader title={t('roadmap.title')} subtitle={t('roadmap.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        {phases.map((p) => {
          const inPhase = featureList.filter((f) => f.phase === p)
          const count = (status: string) => inPhase.filter((f) => f.status === status).length
          return (
            <StatTile
              key={p}
              label={t(`roadmap.phases.${p}`)}
              value={`${count('done')} / ${inPhase.length}`}
              hint={t('roadmap.breakdown', { partial: count('partial'), demo: count('demo'), planned: count('planned') })}
            />
          )
        })}
      </div>

      <Card
        className="mt-6"
        title={t('roadmap.requirements')}
        actions={
          <div role="tablist" className="flex gap-1">
            {phases.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={phase === p}
                onClick={() => setPhase(p)}
                className={cn('rounded-md px-3 py-1 text-sm font-medium', phase === p ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}
              >
                {p}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-slate-100">
          {shown.map((feature) => (
            <li key={feature.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <Badge tone="slate" className="w-20 justify-center">{feature.id}</Badge>
              <span className="min-w-0 flex-1 text-slate-800">{t(`roadmap.items.${feature.id}`)}</span>
              <span className="text-xs text-slate-400">{t(`roadmap.areas.${areaOf(feature.id)}`)}</span>
              <PhaseBadge phase={feature.phase} />
              <FeatureStatusBadge status={feature.status} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={t('roadmap.decisionsTitle')} subtitle={t('roadmap.decisionsHint')}>
          <ul className="space-y-2 text-sm">
            {decisionIds.map((id) => (
              <li key={id} className="flex gap-3">
                <Badge tone="indigo" className="h-fit shrink-0">{id}</Badge>
                <span className="text-slate-700">{t(`roadmap.decisions.${id}`)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('roadmap.futureTitle')} subtitle={t('roadmap.futureHint')}>
          <ul className="space-y-2 text-sm">
            {futureIds.map((id) => (
              <li key={id} className="flex gap-3">
                <Badge tone="slate" className="h-fit shrink-0">{id}</Badge>
                <span className="text-slate-700">{t(`roadmap.future.${id}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
