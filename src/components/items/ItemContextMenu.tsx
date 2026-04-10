import { useState, useRef, useEffect } from 'react'
import type { Item } from '../../types'
import { ipc } from '../../utils/ipc'
import { CtxIcon } from './ItemIcons'

interface ItemContextMenuProps {
  item:         Item
  x:            number
  y:            number
  onClose:      () => void
  onDelete:     () => void
  onBulkSelect: () => void
}

export default function ItemContextMenu({
  item, x, y, onClose, onDelete, onBulkSelect,
}: ItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Reposition if near screen edge
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: rect.right  > window.innerWidth  ? x - rect.width  : x,
      y: rect.bottom > window.innerHeight ? y - rect.height : y,
    })
  }, [x, y])

  useEffect(() => {
    function onKey(e: KeyboardEvent)  { if (e.key === 'Escape') onClose() }
    function onMouse(e: MouseEvent)   { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown',   onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown',   onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [onClose])

  async function handleOpenInWebview() {
    // For local .html files (software type), convert Windows path → file:// URL.
    // URL type items already carry a proper http/https URL - pass through unchanged.
    let url = item.path
    if (item.type === 'software' && /\.html?$/i.test(item.path)) {
      // pathToFileURL handles backslashes and spaces correctly on Windows
      url = item.path.replace(/\\/g, '/').replace(/^([a-zA-Z]:)/, '/$1')
      url = `file://${url}`
    }
    await ipc.webview.open(url).catch(console.error)
    onClose()
  }

  async function handleCopyPath() {
    await ipc.system.copyToClipboard(item.path).catch(console.error)
    onClose()
  }

  const rowBase = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-base duration-base text-left hover:bg-surface-3'

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 rounded-btn shadow-modal border border-surface-4 py-1 min-w-[168px]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Open in Webview - URL type, or local .html/.htm files */}
      {(item.type === 'url' || (item.type === 'software' && /\.html?$/i.test(item.path))) && (
        <>
          <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
            onClick={handleOpenInWebview}>
            <CtxIcon.Webview />
            <span className="flex-1">Open in Webview</span>
          </button>
          <div className="my-1 border-t border-surface-4" />
        </>
      )}

      {/* Select */}
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
        onClick={() => { onBulkSelect(); onClose() }}>
        <CtxIcon.Select />
        <span>Select</span>
      </button>

      {/* Copy Path / URL */}
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`} onClick={handleCopyPath}>
        <CtxIcon.Copy />
        <span>{item.type === 'url' ? 'Copy URL' : 'Copy Path'}</span>
      </button>

      <div className="my-1 border-t border-surface-4" />

      {/* Delete */}
      <button className={`${rowBase} text-danger hover:text-danger`}
        onClick={() => { onDelete(); onClose() }}>
        <CtxIcon.Delete />
        <span>Delete</span>
      </button>
    </div>
  )
}
