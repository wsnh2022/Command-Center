import { useState, useEffect } from 'react'
import { Info, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { loadLucideIcon } from '../../utils/lucide-registry'
import { ItemTypeIcon } from './ItemIcons'
import { useResolvedIcon } from '../../hooks/useResolvedIcon'
import type { LucideIcon } from 'lucide-react'
import type { Item } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DragListeners = Record<string, (...args: any[]) => void>

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

export default function ItemRow({
  item, onLaunch, onContextMenu, bulkMode, selected, onSelect, noteOpen, onToggleNote,
  dragHandleProps,
}: ItemRowProps) {
  const [hovered, setHovered] = useState(false)
  const resolvedIcon = useResolvedIcon(
    item.iconPath, item.iconSource, item.type,
    item.type === 'url' ? item.path : undefined,
  )

  const hasNoteOrTags = (item.note && item.note.trim().length > 0) || (item.tags && item.tags.length > 0)

  return (
    <div
      className={[
        'flex items-center gap-2 pl-0 pr-2 rounded-btn cursor-pointer select-none transition-base duration-base',
        selected ? 'bg-accent-soft' : hovered ? 'bg-surface-3' : 'bg-transparent',
      ].join(' ')}
      style={{ minHeight: 'var(--item-height, 36px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (bulkMode) { onSelect(item.id, !selected); return }
        onLaunch(item.id)
      }}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, item) }}
    >
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
      <span className="relative flex items-center justify-end w-8 h-6 shrink-0">
        {/* Grip — slides in from left, lives in the px-2 padding zone */}
        {!bulkMode && dragHandleProps && (
          <span
            {...dragHandleProps.attributes}
            {...(dragHandleProps.listeners ?? {})}
            onClick={e => e.stopPropagation()}
            className={[
              'absolute -left-2 flex items-center justify-center w-4 h-6',
              'text-accent transition-all duration-fast',
              'cursor-grab active:cursor-grabbing',
              hovered ? 'opacity-90 translate-x-0' : 'opacity-0 -translate-x-1',
            ].join(' ')}
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={12} />
          </span>
        )}

        {/* Icon — always fully visible, never affected by drag state */}
        <span className="flex items-center justify-center w-6 h-6">
          {resolvedIcon.kind === 'img' && (
            <img src={resolvedIcon.value} className="w-6 h-6 object-contain rounded-sm" alt="" />
          )}
          {resolvedIcon.kind === 'emoji' && (
            <span className="text-[21px] leading-none">{resolvedIcon.value}</span>
          )}
          {resolvedIcon.kind === 'library' && (
            <LibraryIcon name={resolvedIcon.value} type={item.type} color={item.iconColor || undefined} />
          )}
          {resolvedIcon.kind === 'generic' && <ItemTypeIcon type={item.type} size={21} />}
        </span>
      </span>

      <div className="flex flex-col flex-1 min-w-0">
        <span className={[
          'text-xs font-medium truncate transition-base duration-base',
          selected || hovered ? 'text-text-primary' : 'text-text-secondary',
        ].join(' ')}>
          {item.label}
        </span>
        {item.path && (
          <span className="text-xs text-text-muted truncate font-mono leading-tight">
            {item.path.length > 45 ? '…' + item.path.slice(-44) : item.path}
          </span>
        )}
      </div>

      {/* Right-side buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
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
        {hovered && !bulkMode && (
          <button
            aria-label="Item details"
            title="Info"
            onClick={e => { e.stopPropagation(); onContextMenu(e as unknown as React.MouseEvent, item) }}
            className="w-5 h-5 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-4 transition-base duration-base"
          >
            <Info size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// Renders a library icon by name, falls back to type icon while loading or if not found.
// color: hex string from item.iconColor — applied as inline style when set.
function LibraryIcon({ name, type, color }: { name: string; type: Item['type']; color?: string }) {
  const Icon = useLucideIcon(name)
  if (!Icon) return <ItemTypeIcon type={type} size={21} />  // fallback while async load resolves
  const style = color ? { color } : undefined
  const cls   = color ? undefined : 'text-text-secondary'
  return <Icon size={21} className={cls} style={style} strokeWidth={1.75} />
}
