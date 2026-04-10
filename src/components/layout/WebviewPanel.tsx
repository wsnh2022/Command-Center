import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, LogOut, X } from 'lucide-react'

interface WebviewPanelProps {
  position:   'right' | 'bottom'
  currentUrl: string
  /** Fixed width in right mode, height in bottom mode */
  size:       number
  onBack:     () => void
  onForward:  () => void
  onReload:   () => void
  onEject:    () => void
  onClose:    () => void
  onNavigate: (url: string) => void
  /** Called with new width (right) or new height (bottom) */
  onResize:   (size: number) => void
}

export default function WebviewPanel({
  position, currentUrl, size, onBack, onForward, onReload, onEject, onClose, onNavigate, onResize,
}: WebviewPanelProps) {
  const [urlValue,  setUrlValue]  = useState(currentUrl)
  const isFocused  = useRef(false)
  const isDragging = useRef(false)
  const isBottom   = position === 'bottom'

  // Sync URL input when navigating, but not while the user is editing
  useEffect(() => {
    if (!isFocused.current) setUrlValue(currentUrl)
  }, [currentUrl])

  function handleUrlKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let url = urlValue.trim()
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      if (url) { onNavigate(url); e.currentTarget.blur() }
    } else if (e.key === 'Escape') {
      setUrlValue(currentUrl)
      e.currentTarget.blur()
    }
  }

  // ── Drag handle (pointer capture) ──────────────────────────────────────────
  // Right mode: drag strip on left edge → changes width
  // Bottom mode: drag strip on top edge → changes height
  function handleDragDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!isDragging.current || !isBottom) return
    // Bottom mode only - distance from cursor to bottom of viewport = new panel height
    const newH = window.innerHeight - e.clientY
    onResize(Math.max(200, Math.min(Math.floor(window.innerHeight * 0.6), newH)))
  }

  function handleDragUp() { isDragging.current = false }

  // ── Shared nav controls ─────────────────────────────────────────────────────
  const navBtnCls = 'p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors duration-fast'

  const NavControls = (
    <>
      <button onClick={onBack}    className={navBtnCls} aria-label="Back">    <ChevronLeft  size={15} /></button>
      <button onClick={onForward} className={navBtnCls} aria-label="Forward"> <ChevronRight size={15} /></button>
      <button onClick={onReload}  className={navBtnCls} aria-label="Reload">  <RefreshCw    size={14} /></button>

      <input
        type="text"
        value={urlValue}
        onChange={e => setUrlValue(e.target.value)}
        onFocus={() => { isFocused.current = true; setUrlValue(currentUrl) }}
        onBlur={() =>  { isFocused.current = false; setUrlValue(currentUrl) }}
        onKeyDown={handleUrlKeyDown}
        className={[
          'flex-1 min-w-0 mx-1 px-2 py-0.5 rounded text-xs truncate',
          'bg-surface-3 border border-surface-4 text-text-secondary',
          'focus:outline-none focus:border-accent focus:text-text-primary',
          'focus:shadow-[0_0_0_2px_var(--accent-soft)] transition-colors duration-fast',
        ].join(' ')}
        aria-label="Current URL"
        spellCheck={false}
      />

      <button onClick={onEject} className={navBtnCls} aria-label="Open in browser" title="Open in browser">
        <LogOut size={14} />
      </button>
      <button onClick={onClose} className={navBtnCls} aria-label="Close panel">
        <X size={15} />
      </button>
    </>
  )

  // ── Right mode layout - fixed width, no resize handle ──────────────────────
  if (!isBottom) {
    return (
      <div
        className="flex flex-col h-full bg-surface-1 border-l border-surface-4 shadow-panel"
        style={{ width: size, flexShrink: 0 }}
      >
        {/* Header bar */}
        <div className="flex items-center gap-1 px-2 h-10 border-b border-surface-4 shrink-0">
          {NavControls}
        </div>

        {/* BrowserView fills this area - managed by main process */}
        <div className="flex-1 bg-surface-0" />
      </div>
    )
  }

  // ── Bottom mode layout ──────────────────────────────────────────────────────
  return (
    <div
      className="relative flex flex-col w-full bg-surface-1 border-t border-surface-4 shadow-panel"
      style={{ height: size, flexShrink: 0 }}
    >
      {/* Drag handle - top edge, 8px tall */}
      <div
        className="absolute top-0 inset-x-0 h-2 cursor-row-resize z-10 hover:bg-accent/30 transition-colors duration-fast"
        style={{ touchAction: 'none' }}
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
        onPointerCancel={handleDragUp}
        aria-label="Resize panel"
      />

      {/* Header bar - sits below drag handle */}
      <div className="flex items-center gap-1 px-2 h-10 border-b border-surface-4 shrink-0 mt-2">
        {NavControls}
      </div>

      {/* BrowserView fills this area - managed by main process */}
      <div className="flex-1 bg-surface-0" />
    </div>
  )
}
