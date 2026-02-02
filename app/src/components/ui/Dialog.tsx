import { useEffect, useId, useRef } from 'react'

import styles from './Dialog.module.css'

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> = (e) => {
    // Clicks on the <dialog> element itself are backdrop clicks.
    if (e.target === dialogRef.current) onClose()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      // Prevent native close so our state stays source-of-truth.
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()

      // Ensure input focus lands inside the modal (native autofocus can be flaky
      // when the dialog is opened programmatically).
      requestAnimationFrame(() => {
        const explicit = dialog.querySelector<HTMLElement>('[autofocus]')
        const fallback = dialog.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select')
        const target = explicit ?? fallback
        target?.focus()
        if (target && target instanceof HTMLInputElement) target.select()
      })
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.backdropDialog}
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Aizvērt">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function DialogBody({ children }: { children: React.ReactNode }) {
  return <div className={styles.body}>{children}</div>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className={styles.footer}>{children}</div>
}

// eslint-disable-next-line react-refresh/only-export-components
export const dialogStyles = styles
