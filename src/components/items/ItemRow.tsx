import { useState, useEffect, useRef, memo } from 'react'
import { Pencil, Pin, PinOff, Copy, Check, Globe, Trash2, MousePointer, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { loadLucideIcon } from '../../utils/lucide-registry'
import { ItemTypeIcon } from './ItemIcons'
import { useResolvedIcon } from '../../hooks/useResolvedIcon'
import { useFavorites } from '../../context/FavoritesContext'
import { ipc } from '../../utils/ipc'
import type { LucideIcon } from 'lucide-react'
import type { Item } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DragListeners = Record<string, (...args: any[]) => void>

// Static className constants — extracted to avoid array allocation + join on every render
const ROW_BASE     = 'flex items-center gap-2 pl-0 pr-0 rounded-btn cursor-pointer select-none transition-base duration-base'
const GRIP_BASE    = 'absolute -left-2 flex items-center justify-center w-4 h-7 text-accent transition-all duration-fast cursor-grab active:cursor-grabbing'
const IMG_BASE     = 'w-7 h-7 object-contain rounded-sm'
const MARQUEE_BASE = 'marquee-clip text-sm font-medium transition-base duration-base text-text-primary'

// Async hook — loads a Lucide icon component by PascalCase name.
// Returns null while loading or if name is not found.
function useLucideIcon(name: string): LucideIcon | null {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (!name) return
    loadLucideIcon(name).then(setIcon)
  }, [name])
  return icon
}

interface ItemRowProps {
  item: Item
  onLaunch: (id: string) => void
  onEdit: () => void
  onDelete: () => void
  onActivateBulkSelect: () => void
  onContextMenu: (e: React.MouseEvent, item: Item) => void
  bulkMode: boolean
  selected: boolean
  onSelect: (id: string, selected: boolean) => void
  noteOpen: boolean
  onToggleNote: (e: React.MouseEvent) => void
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: DragListeners | undefined
  }
}

