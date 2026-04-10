/**
 * ConfirmDialog.tsx - themed in-app confirmation dialog
 *
 * Replaces window.confirm and dialog.showMessageBox entirely.
 * Renders as a portal overlay matching CommandDeck's surface/text/accent tokens.
 * Supports a 'danger' variant that styles the confirm button in red.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'

export interface ConfirmDialogProps {
  title:         string
  message:       string
  detail?:       string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      'danger' | 'info'
  onConfirm:     () => void
  onCancel:      () => void
}

export default function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus cancel by default - avoids accidental confirms on Enter
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Escape = cancel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const isDanger = variant === 'danger'

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="relative w-[360px] rounded-lg shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--surface-4)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{ backgroundColor: isDanger ? '#ef4444' : 'var(--accent)' }}
        />

        {/* Body */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {/* Icon badge */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center mt-0.5"
              style={{
                backgroundColor: isDanger ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                color: isDanger ? '#ef4444' : 'var(--accent)',
              }}
            >
              {isDanger
                ? <AlertTriangle size={16} strokeWidth={2} />
                : <Info          size={16} strokeWidth={2} />
              }
            </div>

            {/* Text block */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold leading-snug"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </p>
              <p
                className="text-xs mt-1 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {message}
              </p>
              {detail && (
                <p
                  className="text-[11px] mt-1.5 leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {detail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--surface-4)' }}
        >
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-3.5 h-7 rounded text-xs font-medium"
            style={{
              backgroundColor: 'var(--surface-3)',
              color:            'var(--text-secondary)',
              border:           '1px solid var(--surface-4)',
              transition:       'color 100ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 h-7 rounded text-xs font-medium"
            style={{
              backgroundColor: isDanger ? '#ef4444' : 'var(--accent)',
              color:           '#ffffff',
              border:          '1px solid transparent',
              transition:      'background-color 100ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                isDanger ? '#dc2626' : 'var(--accent-hover)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                isDanger ? '#ef4444' : 'var(--accent)'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
