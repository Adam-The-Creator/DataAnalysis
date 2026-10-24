import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSessionAction } from '@/api/hooks'
import type { Session } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { describeError } from '@/lib/describeError'
import type { SessionStatus } from '@/lib/format'
import { DEFAULT_SESSION_ID } from '@/lib/sessions'
import { SessionFormDialog } from './SessionFormDialog'

/**
 * Edit, activate, close and delete a session (requirement SES-05). What the server refuses is shown in its own words:
 * the default session cannot be closed, a closed session cannot be activated, and a session with drawings or an
 * active room cannot be deleted.
 */
export function SessionActions({ session, status }: { session: Session; status: SessionStatus }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'activate' | 'close' | 'remove' | null>(null)
  const action = useSessionAction(session.id, () => void navigate('/sessions'))

  function run(kind: 'activate' | 'close' | 'remove') {
    action.mutate(kind, { onSuccess: () => setConfirm(null) })
  }

  // Cancelling also forgets the refusal, otherwise the server's message would stay on the page
  function cancel() {
    setConfirm(null)
    action.reset()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setEditing(true)}>{t('sessionActions.edit')}</Button>
      {status === 'open' && (
        // Asks first, so a misclick cannot send everybody's new drawings into another session
        <Button variant="secondary" disabled={action.isPending} onClick={() => { action.reset(); setConfirm('activate') }}>
          {t('sessionActions.activate')}
        </Button>
      )}
      {status !== 'closed' && (
        <Button
          variant="secondary"
          disabled={session.id === DEFAULT_SESSION_ID}
          title={session.id === DEFAULT_SESSION_ID ? t('sessionActions.defaultCannotClose') : undefined}
          onClick={() => { action.reset(); setConfirm('close') }}
        >
          {t('sessionActions.close')}
        </Button>
      )}
      <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => { action.reset(); setConfirm('remove') }}>
        {t('sessionActions.delete')}
      </Button>
      {action.isError && confirm === null && (
        <p role="alert" className="basis-full text-right text-sm text-rose-700">{describeError(t, action.error)}</p>
      )}

      <SessionFormDialog open={editing} onClose={() => setEditing(false)} session={session} />
      <ConfirmDialog
        open={confirm === 'activate'}
        onClose={cancel}
        title={t('sessionActions.activateTitle')}
        body={t('sessionActions.activateBody', { name: session.name })}
        confirmLabel={t('sessionActions.activate')}
        busy={action.isPending}
        error={action.isError && confirm === 'activate' ? action.error : undefined}
        onConfirm={() => run('activate')}
      />
      <ConfirmDialog
        open={confirm === 'close'}
        onClose={cancel}
        title={t('sessionActions.closeTitle')}
        body={t('sessionActions.closeBody')}
        confirmLabel={t('sessionActions.close')}
        busy={action.isPending}
        error={action.isError && confirm === 'close' ? action.error : undefined}
        onConfirm={() => run('close')}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onClose={cancel}
        title={t('sessionActions.deleteTitle')}
        body={t('sessionActions.deleteBody')}
        confirmLabel={t('sessionActions.delete')}
        variant="danger"
        busy={action.isPending}
        error={action.isError && confirm === 'remove' ? action.error : undefined}
        onConfirm={() => run('remove')}
      />
    </>
  )
}
