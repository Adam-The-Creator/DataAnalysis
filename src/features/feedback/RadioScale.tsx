import { cn } from '@/lib/cn'

/** A row of numbered circles, one of which is chosen. The caller gives every circle its spoken name. */
export function RadioScale({ name, min, max, value, onChange, optionLabel, className }: {
  name: string
  min: number
  max: number
  value: number | undefined
  onChange: (value: number) => void
  optionLabel: (n: number) => string
  className?: string
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div className={cn('flex items-center justify-between gap-1 sm:gap-2', className)}>
      {options.map((n) => (
        <label key={n} className="flex min-w-8 flex-col items-center gap-1 text-xs text-slate-600">
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            aria-label={optionLabel(n)}
            className="h-5 w-5 accent-indigo-600"
          />
          <span aria-hidden="true">{n}</span>
        </label>
      ))}
    </div>
  )
}
