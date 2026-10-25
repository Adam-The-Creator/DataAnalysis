import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { placeTooltip } from '@/lib/tooltipPosition'

/**
 * A small "i" that explains something (the definitions of the metrics, the reasons behind an indicator). The explanation
 * is drawn in a layer of its own on top of the page (a portal into <body>, position: fixed), so no card, table or
 * scrolling container can clip it or hide it behind something, and it is kept inside the window at every edge.
 * It shows on hover and on keyboard focus, a click or tap keeps it open, and Escape, a click elsewhere or scrolling closes it.
 */
export function InfoTip({ text }: { text: string }) {
  const { t } = useTranslation()
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const visible = hover || focus || pinned

  // Measure the trigger and the bubble, then put the bubble where it fits. Until then it is invisible.
  useLayoutEffect(() => {
    const anchor = trigger.current
    const tip = bubble.current
    if (!visible || !anchor || !tip) {
      setPlace(null)
      return
    }
    const rect = anchor.getBoundingClientRect()
    const size = tip.getBoundingClientRect()
    const { left, top } = placeTooltip(
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { width: size.width, height: size.height },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setPlace({ left, top })
  }, [visible, text])

  useEffect(() => {
    if (!visible) return
    const close = () => {
      setHover(false)
      setFocus(false)
      setPinned(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node)) setPinned(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', close, true) // any scrolling container
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [visible])

  return (
    <span className="inline-flex align-middle">
      <button
        ref={trigger}
        type="button"
        aria-label={t('common.moreInfo')}
        aria-describedby={visible ? id : undefined}
        aria-expanded={visible}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={(event) => {
          // Only keyboard focus opens it: a click focuses the button too, and the click already decides
          let keyboard = true
          try {
            keyboard = event.currentTarget.matches(':focus-visible')
          } catch {
            // an old browser: show it on any focus
          }
          setFocus(keyboard)
        }}
        onBlur={() => setFocus(false)}
        onClick={() => setPinned((open) => !open)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 hover:border-indigo-400 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        i
      </button>
      {visible &&
        createPortal(
          <span
            ref={bubble}
            id={id}
            role="tooltip"
            style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
            className="pointer-events-none fixed z-[1000] w-64 max-w-[calc(100vw-1rem)] rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-snug text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
