import { useState, useRef, useEffect } from 'react'
import { Pin, PinOff } from 'lucide-react'
import type { Item, Card } from '../../types'
import { ipc } from '../../utils/ipc'
import { useFavorites } from '../../context/FavoritesContext'
import { ItemTypeIcon, CtxIcon } from './ItemIcons'

interface ItemContextMenuProps {
  item:         Item
  cards:        Card[]
  x:            number
  y:            number
  onClose:      () => void
  onEdit:       () => void
  onDelete:     () => void
  onBulkSelect: () => void
}

export default function ItemContextMenu({
  item, cards, x, y, onClose, onEdit, onDelete, onBulkSelect,
}: ItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const [pos, setPos] = useState({ x, y })

  const { favItemIds, pinItem, unpinItem } = useFavorites()
  const isPinned = favItemIds.has(item.id)

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
    await ipc.webview.open(item.path).catch(console.error)
    onClose()
  }

  async function handleCopyPath() {
    await ipc.system.copyToClipboard(item.path).catch(console.error)
    onClose()
  }

  async function handleMove(targetCardId: string) {
    await ipc.items.move(item.id, targetCardId).catch(console.error)
    onClose()
    window.dispatchEvent(new CustomEvent('command-center:itemMoved', { detail: { itemId: item.id, targetCardId } }))
  }

  async function handlePin() {
    await pinItem(item.id).catch(console.error)
    onClose()
  }

  async function handleUnpin() {
    await unpinItem(item.id).catch(console.error)
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
      {/* Open in Webview — URL type only */}
      {item.type === 'url' && (
        <>
          <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
            onClick={handleOpenInWebview}>
            <CtxIcon.Webview />
            <span className="flex-1">Open in Webview</span>
          </button>
          <div className="my-1 border-t border-surface-4" />
        </>
      )}

      {/* Pin / Unpin */}
      {isPinned
        ? (
          <button className={`${rowBase} text-text-secondary hover:text-text-primary`} onClick={handleUnpin}>
            <PinOff className="w-3.5 h-3.5" />
            <span>Unpin from Home</span>
          </button>
        ) : (
          <button className={`${rowBase} text-text-secondary hover:text-text-primary`} onClick={handlePin}>
            <Pin className="w-3.5 h-3.5" />
            <span>Pin to Home</span>
          </button>
        )
      }

      {/* Select */}
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
        onClick={() => { onBulkSelect(); onClose() }}>
        <CtxIcon.Select />
        <span>Select</span>
      </button>

      {/* Edit */}
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
        onClick={() => { onEdit(); onClose() }}>
        <CtxIcon.Edit />
        <span>Edit</span>
      </button>

      {/* Copy Path / URL */}
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`} onClick={handleCopyPath}>
        <CtxIcon.Copy />
        <span>{item.type === 'url' ? 'Copy URL' : 'Copy Path'}</span>
      </button>

      {/* Move to Card */}
      <div className="relative"
        onMouseEnter={() => setShowMoveSubmenu(true)}
        onMouseLeave={() => setShowMoveSubmenu(false)}
      >
        <button className={`${rowBase} text-text-secondary hover:text-text-primary`}>
          <CtxIcon.Move />
          <span className="flex-1">Move to Card</span>
          <span className="text-text-muted text-[11px]">▶</span>
        </button>
        {showMoveSubmenu && (
          <div className="absolute left-full top-0 bg-surface-2 rounded-btn shadow-modal border border-surface-4 py-1 min-w-[160px] z-50">
            {cards.filter(c => c.id !== item.cardId).length === 0
              ? <span className="px-3 py-2 text-xs text-text-muted block">No other cards</span>
              : cards.filter(c => c.id !== item.cardId).map(c => (
                  <button key={c.id}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base text-left"
                    onClick={() => handleMove(c.id)}>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))
            }
          </div>
        )}
      </div>

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

export { ItemTypeIcon }
