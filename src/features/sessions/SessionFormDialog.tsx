import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateSession, useUpdateSession } from '@/api/hooks'
import type { Session } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorPanel } from '@/components/ui/states'

/** Create or edit a session (requirement SES-05). The server's own message is shown when it refuses something. */
export function SessionFormDialog({ open, onClose, session, onSaved }: {
  open: boolean
  onClose: () => void
  /** Without a session the form creates a new one. */
  session?: Session
  onSaved?: (session: Session) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={t(session ? 'sessionForm.editTitle' : 'sessionForm.createTitle')}>
      <SessionForm session={session} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}

function SessionForm({ session, onClose, onSaved }: { session?: Session; onClose: () => void; onSaved?: (session: Session) => void }) {
  const { t } = useTranslation()
  const create = useCreateSession()
  const update = useUpdateSession(session?.id ?? '')
  const mutation = session ? update : create

  const [name, setName] = useState(session?.name ?? '')
  const [description, setDescription] = useState(session?.description ?? '')
  const [showBoy, setShowBoy] = useState(session ? session.showBoy === 1 : true)
  const [showGirl, setShowGirl] = useState(session ? session.showGirl === 1 : true)
  const [multiplayer, setMultiplayer] = useState(session ? session.multiplayer === 1 : false)
  const [activate, setActivate] = useState(true)

  function submit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate(
      { name: name.trim(), description: description.trim() || null, showBoy, showGirl, multiplayer, activate },
      {
        onSuccess: (saved) => {
          onSaved?.(saved)
          onClose()
        },
      },
    )
  }

  const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500'
  const checkbox = 'flex items-start gap-2 text-sm text-slate-700'

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        {t('sessionForm.name')}
        <input className={field} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        {t('sessionForm.description')}
        <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">{t('sessionForm.options')}</legend>
        <label className={checkbox}><input type="checkbox" className="mt-0.5" checked={showBoy} onChange={(e) => setShowBoy(e.target.checked)} />{t('sessionForm.showBoy')}</label>
        <label className={checkbox}><input type="checkbox" className="mt-0.5" checked={showGirl} onChange={(e) => setShowGirl(e.target.checked)} />{t('sessionForm.showGirl')}</label>
        <label className={checkbox}><input type="checkbox" className="mt-0.5" checked={multiplayer} onChange={(e) => setMultiplayer(e.target.checked)} />{t('sessionForm.multiplayer')}</label>
        {!session && (
          <label className={checkbox}>
            <input type="checkbox" className="mt-0.5" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            <span>{t('sessionForm.activate')}<span className="block text-xs text-slate-500">{t('sessionForm.activateHint')}</span></span>
          </label>
        )}
      </fieldset>
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" variant="primary" disabled={mutation.isPending || !name.trim()}>
          {t(session ? 'sessionForm.save' : 'sessionForm.create')}
        </Button>
      </div>
    </form>
  )
}
