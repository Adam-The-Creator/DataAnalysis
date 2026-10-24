import { useTranslation } from 'react-i18next'
import type { RecentDrawing } from '@/api/types'
import { formatDate } from '@/lib/format'

/** A list of all drawings to choose from, newest first: name, participant, session and date tell them apart. */
export function DrawingPicker({ label, value, onChange, items }: {
  label: string
  value: string | undefined
  onChange: (id: string) => void
  items: RecentDrawing[]
}) {
  const { t } = useTranslation()
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {!value && <option value="">{t('compare.choose')}</option>}
        {items.map((item) => (
          <option key={item.meta.id} value={item.meta.id}>
            {item.meta.name} · {item.playerName} · {item.sessionName} · {formatDate(item.date)}
          </option>
        ))}
      </select>
    </label>
  )
}
