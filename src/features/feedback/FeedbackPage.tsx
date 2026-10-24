import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInstruments, usePlayerInfos } from '@/api/hooks'
import { Role, type FeedbackTarget, type InstrumentId } from '@/api/types'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingBlock, QueryBoundary } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { instrumentName, targetLabel } from '@/lib/feedbackLabels'
import { ageBandOf } from '@/lib/instruments'
import { MessageForm } from './MessageForm'
import { MySubmissions } from './MySubmissions'
import { QuestionnaireForm } from './QuestionnaireForm'

/**
 * The feedback page of players and psychologists (requirements FBK-01..FBK-20): questionnaires, a message, and what the
 * user sent before. A player rates the game, a psychologist the game and this web application. A player aged 12 or
 * younger gets the smiley rating instead of SUS and UEQ, which are written for adults (requirement FBK-14).
 */
export function FeedbackPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isPsychologist = user?.role === Role.Psychologist
  const targets: FeedbackTarget[] = isPsychologist ? ['game', 'webapp'] : ['game']

  const infos = usePlayerInfos(user && !isPsychologist ? [user.playerId] : [])
  const definitions = useInstruments()
  const [target, setTarget] = useState<FeedbackTarget>('game')
  const [open, setOpen] = useState<InstrumentId | null>(null)
  const [sent, setSent] = useState<string[]>([])

  // The age comes from the player's own info. While it loads nothing is offered, so no wrong form flashes up.
  const ageKnown = isPsychologist || !user || !infos.isPending
  const age = user ? infos.data?.get(user.playerId)?.age : null
  const offered: InstrumentId[] = !isPsychologist && ageBandOf(age) === 'child' ? ['SMILEY'] : ['SUS', 'UEQ']

  const changeTarget = (next: FeedbackTarget) => {
    setTarget(next)
    setOpen(null)
  }

  return (
    <>
      <PageHeader title={t('feedback.title')} subtitle={t(isPsychologist ? 'feedback.subtitleWebapp' : 'feedback.subtitleGame')} />

      <div className="space-y-6">
        <Card title={t('feedback.questionnaires')} subtitle={t('feedback.questionnairesHint')}>
          {targets.length > 1 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-medium text-slate-700" id="rate-target">{t('feedback.rate')}</p>
              <div role="radiogroup" aria-labelledby="rate-target" className="inline-grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
                {targets.map((option) => (
                  <button
                    key={option} type="button" role="radio" aria-checked={target === option} onClick={() => changeTarget(option)}
                    className={cn('rounded-md px-3 py-1.5', target === option ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
                  >
                    {targetLabel(t, option)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!ageKnown ? <LoadingBlock /> : (
            <QueryBoundary query={definitions}>
              {(all) => (
                <ul className="divide-y divide-slate-100">
                  {all.filter((d) => offered.includes(d.id) && d.targets.includes(target)).map((definition) => {
                    const key = `${definition.id}:${target}`
                    const isOpen = open === definition.id
                    return (
                      <li key={key} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{instrumentName(t, definition.id)}</p>
                            <p className="text-sm text-slate-600">{t(`feedback.instruments.${definition.id}.hint`)}</p>
                            {sent.includes(key) && !isOpen && <p role="status" className="mt-1 text-sm text-emerald-700">{t('feedback.thanks')}</p>}
                          </div>
                          <Button variant={isOpen ? 'secondary' : 'primary'} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : definition.id)}>
                            {isOpen ? t('feedback.hide') : t('feedback.fillIn')}
                          </Button>
                        </div>
                        {isOpen && (
                          <div className="mt-4">
                            <QuestionnaireForm
                              // A different target is a different form with its own answers
                              key={key}
                              definition={definition}
                              target={target}
                              onSent={() => { setSent((list) => [...list, key]); setOpen(null) }}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </QueryBoundary>
          )}
        </Card>

        <Card title={t('feedback.message.title')}>
          <MessageForm targets={targets} />
        </Card>

        <MySubmissions />
      </div>
    </>
  )
}
