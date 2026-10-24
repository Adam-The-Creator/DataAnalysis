import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminMessages, useDeleteMessage, useSetMessageRead } from '@/api/hooks'
import type { AdminMessage, AgeBand, FeedbackCategory, FeedbackTarget, MessageFilters, SenderRole } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, ErrorView, QueryBoundary } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { ageBandLabel, categoryLabel, senderRoleLabel, targetLabel } from '@/lib/feedbackLabels'
import { formatIsoDateTime } from '@/lib/format'
import { MessageExport } from './ExportMenu'
import { FilterDate, FilterSelect } from './FilterSelect'

const PAGE_SIZE = 15

interface FilterState {
  target: '' | FeedbackTarget
  category: '' | FeedbackCategory
  role: '' | '0' | '1'
  ageBand: '' | AgeBand
  read: '' | 'read' | 'unread'
  dateFrom: string
  dateTo: string
}

const noFilters: FilterState = { target: '', category: '', role: '', ageBand: '', read: '', dateFrom: '', dateTo: '' }

function toFilters(state: FilterState, q: string): MessageFilters {
  return {
    ...(state.target ? { target: state.target } : {}),
    ...(state.category ? { category: state.category } : {}),
    ...(state.role ? { role: Number(state.role) as SenderRole } : {}),
    ...(state.ageBand ? { ageBand: state.ageBand } : {}),
    ...(state.read ? { read: state.read } : {}),
    ...(state.dateFrom ? { dateFrom: state.dateFrom } : {}),
    ...(state.dateTo ? { dateTo: state.dateTo } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  }
}

/**
 * The feedback messages (requirements ADM-11, ADM-12): newest first, with filters and a text search. The sender is a
 * code, never a name. A message can be marked read or unread, and deleted after a question. The text is shown as plain
 * text only (requirement SEC-05): React escapes it, nothing is interpreted as HTML or as a link.
 */
export function MessagesTab() {
  const { t } = useTranslation()
  const [state, setState] = useState<FilterState>(noFilters)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [toDelete, setToDelete] = useState<AdminMessage | null>(null)
  const filters = toFilters(state, q)
  const messages = useAdminMessages(filters, PAGE_SIZE, page * PAGE_SIZE)
  const setRead = useSetMessageRead()
  const remove = useDeleteMessage()

  const set = <K extends keyof FilterState>(key: K) => (value: string) => {
    setState((s) => ({ ...s, [key]: value as FilterState[K] }))
    setPage(0)
  }
  const applySearch = (event: FormEvent) => {
    event.preventDefault()
    setQ(search)
    setPage(0)
  }
  const clear = () => {
    setState(noFilters)
    setSearch('')
    setQ('')
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label={t('admin.feedback.filters.target')} value={state.target} onChange={set('target')} allLabel={t('admin.feedback.all')}
            options={(['game', 'webapp'] as const).map((value) => ({ value, label: targetLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.category')} value={state.category} onChange={set('category')} allLabel={t('admin.feedback.all')}
            options={(['problem', 'idea', 'praise', 'other'] as const).map((value) => ({ value, label: categoryLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.role')} value={state.role} onChange={set('role')} allLabel={t('admin.feedback.all')}
            options={([0, 1] as const).map((value) => ({ value: String(value), label: senderRoleLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.ageBand')} value={state.ageBand} onChange={set('ageBand')} allLabel={t('admin.feedback.all')}
            options={(['child', 'teen', 'adult', 'unknown'] as const).map((value) => ({ value, label: ageBandLabel(t, value) }))}
          />
          <FilterSelect
            label={t('admin.feedback.filters.status')} value={state.read} onChange={set('read')} allLabel={t('admin.feedback.all')}
            options={(['unread', 'read'] as const).map((value) => ({ value, label: t(`admin.feedback.status.${value}`) }))}
          />
          <FilterDate label={t('admin.feedback.filters.from')} value={state.dateFrom} onChange={set('dateFrom')} />
          <FilterDate label={t('admin.feedback.filters.to')} value={state.dateTo} onChange={set('dateTo')} />
        </div>
        <form onSubmit={applySearch} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col text-xs font-medium text-slate-600">
            {t('admin.feedback.filters.search')}
            <input
              type="search" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.messages.searchPlaceholder')}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500"
            />
          </label>
          <Button type="submit" variant="secondary">{t('admin.feedback.filters.apply')}</Button>
          <Button variant="ghost" onClick={clear}>{t('admin.feedback.filters.clear')}</Button>
          <div className="ml-auto"><MessageExport filters={filters} /></div>
        </form>
      </Card>

      {setRead.isError && <ErrorView error={setRead.error} />}

      <QueryBoundary query={messages} isEmpty={(data) => data.total === 0} empty={<EmptyState title={t('admin.messages.empty')} />}>
        {(data) => (
          <>
            <p className="text-sm text-slate-600">{t('admin.messages.summary', { total: data.total, unread: data.unread })}</p>
            <ul className="space-y-3">
              {data.items.map((message) => (
                <li key={message.id}>
                  <MessageCard
                    message={message}
                    busy={setRead.isPending}
                    onToggleRead={() => setRead.mutate({ messageId: message.id, read: !message.isRead })}
                    onDelete={() => { remove.reset(); setToDelete(message) }}
                  />
                </li>
              ))}
            </ul>
            <Pagination page={page} pageCount={Math.ceil(data.total / PAGE_SIZE)} onChange={setPage} />
          </>
        )}
      </QueryBoundary>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t('admin.messages.deleteTitle')}
        body={t('admin.messages.deleteBody')}
        confirmLabel={t('admin.messages.delete')}
        variant="danger"
        busy={remove.isPending}
        error={remove.isError ? remove.error : undefined}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  )
}

function MessageCard({ message, busy, onToggleRead, onDelete }: {
  message: AdminMessage
  busy: boolean
  onToggleRead: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <article className={cn('rounded-xl border bg-white p-4 shadow-sm', message.isRead ? 'border-slate-200' : 'border-indigo-300')}>
      <header className="flex flex-wrap items-center gap-2 text-xs">
        {!message.isRead && <Badge tone="indigo">{t('admin.messages.new')}</Badge>}
        <Badge tone="slate" className="font-mono">{message.code}</Badge>
        <span className="text-slate-600">{senderRoleLabel(t, message.role)} · {ageBandLabel(t, message.ageBand)}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">{targetLabel(t, message.target)}</span>
        {message.category && <Badge tone="sky">{categoryLabel(t, message.category)}</Badge>}
        <time className="ml-auto text-slate-500" dateTime={message.createdAt}>{formatIsoDateTime(message.createdAt)}</time>
      </header>
      {/* Plain text: React escapes it, the line breaks of the sender are kept */}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">{message.text}</p>
      <footer className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" disabled={busy} onClick={onToggleRead}>
          {message.isRead ? t('admin.messages.markUnread') : t('admin.messages.markRead')}
        </Button>
        <Button variant="ghost" className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" onClick={onDelete}>{t('admin.messages.delete')}</Button>
      </footer>
    </article>
  )
}
