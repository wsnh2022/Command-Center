/**
 * UndoToast.tsx
 *
 * Fixed-position toast that appears after a bulk destructive operation.
 * Shows a label, an Undo button, and a 5-second countdown progress bar.
 *
 * Props:
 *   label      - human-readable description of what was done
 *   onUndo     - called immediately when user clicks Undo
 *   onExpire   - called when the 5-second window closes naturally
 *
 * The parent is responsible for removing this component from the tree
 * in response to both onUndo and onExpire.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'

const DURATION_MS = 5000

interface UndoToastProps {
  label:    string
  onUndo:   () => void
  onExpire: () => void
}

export default function UndoToast({ label, onUndo, onExpire }: UndoToastProps) {
  const barRef    = useRef<HTMLDivElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Start the auto-expire timer on mount
  useEffect(() => {
    timerRef.current = setTimeout(onExpire, DURATION_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onExpire])

  // Animate the progress bar from full width to zero over DURATION_MS
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    // Force a reflow so the initial state registers before the transition starts
    bar.style.transition = 'none'
    bar.style.width = '100%'
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    bar.offsetWidth  // trigger reflow
    bar.style.transition = `width ${DURATION_MS}ms linear`
    bar.style.width = '0%'
  }, [])

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo()
  }

  return createPortal(
    <div
      className="fixed z-[300] overflow-hidden rounded-lg shadow-2xl"
      style={{
        bottom:          88,   // above BulkActionBar (bottom-6 = 24px + ~56px bar height)
        right:           24,
        width:           320,
        backgroundColor: 'var(--surface-3)',
        border:          '1px solid var(--surface-4)',
      }}
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex-1 text-[0.75rem] font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-2.5 h-6 rounded text-[0.72rem] font-semibold
                     shrink-0 transition-colors duration-fast"
          style={{
            backgroundColor: 'var(--accent-soft)',
            color:           'var(--accent)',
            border:          '1px solid var(--accent)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'
            ;(e.currentTarget as HTMLElement).style.color = '#fff'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-soft)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
          }}
        >
          <RotateCcw size={11} />
          Undo
        </button>
      </div>

      {/* Countdown bar */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: 'var(--surface-4)' }}
      >
        <div
          ref={barRef}
          className="h-full"
          style={{ backgroundColor: 'var(--accent)', width: '100%' }}
        />
      </div>
    </div>,
    document.body,
  )
}
