import { formatNumber } from '@/lib/format'

/** The colours of a drawing by share of the ink, as a stacked bar and a list with the exact values. */
export function PaletteBar({ palette, ariaLabel }: { palette: { hex: string; share: number }[]; ariaLabel: string }) {
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-4 overflow-hidden rounded-full ring-1 ring-slate-200">
        {palette.map((c) => (
          <span key={c.hex} style={{ width: `${c.share * 100}%`, background: c.hex }} title={c.hex} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {palette.map((c) => (
          <li key={c.hex} className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded ring-1 ring-slate-300" style={{ background: c.hex }} aria-hidden="true" />
            <span className="font-mono text-xs text-slate-600">{c.hex}</span>
            <span className="ml-auto tabular-nums text-slate-900">{formatNumber(c.share * 100, 0)} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
