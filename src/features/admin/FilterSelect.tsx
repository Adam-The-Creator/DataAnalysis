const control = 'mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500'

/** A labelled drop-down of the filter bars. The empty value is "all". */
export function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}) {
  return (
    <label className="flex flex-col text-xs font-medium text-slate-600">
      {label}
      <select className={control} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col text-xs font-medium text-slate-600">
      {label}
      <input type="date" className={control} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
