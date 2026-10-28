import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { getApiConfig, servedByServer, setApiConfig, type ApiMode } from '@/api/config'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { describeError } from '@/lib/describeError'
import { queryClient } from '@/queryClient'

/** Login (requirement AUTH-01) and the choice between demo data and the live DatabaseServer. */
export function LoginPage() {
  const { t } = useTranslation()
  const { user, login, expired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<ApiMode>(getApiConfig().mode)
  const [baseUrl, setBaseUrl] = useState(getApiConfig().baseUrl)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (user) {
    return <Navigate to="/" replace />
  }

  function chooseMode(next: ApiMode) {
    setMode(next)
    setApiConfig({ mode: next })
    queryClient.clear()
    setError(null)
  }

  async function submit(name: string, secret: string) {
    setBusy(true)
    setError(null)
    try {
      setApiConfig({ mode, baseUrl })
      await login(name, secret)
      const from = (location.state as { from?: string } | null)?.from
      void navigate(from ?? '/', { replace: true })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void submit(username, password)
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t('app.name')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('auth.intro')}</p>

        {expired && (
          <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('auth.expired')}</p>
        )}

        <div role="radiogroup" aria-label={t('auth.dataSource')} className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {(['demo', 'live'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => chooseMode(option)}
              className={cn('rounded-md px-3 py-1.5', mode === option ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
            >
              {t(`auth.mode.${option}`)}
            </button>
          ))}
        </div>

        {mode === 'demo' ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-slate-600">{t('auth.demoHint')}</p>
            <Button variant="primary" className="w-full" disabled={busy} onClick={() => void submit('psychologist', 'demo')}>
              {t('auth.demoPsychologist')}
            </Button>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void submit('player', 'demo')}>
              {t('auth.demoPlayer')}
            </Button>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void submit('admin', 'demo')}>
              {t('auth.demoAdmin')}
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              {t('auth.serverUrl')}
              <input
                className={cn(input, servedByServer && 'bg-slate-50 text-slate-500')}
                type="url"
                required
                readOnly={servedByServer}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              {servedByServer && <span className="mt-1 block text-xs font-normal text-slate-500">{t('auth.serverUrlFixed')}</span>}
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t('auth.username')}
              <input className={input} autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t('auth.password')}
              <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {t('auth.login')}
            </Button>
          </form>
        )}

        {busy && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Spinner className="h-4 w-4 text-indigo-600" />{t('common.loading')}</p>
        )}
        {error != null && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{describeError(t, error)}</p>
        )}
      </div>
    </div>
  )
}