export default memo(function ItemRow({
  item, onLaunch, onEdit, onDelete, onActivateBulkSelect, onContextMenu,
  bulkMode, selected, onSelect, noteOpen, onToggleNote, dragHandleProps,
}: ItemRowProps) {
  const [hovered,      setHovered]      = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [deleteArmed,  setDeleteArmed]  = useState(false)
  const [copied,       setCopied]       = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { favItemIds, pinItem, unpinItem } = useFavorites()
  const isPinned = favItemIds.has(item.id)
  const clipRef  = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    if (copyTimerRef.current)   clearTimeout(copyTimerRef.current)
  }, [])

  const isWebviewable = item.type === 'url' || (item.type === 'software' && /\.html?$/i.test(item.path))

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    ipc.system.copyToClipboard(item.path).catch(console.error)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  function handleWebview(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isWebviewable) return
    let url = item.path
    if (item.type === 'software') {
      url = item.path.replace(/\\/g, '/').replace(/^([a-zA-Z]:)/, '/$1')
      url = `file://${url}`
    }
    ipc.webview.open(url).catch(console.error)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!deleteArmed) {
      setDeleteArmed(true)
      deleteTimerRef.current = setTimeout(() => setDeleteArmed(false), 2000)
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      setDeleteArmed(false)
      onDelete()
    }
  }

  function resetDeleteArm() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    setDeleteArmed(false)
  }
  const resolvedIcon = useResolvedIcon(
    item.iconPath, item.iconSource, item.type,
    item.type === 'url' ? item.path : undefined,
  )

  const hasNoteOrTags = (item.note && item.note.trim().length > 0) || (item.tags && item.tags.length > 0)

  return (
    <div
      className={`${ROW_BASE} relative overflow-hidden ${selected ? 'bg-accent-soft' : hovered ? 'bg-[var(--surface-hover)]' : 'bg-transparent'}`}
      style={{ minHeight: 'var(--item-height, 44px)' }}
      onMouseEnter={() => {
          setHovered(true)
          // Measure on hover — only enable marquee if text actually overflows the clip container
          if (clipRef.current && innerRef.current) {
            setIsOverflowing(innerRef.current.scrollWidth > clipRef.current.clientWidth)
          }
        }}
      onMouseLeave={() => { setHovered(false); setIsOverflowing(false); resetDeleteArm() }}
      onClick={() => {
        if (bulkMode) { onSelect(item.id, !selected); return }
        onLaunch(item.id)
      }}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, item) }}
    >
      {/* Left accent bar — slides in on hover */}
      <span
        aria-hidden
        className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent)] transition-all duration-fast"
        style={{ opacity: hovered && !bulkMode ? 0.7 : 0 }}
      />

      {bulkMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelect(item.id, e.target.checked)}
          onClick={e => e.stopPropagation()}
          className="shrink-0 accent-accent ml-2"
        />
      )}

      {/* Icon + grip wrapper — w-8 = 8px left padding zone + 24px icon.
          Grip slides in from the left padding zone on hover; icon is always fully visible.
          No layout shift, no opacity change on the icon. */}
      <span className="relative flex items-center justify-end w-8 h-7 shrink-0">
        {/* Grip — slides in from left, lives in the px-2 padding zone */}
        {!bulkMode && dragHandleProps && (
          <span
            {...dragHandleProps.attributes}
            {...(dragHandleProps.listeners ?? {})}
            onClick={e => e.stopPropagation()}
            className={`${GRIP_BASE} ${hovered ? 'opacity-90 translate-x-0' : 'opacity-0 -translate-x-1'}`}
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={12} />
          </span>
        )}

        {/* Icon — always fully visible, never affected by drag state */}
        <span className="flex items-center justify-center w-7 h-7">
          {resolvedIcon.kind === 'img' && (
            <img
              src={resolvedIcon.value}
              className={`${IMG_BASE} ${(item.iconSource === 'favicon' || item.iconSource === 'auto') ? 'bg-white' : ''}`}
              alt=""
            />
          )}
          {resolvedIcon.kind === 'emoji' && (
            <span className="text-[25px] leading-none">{resolvedIcon.value}</span>
          )}
          {resolvedIcon.kind === 'library' && (
            <LibraryIcon name={resolvedIcon.value} type={item.type} color={item.iconColor || undefined} />
          )}
          {resolvedIcon.kind === 'generic' && <ItemTypeIcon type={item.type} size={25} />}
        </span>
      </span>

      <div className="flex flex-col flex-1 min-w-0">
        <span
          ref={clipRef}
          className={`${MARQUEE_BASE} ${selected || hovered ? 'opacity-100' : 'opacity-90'} ${hovered && isOverflowing ? 'marquee-active' : ''}`}
        >
          {/* Inner span is what animates — outer span clips it */}
          <span ref={innerRef} className="marquee-inner">{item.label}</span>
        </span>
        {item.path && (
          <span className="text-xs text-text-muted truncate font-mono leading-tight">
            {item.path.length > 45 ? '…' + item.path.slice(-44) : item.path}
          </span>
        )}
      </div>

      {/* Right-side zone — note toggle + 2×3 action grid */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Note toggle — always visible when item has note/tags */}
        {hasNoteOrTags && (
          <button
            aria-label={noteOpen ? 'Collapse note' : 'Expand note'}
            title={noteOpen ? 'Collapse' : 'Expand note / tags'}
            onClick={e => { e.stopPropagation(); onToggleNote(e) }}
            className="w-5 h-5 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-4 transition-base duration-base"
          >
            {noteOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}

        {/* 2×3 action grid — slides in on hover, gap-px + bg-surface-4 creates tile dividers */}
        {!bulkMode && (
          <div
            className="grid grid-cols-3 gap-px bg-surface-2 rounded-md overflow-hidden transition-all duration-fast"
            style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(6px)', pointerEvents: hovered ? 'auto' : 'none' }}
          >
            {/* Row 1: Edit · Pin · Copy */}
            <button
              aria-label="Edit item" title="Edit"
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="w-5 h-5 flex items-center justify-center bg-[var(--surface-hover)] text-text-muted hover:bg-surface-4 hover:text-text-primary transition-base duration-base"
            >
              <Pencil size={11} />
            </button>
            <button
              aria-label={isPinned ? 'Unpin from Home' : 'Pin to Home'}
              title={isPinned ? 'Unpin from Home' : 'Pin to Home'}
              onClick={e => { e.stopPropagation(); isPinned ? unpinItem(item.id).catch(console.error) : pinItem(item.id).catch(console.error) }}
              className={`w-5 h-5 flex items-center justify-center bg-[var(--surface-hover)] hover:bg-surface-4 transition-base duration-base ${isPinned ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
            >
              {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
            <button
              aria-label={item.type === 'url' ? 'Copy URL' : 'Copy path'}
              title={copied ? 'Copied!' : item.type === 'url' ? 'Copy URL' : 'Copy path'}
              onClick={handleCopy}
              className={`w-5 h-5 flex items-center justify-center bg-[var(--surface-hover)] hover:bg-surface-4 transition-base duration-base ${copied ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>

            {/* Row 2: Select · Webview · Delete */}
            <button
              aria-label="Select item" title="Select"
              onClick={e => { e.stopPropagation(); onActivateBulkSelect() }}
              className="w-5 h-5 flex items-center justify-center bg-[var(--surface-hover)] text-text-muted hover:bg-surface-4 hover:text-text-primary transition-base duration-base"
            >
              <MousePointer size={11} />
            </button>
            <button
              aria-label="Open in Webview" title={isWebviewable ? 'Open in Webview' : 'Only available for URL items'}
              onClick={handleWebview}
              disabled={!isWebviewable}
              className={`w-5 h-5 flex items-center justify-center bg-[var(--surface-hover)] transition-base duration-base ${isWebviewable ? 'text-text-muted hover:bg-surface-4 hover:text-text-primary' : 'text-text-muted opacity-30 cursor-not-allowed'}`}
            >
              <Globe size={11} />
            </button>
            <button
              aria-label={deleteArmed ? 'Click again to confirm delete' : 'Delete'}
              title={deleteArmed ? 'Click again to confirm' : 'Delete'}
              onClick={handleDeleteClick}
              className={`w-5 h-5 flex items-center justify-center transition-base duration-base ${deleteArmed ? 'bg-danger/20 text-danger' : 'bg-[var(--surface-hover)] text-text-muted hover:bg-surface-4 hover:text-danger'}`}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

// Renders a library icon by name, falls back to type icon while loading or if not found.
// color: hex string from item.iconColor — applied as inline style when set.
const LibraryIcon = memo(function LibraryIcon({ name, type, color }: { name: string; type: Item['type']; color?: string }) {
  const Icon = useLucideIcon(name)
  if (!Icon) return <ItemTypeIcon type={type} size={25} />  // fallback while async load resolves
  const style = color ? { color } : undefined
  const cls   = color ? undefined : 'text-text-secondary'
  return <Icon size={25} className={cls} style={style} strokeWidth={1.75} />
})
