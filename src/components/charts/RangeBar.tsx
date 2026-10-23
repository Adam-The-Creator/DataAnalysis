/** Min to max as a bar with a tick for the median. The scale is 0 to max, so it only compares within one metric. */
export function RangeBar({ min, median, max, ariaLabel }: { min: number; median: number; max: number; ariaLabel: string }) {
  const scale = max > 0 ? max : 1
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`
  return (
    <div role="img" aria-label={ariaLabel} className="relative h-3 min-w-24 rounded-full bg-slate-100">
      <div
        className="absolute inset-y-0 rounded-full bg-indigo-200"
        style={{ left: pct(min), width: `max(4px, calc(${pct(max)} - ${pct(min)}))` }}
      />
      <div className="absolute -inset-y-0.5 w-0.5 rounded bg-indigo-700" style={{ left: pct(median) }} />
    </div>
  )
}
