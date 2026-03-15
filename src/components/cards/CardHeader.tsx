import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { Card } from '../../types'

interface CardHeaderProps {
  card:        Card
  accentColor: string
  onRename:    (id: string, name: string) => Promise<void>
  onDelete:    (id: string) => Promise<void>
}

// ── Fixed-position dropdown — avoids card overflow clipping ─────────────────

interface MenuPos { x: number; y: number }

function CardMenu({
  pos, onRename, onDelete, onClose,
}: {
  pos:      MenuPos
  onRename: () => void
  onDelete: () => void
  onClose:  () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [finalPos, setFinalPos] = useState(pos)

  // Reposition if near right/bottom edge
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setFinalPos({
      x: rect.right  > window.innerWidth  ? pos.x - rect.width  : pos.x,
      y: rect.bottom > window.innerHeight ? pos.y - rect.height : pos.y,
    })
  }, [pos.x, pos.y])

  // Close on outside click or Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent)  { if (e.key === 'Escape') onClose() }
    function onMouse(e: MouseEvent)   {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown',   onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown',   onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [onClose])

  const row = 'w-full flex items-center gap-2 px-3 py-2 text-xs transition-base duration-base text-left'

  return (
    <div
      ref={ref}
      className="fixed z-50 w-40 bg-surface-2 rounded-btn shadow-modal border border-surface-4 py-1"
      style={{ left: finalPos.x, top: finalPos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      <button
        className={`${row} text-text-secondary hover:text-text-primary hover:bg-surface-3`}
        onClick={() => { onRename(); onClose() }}
      >
        <Pencil size={12} strokeWidth={1.75} /> Rename
      </button>
      <div className="my-1 border-t border-surface-4" />
      <button
        className={`${row} text-danger hover:bg-surface-3`}
        onClick={() => { onDelete(); onClose() }}
      >
        <Trash2 size={12} strokeWidth={1.75} /> Delete Card
      </button>
    </div>
  )
}

// ── Card header ──────────────────────────────────────────────────────────────

export default function CardHeader({ card, accentColor, onRename, onDelete }: CardHeaderProps) {
  const [editing,  setEditing]  = useState(false)
  const [menuPos,  setMenuPos]  = useState<MenuPos | null>(null)
  const [editName, setEditName] = useState(card.name)
  const inputRef  = useRef<HTMLInputElement>(null)
  const btnRef    = useRef<HTMLButtonElement>(null)

  useEffect(() => { setEditName(card.name) }, [card.name])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function openMenu() {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    // Position below the button, right-aligned to it
    setMenuPos({ x: rect.right - 160, y: rect.bottom + 4 })
  }

  async function commitRename() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== card.name) await onRename(card.id, trimmed).catch(console.error)
    else setEditName(card.name)
    setEditing(false)
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-b border-surface-4"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {card.icon && <span className="text-base leading-none shrink-0">{card.icon}</span>}

      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter')  commitRename()
            if (e.key === 'Escape') { setEditName(card.name); setEditing(false) }
          }}
          maxLength={64}
          className="flex-1 text-sm font-medium text-text-primary bg-surface-3 rounded-input px-2 h-6 outline-none border border-accent"
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-text-primary truncate cursor-default"
          onDoubleClick={() => setEditing(true)}
        >
          {card.name}
        </span>
      )}

      <button
        ref={btnRef}
        onClick={openMenu}
        className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base shrink-0"
      >
        <MoreVertical size={13} />
      </button>

      {menuPos && (
        <CardMenu
          pos={menuPos}
          onRename={() => setEditing(true)}
          onDelete={() => onDelete(card.id).catch(console.error)}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  )
}
