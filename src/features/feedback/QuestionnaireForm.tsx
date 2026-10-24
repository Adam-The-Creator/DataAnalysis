import type { TFunction } from 'i18next'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSendQuestionnaire } from '@/api/hooks'
import type { FeedbackTarget, InstrumentDefinition } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { subjectLabel } from '@/lib/feedbackLabels'
import { newClientId, type SmileyItemId, type SusItemId, type UeqItemId } from '@/lib/instruments'
import { FACES } from './faces'
import { RadioScale } from './RadioScale'
import { SendError } from './SendError'

type Face = 1 | 2 | 3 | 4 | 5

/**
 * A questionnaire to fill in (requirements FBK-10, FBK-11, FBK-14): SUS, UEQ or the smiley rating. The form is built
 * from the definition the server sent (item IDs, scale), the texts come from the translations. All items are required.
 * The ID of the submission is made here, so a retry after a lost answer is the same submission and not a second one.
 */
export function QuestionnaireForm({ definition, target, onSent }: {
  definition: InstrumentDefinition
  target: FeedbackTarget
  onSent: () => void
}) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [clientId, setClientId] = useState(newClientId)
  const [tried, setTried] = useState(false)
  const send = useSendQuestionnaire()
  const subject = subjectLabel(t, target)

  const total = definition.itemIds.length
  const done = definition.itemIds.filter((id) => answers[id] !== undefined).length
  const complete = done === total

  function submit(event: FormEvent) {
    event.preventDefault()
    setTried(true)
    if (!complete) return
    send.mutate(
      { clientId, instrument: definition.id, version: definition.version, target, answers },
      {
        onSuccess: () => {
          setAnswers({})
          setClientId(newClientId())
          setTried(false)
          onSent()
        },
      },
    )
  }

  const choose = (id: string) => (value: number) => setAnswers((current) => ({ ...current, [id]: value }))
  const unanswered = (id: string) => tried && answers[id] === undefined

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {definition.id === 'UEQ' && <p className="text-sm text-slate-600">{t('instruments.ueq.intro', { subject })}</p>}

      <ol className="space-y-3">
        {definition.itemIds.map((id, index) => (
          <li
            key={id}
            className={cn('rounded-lg border p-3', unanswered(id) ? 'border-rose-300 bg-rose-50' : 'border-slate-200')}
          >
            {definition.id === 'SUS' && (
              <Item number={index + 1} prompt={t(`instruments.sus.items.${id as SusItemId}`, { subject })} name={id}>
                <RadioScale
                  name={id} min={definition.scaleMin} max={definition.scaleMax} value={answers[id]} onChange={choose(id)}
                  optionLabel={(n) => `${n}: ${t(`instruments.sus.scale.${n as 1 | 2 | 3 | 4 | 5}`)}`}
                  className="max-w-md"
                />
                <ScaleEnds left={t('instruments.sus.scale.1')} right={t('instruments.sus.scale.5')} />
              </Item>
            )}
            {definition.id === 'UEQ' && (
              <UeqItem
                number={index + 1} id={id as UeqItemId} t={t} value={answers[id]} onChange={choose(id)}
                min={definition.scaleMin} max={definition.scaleMax}
              />
            )}
            {definition.id === 'SMILEY' && (
              <Item number={index + 1} prompt={t(`instruments.smiley.items.${id as SmileyItemId}`)} name={id}>
                <Faces name={id} value={answers[id]} onChange={choose(id)} t={t} />
              </Item>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={send.isPending}>
          {send.isPending ? t('feedback.sending') : t('feedback.send')}
        </Button>
        <span className="text-sm text-slate-600" aria-live="polite">{t('feedback.progress', { done, total })}</span>
        {tried && !complete && <span role="alert" className="text-sm text-rose-700">{t('feedback.incomplete')}</span>}
      </div>
      {send.isError && <SendError error={send.error} />}
    </form>
  )
}

function Item({ number, prompt, name, children }: { number: number; prompt: string; name: string; children: ReactNode }) {
  return (
    <fieldset aria-describedby={`${name}-prompt`}>
      <legend className="sr-only">{prompt}</legend>
      <p id={`${name}-prompt`} className="mb-2 text-sm font-medium text-slate-900">
        <span className="mr-2 text-slate-500">{number}.</span>{prompt}
      </p>
      {children}
    </fieldset>
  )
}

const ScaleEnds = ({ left, right }: { left: string; right: string }) => (
  <div className="mt-1 flex max-w-md justify-between text-xs text-slate-500" aria-hidden="true">
    <span>{left}</span>
    <span>{right}</span>
  </div>
)

/** Two opposite words with a scale between them. */
function UeqItem({ number, id, t, value, onChange, min, max }: {
  number: number
  id: UeqItemId
  t: TFunction
  value: number | undefined
  onChange: (value: number) => void
  min: number
  max: number
}) {
  const left = t(`instruments.ueq.items.${id}.left`)
  const right = t(`instruments.ueq.items.${id}.right`)
  return (
    <fieldset>
      <legend className="sr-only">{`${left} / ${right}`}</legend>
      <div className="grid items-center gap-2 sm:grid-cols-[10rem_1fr_10rem]">
        <span className="text-sm font-medium text-slate-900 sm:text-right"><span className="mr-2 text-slate-500">{number}.</span>{left}</span>
        <RadioScale
          name={id} min={min} max={max} value={value} onChange={onChange}
          optionLabel={(n) => (n === min ? left : n === max ? right : `${n} of ${max}`)}
        />
        <span className="text-sm font-medium text-slate-900">{right}</span>
      </div>
    </fieldset>
  )
}

/** Five faces from very sad to very happy; the face is never the only information, it has its name written under it. */
function Faces({ name, value, onChange, t }: { name: string; value: number | undefined; onChange: (value: number) => void; t: TFunction }) {
  return (
    <div className="flex flex-wrap gap-2">
      {([1, 2, 3, 4, 5] as Face[]).map((face) => (
        <label key={face} className="cursor-pointer">
          <input
            type="radio" name={name} value={face} checked={value === face} onChange={() => onChange(face)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex w-20 flex-col items-center gap-1 rounded-xl border-2 border-slate-200 px-2 py-2 text-xs text-slate-600',
              'hover:border-indigo-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-900',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600',
            )}
          >
            <span className="text-3xl leading-none" aria-hidden="true">{FACES[face - 1]}</span>
            {t(`feedback.faces.${face}`)}
          </span>
        </label>
      ))}
    </div>
  )
}
