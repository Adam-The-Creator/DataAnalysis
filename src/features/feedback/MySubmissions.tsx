import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMySubmissions } from '@/api/hooks'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { categoryLabel, instrumentName, targetLabel } from '@/lib/feedbackLabels'
import { formatIsoDateTime } from '@/lib/format'

const PAGE_SIZE = 10

/** What the user sent before, newest first, read only (requirement FBK-04). The scores are not shown. */
export function MySubmissions() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const mine = useMySubmissions(PAGE_SIZE, page * PAGE_SIZE)

  return (
    <Card title={t('feedback.mine.title')}>
      <QueryBoundary query={mine} isEmpty={(data) => data.total === 0} empty={<EmptyState title={t('feedback.mine.empty')} />}>
        {(data) => (
          <>
            <ul className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <li key={item.id} className="py-2.5 text-sm">
                  <p className="font-medium text-slate-900">
                    {item.kind === 'questionnaire'
                      ? t('feedback.mine.questionnaire', { name: instrumentName(t, item.instrument) })
                      : item.category
                        ? t('feedback.mine.messageOfType', { type: categoryLabel(t, item.category) })
                        : t('feedback.mine.message')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatIsoDateTime(item.createdAt)} · {t('feedback.mine.about', { target: targetLabel(t, item.target) })}
                  </p>
                  {/* Plain text: React escapes it, and line breaks are kept */}
                  {item.kind === 'message' && <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{item.text}</p>}
                </li>
              ))}
            </ul>
            <Pagination page={page} pageCount={Math.ceil(data.total / PAGE_SIZE)} onChange={setPage} />
          </>
        )}
      </QueryBoundary>
    </Card>
  )
}
