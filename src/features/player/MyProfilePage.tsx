import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePlayerInfos, useUpdateMyInfo } from '@/api/hooks'
import type { PlayerInfo } from '@/api/types'
import { useAuth } from '@/auth/authContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorPanel, QueryBoundary } from '@/components/ui/states'

/** The values the game offers too (LobbyManager.cs), and the limits the server enforces (routers/players.py). */
const GENDERS = ['Male', 'Female', 'Other'] as const
const HANDS = ['Left', 'Right', 'Both'] as const
const NAME_MAX = 100
const AGE_MAX = 150

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500'

/** The age as typed: a whole number of years from 0 to AGE_MAX, an empty field meaning 0 (not given). Null when it is not valid. */
function parseAge(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  if (!/^\d{1,3}$/.test(trimmed)) return null
  const age = Number(trimmed)
  return age <= AGE_MAX ? age : null
}

/**
 * My profile: a player changes the information stored about them, the same four fields as in the game (name, gender,
 * age, dominant hand). The form checks the limits, the server checks them again and its message is shown if it refuses.
 */
export function MyProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const infos = usePlayerInfos(user ? [user.playerId] : [])

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/my" className="hover:text-indigo-700">← {t('nav.myRecords')}</Link>}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />
      <Card title={t('profile.card')}>
        <QueryBoundary query={infos}>
          {(loaded) => {
            const info = user ? loaded.get(user.playerId) : null
            return info && user
              ? <ProfileForm playerId={user.playerId} info={info} />
              : <p className="text-sm text-slate-500">{t('profile.notFound')}</p>
          }}
        </QueryBoundary>
      </Card>
    </>
  )
}

function ProfileForm({ playerId, info }: { playerId: string; info: PlayerInfo }) {
  const { t } = useTranslation()
  const { setName: showName } = useAuth()
  const update = useUpdateMyInfo(playerId)

  const stored = {
    name: info.name ?? '',
    gender: (GENDERS as readonly string[]).includes(info.gender ?? '') ? (info.gender ?? '') : '',
    age: String(info.age ?? 0),
    hand: (HANDS as readonly string[]).includes(info.dominantHand ?? '') ? (info.dominantHand ?? '') : '',
  }
  const [name, setName] = useState(stored.name)
  const [gender, setGender] = useState(stored.gender)
  const [age, setAge] = useState(stored.age)
  const [hand, setHand] = useState(stored.hand)
  const [saved, setSaved] = useState(false)

  const parsedAge = parseAge(age)
  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX && parsedAge !== null
  const changed = trimmed !== stored.name.trim() || gender !== stored.gender || (parsedAge ?? -1) !== (info.age ?? 0) || hand !== stored.hand

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || parsedAge === null) return
    setSaved(false)
    update.mutate(
      { name: trimmed, gender, age: parsedAge, dominantHand: hand },
      {
        onSuccess: () => {
          showName(trimmed)
          setSaved(true)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4" noValidate>
      <label className="block text-sm font-medium text-slate-700">
        {t('participants.name')}
        <input className={field} value={name} maxLength={NAME_MAX} required aria-invalid={trimmed.length === 0} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
        {trimmed.length === 0 && <span className="mt-1 block text-xs text-rose-700">{t('profile.nameRequired')}</span>}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          {t('participants.gender')}
          <select className={field} value={gender} onChange={(e) => { setGender(e.target.value); setSaved(false) }}>
            <option value="">{t('profile.notSet')}</option>
            {GENDERS.map((value) => <option key={value} value={value}>{t(`profile.genders.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {t('participants.dominantHand')}
          <select className={field} value={hand} onChange={(e) => { setHand(e.target.value); setSaved(false) }}>
            <option value="">{t('profile.notSet')}</option>
            {HANDS.map((value) => <option key={value} value={value}>{t(`profile.hands.${value}`)}</option>)}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        {t('participants.age')}
        <input
          className={`${field} sm:w-40`} type="number" inputMode="numeric" min={0} max={AGE_MAX} step={1} value={age}
          aria-invalid={parsedAge === null} aria-describedby="age-hint" onChange={(e) => { setAge(e.target.value); setSaved(false) }}
        />
        {parsedAge === null && <span className="mt-1 block text-xs text-rose-700">{t('profile.ageInvalid', { max: AGE_MAX })}</span>}
        <span id="age-hint" className="mt-1 block text-xs font-normal text-slate-500">{t('profile.ageHint')}</span>
      </label>

      {update.isError && <ErrorPanel error={update.error} />}
      {saved && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t('profile.saved')}</p>}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={update.isPending || !valid || !changed}>{t('profile.save')}</Button>
      </div>
    </form>
  )
}
