import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSendMessage } from '@/api/hooks'
import type { FeedbackCategory, FeedbackTarget } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { categoryLabel, targetLabel } from '@/lib/feedbackLabels'
import { MESSAGE_MAX_CHARS, newClientId } from '@/lib/instruments'
import { SendError } from './SendError'

const CATEGORIES: FeedbackCategory[] = ['problem', 'idea', 'praise', 'other']
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500'

/**
 * A message like a short e-mail: a text box and a send button (requirement FBK-20). Plain text only, a limited length,
 * an optional type. What is typed stays when the send is refused (a send limit, no network), and the ID of the message
 * stays too, so a retry after a lost answer does not send it twice.
 */
export function MessageForm({ targets }: { targets: FeedbackTarget[] }) {
  const { t } = useTranslation()
  const [target, setTarget] = useState<FeedbackTarget>(targets[0])
  const [category, setCategory] = useState<FeedbackCategory | ''>('')
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState(newClientId)
  const [sent, setSent] = useState(false)
  const send = useSendMessage()
  const blank = text.trim().length === 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (blank) return
    send.mutate(
      { clientId, target, category: category || null, text },
      {
        onSuccess: () => {
          setText('')
          setCategory('')
          setClientId(newClientId())
          setSent(true)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm text-slate-600">{t('feedback.message.hint', { max: MESSAGE_MAX_CHARS })}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {targets.length > 1 && (
          <label className="block text-sm font-medium text-slate-700">
            {t('feedback.message.about')}
            <select className={field} value={target} onChange={(e) => setTarget(e.target.value as FeedbackTarget)}>
              {targets.map((option) => <option key={option} value={option}>{targetLabel(t, option)}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium text-slate-700">
          {t('feedback.message.category')}
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory | '')}>
            <option value="">{t('feedback.categoryNone')}</option>
            {CATEGORIES.map((option) => <option key={option} value={option}>{categoryLabel(t, option)}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        {t('feedback.message.text')}
        <textarea
          className={`${field} min-h-32`}
          value={text}
          maxLength={MESSAGE_MAX_CHARS}
          onChange={(e) => { setText(e.target.value); setSent(false) }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={send.isPending || blank}>
          {send.isPending ? t('feedback.sending') : t('feedback.message.send')}
        </Button>
        <span className="text-xs text-slate-500">{t('feedback.message.counter', { count: text.length, max: MESSAGE_MAX_CHARS })}</span>
        {sent && <span role="status" className="text-sm text-emerald-700">{t('feedback.message.thanks')}</span>}
      </div>
      {send.isError && <SendError error={send.error} />}
    </form>
  )
}
