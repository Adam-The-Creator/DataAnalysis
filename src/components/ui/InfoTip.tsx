/** A small "i" that shows an explanation on hover or keyboard focus (metric definitions, requirement MET-02). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 hover:border-indigo-400 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-snug text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  )
}
