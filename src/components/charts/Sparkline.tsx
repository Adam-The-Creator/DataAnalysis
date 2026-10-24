/** A tiny trend line without axes. It is always next to the numbers it draws, so nothing depends on seeing it. */
export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  if (values.length < 2) return null
  const [width, height, pad] = [90, 24, 3]
  const low = Math.min(...values)
  const span = Math.max(...values) - low || 1
  const step = (width - 2 * pad) / (values.length - 1)
  const points = values.map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - low) / span) * (height - 2 * pad)).toFixed(1)}`)
  const [lastX, lastY] = points[points.length - 1].split(',')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="inline-block align-middle">
      <polyline points={points.join(' ')} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="#4f46e5" />
    </svg>
  )
}
