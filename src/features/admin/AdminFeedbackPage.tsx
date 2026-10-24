import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUsage } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { MessagesTab } from './MessagesTab'
import { QuestionnaireResultsTab } from './QuestionnaireResultsTab'

type Tab = 'questionnaires' | 'messages'

/** The feedback page of the admin (requirement ADM-06): the questionnaire results and the messages, in two tabs. */
export function AdminFeedbackPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('questionnaires')
  const unread = useUsage().data?.submissions.unreadMessages ?? 0

  return (
    <>
      <PageHeader title={t('admin.feedback.title')} subtitle={t('admin.feedback.subtitle')} />
      <div role="tablist" className="mb-6 flex gap-1 border-b border-slate-200">
        {(['questionnaires', 'messages'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`tab-${option}`}
            aria-selected={tab === option}
            aria-controls={`panel-${option}`}
            onClick={() => setTab(option)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium',
              tab === option ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900',
            )}
          >
            {t(`admin.feedback.tabs.${option}`)}
            {option === 'messages' && unread > 0 && <Badge tone="indigo">{unread}</Badge>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'questionnaires' ? <QuestionnaireResultsTab /> : <MessagesTab />}
      </div>
    </>
  )
}
