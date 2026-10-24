import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import type { ButtonVariant } from './buttonStyles'
import { ErrorPanel } from './states'

/**
 * A modal dialog on the native <dialog> element: focus stays inside, Escape closes it, and the page behind is inert.
 * The content is only rendered while it is open, so a form starts fresh every time.
 */
export function Dialog({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
    >
      {open && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  )
}

/** Asks before something that cannot be undone, and shows the server's message when it is refused. */
export function ConfirmDialog({ open, onClose, title, body, confirmLabel, variant = 'primary', busy, error, onConfirm }: {
  open: boolean
  onClose: () => void
  title: string
  body: string
  confirmLabel: string
  variant?: ButtonVariant
  busy?: boolean
  error?: unknown
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{body}</p>
      {error != null && <div className="mt-4"><ErrorPanel error={error} /></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={variant} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
