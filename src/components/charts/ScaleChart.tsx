import type { ReactNode } from 'react'

export interface ScaleRow {
  label: ReactNode
  value: number
  /** The ends of a confidence interval, drawn as a line through the bar. */
  low?: number
  high?: number
}

/**
 * Horizontal bars on a fixed scale (the questionnaire scores): from the zero line, or from the left end when the
 * scale has no negative part, with the value written next to each bar so nothing depends on colour alone
 * (requirement TEC-10). A line through the bar is the confidence interval. A small in-house component, like BarList.
 */
export function ScaleChart({ rows, min, max, ariaLabel, format = (v) => String(v) }: {
  rows: ScaleRow[]
  min: number
  max: number
  ariaLabel: string
  format?: (value: number) => string
}) {
  const pct = (value: number) => `${((Math.max(min, Math.min(max, value)) - min) / (max - min)) * 100}%`
  const zero = Math.max(min, Math.min(max, 0))

  return (
    <div>
      <div className="grid grid-cols-[minmax(7rem,14rem)_1fr_minmax(5rem,9rem)] items-center gap-3 pb-1 text-xs text-slate-500" aria-hidden="true">
        <span />
        <span className="flex justify-between">
          <span>{format(min)}</span>
          {min < 0 && max > 0 && <span>{format(0)}</span>}
          <span>{format(max)}</span>
        </span>
        <span />
      </div>
      <ul aria-label={ariaLabel} className="space-y-1.5">
        {rows.map((row, index) => {
          const from = Math.min(zero, row.value)
          const to = Math.max(zero, row.value)
          const interval = row.low !== undefined && row.high !== undefined ? [row.low, row.high] : null
          return (
            <li key={index} className="grid grid-cols-[minmax(7rem,14rem)_1fr_minmax(5rem,9rem)] items-center gap-3 text-sm">
              <span className="text-slate-600">{row.label}</span>
              <span className="relative h-4 rounded bg-slate-100">
                <span
                  className="absolute top-0 h-4 rounded bg-indigo-500"
                  style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }}
                />
                {min < 0 && max > 0 && <span className="absolute top-0 h-4 w-px bg-slate-500" style={{ left: pct(0) }} />}
                {interval && (
                  <>
                    <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-900" style={{ left: pct(interval[0]), width: `calc(${pct(interval[1])} - ${pct(interval[0])})` }} />
                    <span className="absolute top-0.5 h-3 w-0.5 bg-slate-900" style={{ left: pct(interval[0]) }} />
                    <span className="absolute top-0.5 h-3 w-0.5 bg-slate-900" style={{ left: pct(interval[1]) }} />
                  </>
                )}
              </span>
              <span className="text-right tabular-nums text-slate-900">
                {format(row.value)}
                {interval && <span className="block text-xs text-slate-500">{format(interval[0])} to {format(interval[1])}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
