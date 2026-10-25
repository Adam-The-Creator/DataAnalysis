import { authorColor } from '@/lib/authorColors'

export interface ScatterPoint {
  id: string
  x: number
  y: number
  /** Index of the group (participant, game type): picks the colour AND the shape, so colour is never the only cue. */
  group: number
  label: string
  /** A dashed ring around the point. */
  ring?: boolean
}

const W = 440
const H = 300
const PAD = { left: 44, right: 14, top: 14, bottom: 40 }

export function Marker({ shape, x, y, size, fill, stroke, strokeWidth = 1 }: {
  shape: number; x: number; y: number; size: number; fill: string; stroke: string; strokeWidth?: number
}) {
  const s = size
  const common = { fill, stroke, strokeWidth }
  switch (shape % 5) {
    case 0: return <circle cx={x} cy={y} r={s} {...common} />
    case 1: return <rect x={x - s} y={y - s} width={s * 2} height={s * 2} {...common} />
    case 2: return <polygon points={`${x},${y - s * 1.2} ${x + s * 1.1},${y + s} ${x - s * 1.1},${y + s}`} {...common} />
    case 3: return <polygon points={`${x},${y - s * 1.3} ${x + s * 1.3},${y} ${x},${y + s * 1.3} ${x - s * 1.3},${y}`} {...common} />
    default: return <polygon points={`${x - s * 0.4},${y - s} ${x + s * 0.4},${y - s} ${x + s * 0.4},${y - s * 0.4} ${x + s},${y - s * 0.4} ${x + s},${y + s * 0.4} ${x + s * 0.4},${y + s * 0.4} ${x + s * 0.4},${y + s} ${x - s * 0.4},${y + s} ${x - s * 0.4},${y + s * 0.4} ${x - s},${y + s * 0.4} ${x - s},${y - s * 0.4} ${x - s * 0.4},${y - s * 0.4}`} {...common} />
  }
}

/**
 * A scatter plot of the drawings of a group on two axes (the PCA map of AI-10). Each group has its own colour and shape,
 * every point has a text for screen readers and a tooltip, and a point can be chosen with the keyboard.
 */
export function ScatterChart({ points, groups, highlightId, onSelect, xLabel, yLabel, ariaLabel }: {
  points: ScatterPoint[]
  groups: string[]
  highlightId?: string
  onSelect?: (id: string) => void
  xLabel: string
  yLabel: string
  ariaLabel: string
}) {
  if (points.length === 0) return null
  const pad = (low: number, high: number): [number, number] => {
    const span = high - low || 1
    return [low - span * 0.1, high + span * 0.1]
  }
  const [x0, x1] = pad(Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x)))
  const [y0, y1] = pad(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)))
  const sx = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * (W - PAD.left - PAD.right)
  const sy = (v: number) => H - PAD.bottom - ((v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom)

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full max-w-xl">
        <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} fill="#fff" stroke="#e2e8f0" />
        {x0 < 0 && x1 > 0 && <line x1={sx(0)} x2={sx(0)} y1={PAD.top} y2={H - PAD.bottom} stroke="#cbd5e1" strokeDasharray="3 3" />}
        {y0 < 0 && y1 > 0 && <line x1={PAD.left} x2={W - PAD.right} y1={sy(0)} y2={sy(0)} stroke="#cbd5e1" strokeDasharray="3 3" />}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 8} textAnchor="middle" className="fill-slate-600 text-[11px]">{xLabel}</text>
        <text transform={`translate(12 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="fill-slate-600 text-[11px]">{yLabel}</text>
        {points.map((p) => {
          const highlighted = p.id === highlightId
          const cx = sx(p.x)
          const cy = sy(p.y)
          return (
            <g
              key={p.id}
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? 'link' : undefined}
              aria-label={p.label}
              className={onSelect ? 'cursor-pointer outline-none focus-visible:[&>circle]:stroke-indigo-600' : undefined}
              onClick={() => onSelect?.(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(p.id) }}
            >
              <title>{p.label}</title>
              {p.ring && <circle cx={cx} cy={cy} r={11} fill="none" stroke="#7c3aed" strokeDasharray="3 2" strokeWidth={1.5} />}
              {highlighted && <circle cx={cx} cy={cy} r={13} fill="none" stroke="#0f172a" strokeWidth={2} />}
              <Marker shape={p.group} x={cx} y={cy} size={highlighted ? 6.5 : 5} fill={authorColor(p.group)} stroke="#0f172a" strokeWidth={highlighted ? 1.5 : 0.8} />
            </g>
          )
        })}
      </svg>
      {groups.length > 0 && (
        <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {groups.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <svg viewBox="-8 -8 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <Marker shape={i} x={0} y={0} size={5} fill={authorColor(i)} stroke="#0f172a" strokeWidth={0.8} />
              </svg>
              {name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}
