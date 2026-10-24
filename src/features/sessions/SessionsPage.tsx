import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useActiveSessionId, useSessionSummaries } from '@/api/hooks'
import type { SessionSummary } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { SessionStatusBadge } from '@/components/ui/StatusBadges'
import { formatDateTime, parseServerDate, sessionStatus } from '@/lib/format'
import { gameTypeLabel, knownGameTypes } from '@/lib/gameTypes'
import { SessionFormDialog } from './SessionFormDialog'

const PAGE_SIZE = 8

type SortKey = 'newest' | 'oldest' | 'name' | 'drawings'

const sorters: Record<SortKey, (a: SessionSummary, b: SessionSummary) => number> = {
  newest: (a, b) => b.startDate.localeCompare(a.startDate),
  oldest: (a, b) => a.startDate.localeCompare(b.startDate),
  name: (a, b) => a.name.localeCompare(b.name),
  drawings: (a, b) => b.drawingCount - a.drawingCount,
}

/**
 * Session list with search, filters, sort and pagination (requirement SES-01). Filtering is done here on the
 * client for now, and moves to the server with the analysis API (TEC-06).
 */
export function SessionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const summaries = useSessionSummaries()
  const active = useActiveSessionId()
  const [creating, setCreating] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [gameType, setGameType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const fromDate = from ? new Date(`${from}T00:00:00`) : null
    const toDate = to ? new Date(`${to}T23:59:59`) : null
    return (summaries.data ?? [])
      .filter((s) => {
        if (needle && !`${s.name} ${s.description ?? ''}`.toLowerCase().includes(needle)) return false
        if (status === 'open' && s.endDate) return false
        if (status === 'closed' && !s.endDate) return false
        if (gameType !== 'all' && !s.gameTypeCounts[Number(gameType)]) return false
        const start = parseServerDate(s.startDate)
        if (start && fromDate && start < fromDate) return false
        if (start && toDate && start > toDate) return false
        return true
      })
      .sort(sorters[sort])
  }, [summaries.data, search, status, gameType, from, to, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm'
  const label = 'block text-xs font-medium text-slate-600'
  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(0)
  }

  return (
    <>
      <PageHeader
        title={t('sessions.title')}
        subtitle={t('sessions.subtitle')}
        actions={<Button variant="primary" onClick={() => setCreating(true)}>{t('sessions.new')}</Button>}
      />
      <SessionFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(s) => void navigate(`/sessions/${s.id}`)} />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className={`${label} lg:col-span-2`}>
            {t('sessions.search')}
            <input className={field} type="search" value={search} onChange={(e) => change(setSearch)(e.target.value)} />
          </label>
          <label className={label}>
            {t('sessions.status')}
            <select className={field} value={status} onChange={(e) => change(setStatus)(e.target.value as typeof status)}>
              <option value="all">{t('sessions.allStatuses')}</option>
              <option value="open">{t('status.open')}</option>
              <option value="closed">{t('status.closed')}</option>
            </select>
          </label>
          <label className={label}>
            {t('sessions.gameType')}
            <select className={field} value={gameType} onChange={(e) => change(setGameType)(e.target.value)}>
              <option value="all">{t('sessions.allGameTypes')}</option>
              {knownGameTypes.map((id) => (
                <option key={id} value={id}>{gameTypeLabel(t, id)}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t('sessions.from')}
            <input className={field} type="date" value={from} onChange={(e) => change(setFrom)(e.target.value)} />
          </label>
          <label className={label}>
            {t('sessions.to')}
            <input className={field} type="date" value={to} onChange={(e) => change(setTo)(e.target.value)} />
          </label>
        </div>
        <label className={`${label} mt-3 max-w-48`}>
          {t('sessions.sort')}
          <select className={field} value={sort} onChange={(e) => change(setSort)(e.target.value as SortKey)}>
            <option value="newest">{t('sessions.sorts.newest')}</option>
            <option value="oldest">{t('sessions.sorts.oldest')}</option>
            <option value="name">{t('sessions.sorts.name')}</option>
            <option value="drawings">{t('sessions.sorts.drawings')}</option>
          </select>
        </label>
      </Card>

      <QueryBoundary query={summaries}>
        {() =>
          filtered.length === 0 ? (
            <Card><EmptyState title={t('sessions.noMatch')} hint={t('sessions.noMatchHint')} /></Card>
          ) : (
            <Card bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('sessions.columns.name')}</th>
                      <th className="px-4 py-3 font-medium">{t('sessions.columns.period')}</th>
                      <th className="px-4 py-3 font-medium">{t('sessions.columns.status')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('sessions.columns.drawings')}</th>
                      <th className="px-4 py-3 text-right font-medium">{t('sessions.columns.participants')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="max-w-xs px-4 py-3">
                          <Link to={`/sessions/${session.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                            {session.name}
                          </Link>
                          {session.multiplayer === 1 && <Badge tone="sky" className="ml-2">{t('sessions.multiplayer')}</Badge>}
                          {session.description && <p className="truncate text-xs text-slate-500">{session.description}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(session.startDate)}
                          {session.endDate && <span className="block text-xs text-slate-400">{t('sessions.until', { date: formatDateTime(session.endDate) })}</span>}
                        </td>
                        <td className="px-4 py-3"><SessionStatusBadge status={sessionStatus(session, active.data)} /></td>
                        <td className="px-4 py-3 text-right tabular-nums">{session.drawingCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{session.participantIds.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
              </div>
            </Card>
          )
        }
      </QueryBoundary>
    </>
  )
}
