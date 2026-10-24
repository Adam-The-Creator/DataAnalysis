import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { ErrorView } from '@/components/ui/states'
import { describeError } from '@/lib/describeError'

/**
 * Why a send was refused. A send limit (HTTP 429, requirement SEC-01) is not a failure: the server says how long to
 * wait, and it is shown as a calm note. The answers the user typed stay where they are (requirement FBK-05).
 */
export function SendError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (error instanceof ApiError && error.kind === 'http' && error.status === 429) {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">{t('feedback.limited')}</p>
        <p className="mt-0.5">{describeError(t, error)}</p>
      </div>
    )
  }
  return <ErrorView error={error} />
}
