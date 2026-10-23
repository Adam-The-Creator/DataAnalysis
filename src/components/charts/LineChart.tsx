interface LinePoint {
  label: string
  value: number
}

/** A simple line chart of counts over time. Every point shows its value in a tooltip and in the label row. */
export function LineChart({ points, ariaLabel }: { points: LinePoint[]; ariaLabel: string }) {
  const width = 560
  const height = 200
  const pad = { left: 30, right: 14, top: 14, bottom: 30 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const innerWidth = width - pad.left - pad.right
  const x = (i: number) => pad.left + (points.length === 1 ? innerWidth / 2 : (i * innerWidth) / (points.length - 1))
  const y = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom)

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const area = `${x(0)},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`
  const labelEvery = Math.ceil(points.length / 7)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="w-full">
      {[0, max].map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" />
          <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">{tick}</text>
        </g>
      ))}
      <polygon points={area} fill="#e0e7ff" opacity="0.7" />
      <polyline points={line} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill="#4f46e5" stroke="#fff" strokeWidth="1.5">
            <title>{`${p.label}: ${p.value}`}</title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={height - 10} textAnchor="middle" fontSize="11" fill="#64748b">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
