import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { getApiConfig } from '@/api/config'
import { Role } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PhaseBadge } from '@/components/ui/StatusBadges'
import { useAuth } from '@/auth/authContext'
import type { Phase } from '@/features/roadmap/registry'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  key: 'dashboard' | 'sessions' | 'participants' | 'compare' | 'reports' | 'roadmap' | 'myRecords' | 'feedback' | 'adminUsage' | 'adminFeedback'
  end?: boolean
  phase?: Phase // shown for screens that are only a placeholder so far
}

const psychologistNav: NavItem[] = [
  { to: '/', key: 'dashboard', end: true },
  { to: '/sessions', key: 'sessions' },
  { to: '/participants', key: 'participants' },
  { to: '/compare', key: 'compare' },
  { to: '/reports', key: 'reports' },
  { to: '/feedback', key: 'feedback' },
  { to: '/roadmap', key: 'roadmap' },
]

const playerNav: NavItem[] = [
  { to: '/my', key: 'myRecords' },
  { to: '/feedback', key: 'feedback' },
]

// The admin sees the usage numbers and the feedback, nothing else (requirement ACC-03)
const adminNav: NavItem[] = [
  { to: '/admin', key: 'adminUsage', end: true },
  { to: '/admin/feedback', key: 'adminFeedback' },
]

const roleBadge = {
  [Role.Psychologist]: { tone: 'indigo', label: 'roles.psychologist' },
  [Role.Admin]: { tone: 'amber', label: 'roles.admin' },
  [Role.Player]: { tone: 'slate', label: 'roles.player' },
} as const

function ModeBadge() {
  const { t } = useTranslation()
  const config = getApiConfig()
  return config.mode === 'demo'
    ? <Badge tone="amber" className="max-w-full truncate">{t('mode.demo')}</Badge>
    : <Badge tone="emerald" className="max-w-full truncate" >{t('mode.live', { url: config.baseUrl })}</Badge>
}

export function AppShell() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const nav = user?.role === Role.Psychologist ? psychologistNav : user?.role === Role.Admin ? adminNav : playerNav
  const badge = roleBadge[user?.role === Role.Psychologist || user?.role === Role.Admin ? user.role : Role.Player]

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium',
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    )

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-base font-semibold text-slate-900">{t('app.name')}</p>
          <p className="text-xs text-slate-500">{t('app.tagline')}</p>
        </div>
        <nav aria-label={t('nav.label')} className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {t(`nav.${item.key}`)}
              {item.phase && <PhaseBadge phase={item.phase} />}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <p className="text-sm font-semibold text-slate-900 md:hidden">{t('app.name')}</p>
            <ModeBadge />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user?.name}{' '}
              <Badge tone={badge.tone}>{t(badge.label)}</Badge>
            </span>
            <Button variant="secondary" onClick={logout}>{t('auth.logout')}</Button>
          </div>
        </header>

        <nav aria-label={t('nav.label')} className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
