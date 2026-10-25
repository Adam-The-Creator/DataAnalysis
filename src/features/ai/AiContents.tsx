import { useTranslation } from 'react-i18next'
import type { AiDescription, AiLabels, AiLabelEntry, AiSummary, AiVerdict } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** How the results of the model based functions are shown (requirements AI-12, AI-13, AI-16). Plain text only (SEC-05). */

function ShareBars({ entries }: { entries: AiLabelEntry[] }) {
  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-2 text-sm">
          <span className={cn('w-32 shrink-0 truncate', entry.other ? 'italic text-slate-500' : 'text-slate-800')}>{entry.name}</span>
          <span className="h-2 flex-1 overflow-hidden rounded bg-slate-200" aria-hidden="true">
            <span className="block h-full bg-violet-600" style={{ width: `${Math.round(entry.score * 100)}%` }} />
          </span>
          <span className="w-10 text-right tabular-nums text-slate-700">{Math.round(entry.score * 100)} %</span>
        </li>
      ))}
    </ul>
  )
}

function Verdict({ verdict }: { verdict: AiVerdict }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <ShareBars entries={verdict.top} />
      {verdict.unspecific && <Badge tone="amber">{t('ai.labels.unspecific')}</Badge>}
    </div>
  )
}

export function LabelsContent({ result, selectedGroup, onSelectGroup }: {
  result: AiLabels
  selectedGroup: string | null
  onSelectGroup: (groupId: string | null, strokeIds: string[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{t('ai.labels.vocabulary', { name: result.vocabulary.name, version: result.vocabulary.version })}</p>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.labels.whole')}</h4>
        <Verdict verdict={result.whole} />
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer">{t('ai.labels.perView')}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {result.whole.views.map((view) => (
              <div key={view.view}>
                <p className="mb-1 font-medium text-slate-700">{t(`ai.views.${view.view}`)}</p>
                <ShareBars entries={view.top} />
              </div>
            ))}
          </div>
        </details>
      </section>
      {result.groups.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.labels.groups')}</h4>
          <ul className="space-y-3">
            {result.groups.map((group) => (
              <li key={group.groupId} className={cn('rounded-lg border p-2', group.groupId === selectedGroup ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white')}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{t('ai.groups.name', { id: group.groupId })}</span>
                  <Button
                    variant="secondary" className="px-2 py-0.5 text-xs" aria-pressed={group.groupId === selectedGroup}
                    onClick={() => onSelectGroup(group.groupId === selectedGroup ? null : group.groupId, group.strokeIds)}
                  >
                    {group.groupId === selectedGroup ? t('ai.groups.clear') : t('ai.groups.show')}
                  </Button>
                </div>
                <Verdict verdict={group} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const certaintyTone = { low: 'slate', medium: 'sky', high: 'indigo' } as const

export function DescriptionContent({ result }: { result: AiDescription }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 text-sm text-slate-800">
      <p>{result.scene}</p>
      {result.abstract && <Badge tone="amber">{t('ai.description.abstract')}</Badge>}
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.description.objects')}</h4>
        {result.depictedObjects.length === 0 ? (
          <p className="text-slate-500">{t('common.none')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {result.depictedObjects.map((object, i) => (
              <li key={`${object.name}-${i}`}>
                <Badge tone={certaintyTone[object.certainty]}>{object.name} · {t(`ai.description.certainty.${object.certainty}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-500">{t('ai.description.certaintyHint')}</p>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.description.features')}</h4>
        <TextList items={result.notableFeatures} />
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.description.colours')}</h4>
        <TextList items={result.colourMoodWords} inline />
      </section>
    </div>
  )
}

function TextList({ items, inline = false }: { items: string[]; inline?: boolean }) {
  const { t } = useTranslation()
  if (items.length === 0) return <p className="text-slate-500">{t('common.none')}</p>
  return inline
    ? <p>{items.join(', ')}</p>
    : <ul className="list-disc space-y-0.5 pl-5">{items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul>
}

export function SummaryContent({ result }: { result: AiSummary }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 text-sm text-slate-800">
      <p>{result.overview}</p>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.summary.observations')}</h4>
        <TextList items={result.observations} />
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.summary.explore')}</h4>
        <TextList items={result.thingsToExplore} />
      </section>
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ai.summary.limitations')}</h4>
        <TextList items={result.limitations} />
      </section>
      <p className="text-xs text-slate-500">{t('ai.summary.hint')}</p>
    </div>
  )
}
