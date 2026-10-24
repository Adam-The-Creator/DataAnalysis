import type { ReactNode } from 'react'
import { buttonClass } from './buttonStyles'

/** A button that opens a small panel (a <details> element, so it works with the keyboard and without any script). */
export function Menu({ label, children, align = 'right' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <details className="relative">
      <summary className={`${buttonClass('secondary')} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        {label}
        <span aria-hidden="true">▾</span>
      </summary>
      <div
        className={`absolute z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {children}
      </div>
    </details>
  )
}
