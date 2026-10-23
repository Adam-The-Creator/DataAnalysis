/**
 * Horizontal bars with the value written next to each bar, so nothing depends on colour alone (requirement TEC-10).
 * A small in-house component: the charting library is still an open decision (requirements, "Open points").
 */
export function BarList({ data, ariaLabel }: { data: { label: string; value: number }[]; ariaLabel: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul aria-label={ariaLabel} className="space-y-2">
      {data.map((item) => (
        <li key={item.label} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-600" title={item.label}>{item.label}</span>
          <span className="h-3 rounded-full bg-slate-100">
            <span className="block h-3 rounded-full bg-indigo-500" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums text-slate-900">{item.value}</span>
        </li>
      ))}
    </ul>
  )
}
