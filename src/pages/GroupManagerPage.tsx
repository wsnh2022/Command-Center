/**
 * GroupManagerPage.tsx — Phase 12 (complete)
 *
 * Bulk operations:
 *   • Checkbox multi-select on groups → bulk delete, bulk recolor
 *   • Checkbox multi-select on cards (within expanded group) → bulk delete
 *   • Item-level multi-select (expand a card into item view) → bulk move to another card
 *   • Drag-to-reorder groups (disabled in bulk-select mode)
 *   • Floating BulkActionBar appears whenever anything is selected
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutGrid, Pencil, Trash2, ChevronDown, ChevronRight,
  Layers, GripVertical, CheckSquare, Square, Minus,
  Palette, MoveRight, X, Globe, Zap, Folder, Terminal, Cpu,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddGroupModal from '../components/groups/AddGroupModal'
import ColorPicker from '../components/groups/ColorPicker'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { loadLucideIcon } from '../utils/lucide-registry'
import { ipc } from '../utils/ipc'
import type { LucideIcon } from 'lucide-react'
import type { Group, Card, Item, ItemType, UpdateGroupInput, UpdateCardInput } from '../types'
import type { NavigateFn } from '../types/navigation'


export interface GroupManagerPageProps {
  groups:           Group[]
  onUpdateGroup:    (input: UpdateGroupInput) => Promise<void>
  onDeleteGroup:    (id: string) => Promise<void>
  onReorderGroups:  (orderedIds: string[]) => Promise<void>
  navigate:         NavigateFn
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function isLibraryIcon(s: string) { return /^[A-Z][a-zA-Z0-9]+$/.test(s) }

function ItemTypeIcon({ type, size = 11 }: { type: ItemType; size?: number }) {
  const p = { size, strokeWidth: 1.75 as const, className: 'text-text-muted' }
  switch (type) {
    case 'url':      return <Globe     {...p} />
    case 'software': return <Cpu       {...p} />
    case 'folder':   return <Folder    {...p} />
    case 'command':  return <Terminal  {...p} />
    case 'action':   return <Zap       {...p} />
  }
}

function GroupIcon({ name, color, size = 15 }: { name: string; color: string; size?: number }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  if (!icon) return null
  const Icon = icon
  return <Icon size={size} strokeWidth={1.75} style={{ color }} />
}

function Checkbox({ checked, indeterminate = false, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className="w-4 h-4 flex items-center justify-center shrink-0
                 text-text-muted hover:text-accent transition-colors duration-fast"
    >
      {indeterminate
        ? <Minus       size={14} strokeWidth={2.5} className="text-accent" />
        : checked
          ? <CheckSquare size={14} strokeWidth={2}   className="text-accent" />
          : <Square      size={14} strokeWidth={1.75} />
      }
    </button>
  )
}


// ─── Item row (item-select mode) ──────────────────────────────────────────────

function ItemSelectRow({ item, selected, onToggle }: {
  item: Item; selected: boolean; onToggle: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 pl-3 pr-3 py-1.5 cursor-pointer
                 hover:bg-surface-2 transition-colors duration-fast"
      style={selected ? { backgroundColor: 'var(--accent-soft)' } : undefined}
      onClick={onToggle}
    >
      <Checkbox checked={selected} onChange={onToggle} />
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        <ItemTypeIcon type={item.type} size={11} />
      </div>
      <span className="flex-1 text-[0.75rem] text-text-secondary truncate">{item.label}</span>
      <span className="text-[0.72rem] text-text-secondary truncate max-w-[140px]">{item.path}</span>
    </div>
  )
}

// ─── Card row ─────────────────────────────────────────────────────────────────

function CardRow({
  card, accentColor, selected, onToggleSelect, onRename, onDelete,
  itemSelectCardId, selectedItemIds,
  onOpenItemSelect, onToggleItem, onToggleAllItems,
}: {
  card:              Card
  accentColor:       string
  selected:          boolean
  onToggleSelect:    () => void
  onRename:          (id: string, name: string) => Promise<void>
  onDelete:          (card: Card) => void
  itemSelectCardId:  string | null
  selectedItemIds:   Set<string>
  onOpenItemSelect:  (cardId: string | null) => void
  onToggleItem:      (itemId: string) => void
  onToggleAllItems:  (items: Item[]) => void
}) {
  const [editing,      setEditing]      = useState(false)
  const [editName,     setEditName]     = useState(card.name)
  const [items,        setItems]        = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const inputRef   = useRef<HTMLInputElement>(null)
  const isExpanded = itemSelectCardId === card.id

  useEffect(() => { setEditName(card.name) }, [card.name])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])


  useEffect(() => {
    if (!isExpanded) return
    setItemsLoading(true)
    ipc.items.getByCard(card.id).then(setItems).finally(() => setItemsLoading(false))
  }, [isExpanded, card.id])

  async function commitRename() {
    const trimmed = editName.trim()
    setEditing(false)
    if (trimmed && trimmed !== card.name) {
      await onRename(card.id, trimmed).catch(() => setEditName(card.name))
    } else {
      setEditName(card.name)
    }
  }

  const allSelected  = items.length > 0 && items.every(i => selectedItemIds.has(i.id))
  const someSelected = items.some(i => selectedItemIds.has(i.id)) && !allSelected

  return (
    <div>
      <div
        className="flex items-center gap-2 pl-3 pr-2 py-2 hover:bg-surface-2
                   transition-colors duration-fast group"
        style={selected ? { backgroundColor: 'var(--accent-soft)' } : undefined}
      >
        <Checkbox checked={selected} onChange={onToggleSelect} />
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          {card.icon
            ? <span className="text-sm leading-none">{card.icon}</span>
            : <Layers size={12} style={{ color: accentColor }} />
          }
        </div>
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
            className="flex-1 text-[0.75rem] font-medium text-text-primary bg-surface-3
                       rounded-input px-2 h-6 outline-none border border-accent"
          />
        ) : (
          <span
            className="flex-1 text-[0.75rem] text-text-secondary truncate cursor-text
                       hover:text-text-primary transition-colors duration-fast"
            onClick={() => setEditing(true)}
          >
            {card.name}
          </span>
        )}


        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100
                          transition-opacity duration-fast">
            <button
              onClick={() => onOpenItemSelect(isExpanded ? null : card.id)}
              title={isExpanded ? 'Close items' : 'Select items to move'}
              className="h-5 px-1.5 rounded text-[0.72rem] font-medium transition-colors duration-fast"
              style={{
                backgroundColor: isExpanded ? 'var(--accent-soft)' : 'var(--surface-3)',
                color: isExpanded ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--surface-4)',
              }}
            >
              {isExpanded ? 'Close' : 'Items'}
            </button>
            <button onClick={() => setEditing(true)} title="Rename"
              className="w-6 h-6 flex items-center justify-center rounded-btn
                         text-text-muted hover:text-text-primary hover:bg-surface-3
                         transition-colors duration-fast">
              <Pencil size={11} />
            </button>
            <button onClick={() => onDelete(card)} title="Delete"
              className="w-6 h-6 flex items-center justify-center rounded-btn
                         text-text-muted hover:text-danger hover:bg-surface-3
                         transition-colors duration-fast">
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ml-6 border-l border-surface-4 bg-surface-0">
          {items.length > 0 && (
            <div
              className="flex items-center gap-2 pl-3 pr-3 py-1.5 border-b border-surface-4
                         cursor-pointer hover:bg-surface-2 transition-colors duration-fast"
              onClick={() => onToggleAllItems(items)}
            >
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => onToggleAllItems(items)}
              />
              <span className="text-[0.72rem] text-text-secondary font-medium uppercase tracking-[0.08em]">
                {selectedItemIds.size > 0
                  ? `${selectedItemIds.size} of ${items.length} selected`
                  : `${items.length} item${items.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
          )}
          {itemsLoading && (
            <div className="px-3 py-2">
              <span className="text-[0.75rem] text-text-secondary">Loading…</span>
            </div>
          )}
          {!itemsLoading && items.length === 0 && (
            <div className="px-3 py-2">
              <span className="text-[0.75rem] text-text-secondary">No items in this card</span>
            </div>
          )}
          {!itemsLoading && items.map(item => (
            <ItemSelectRow
              key={item.id}
              item={item}
              selected={selectedItemIds.has(item.id)}
              onToggle={() => onToggleItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}


// ─── Expanded cards panel ─────────────────────────────────────────────────────

function ExpandedCards({
  group, selectedCardIds, onToggleCard, onToggleAllCards,
  onRenameCard, itemSelectCardId, selectedItemIds,
  onOpenItemSelect, onToggleItem, onToggleAllItems,
}: {
  group:             Group
  selectedCardIds:   Set<string>
  onToggleCard:      (cardId: string) => void
  onToggleAllCards:  (groupId: string, cardIds: string[]) => void
  onRenameCard:      (groupId: string, cardId: string, name: string) => Promise<void>
  itemSelectCardId:  string | null
  selectedItemIds:   Set<string>
  onOpenItemSelect:  (cardId: string | null) => void
  onToggleItem:      (itemId: string) => void
  onToggleAllItems:  (items: Item[]) => void
}) {
  const [cards,         setCards]         = useState<Card[]>([])
  const [loading,       setLoading]       = useState(true)
  const [pendingDelete, setPendingDelete] = useState<Card | null>(null)

  useEffect(() => {
    setLoading(true)
    ipc.cards.getByGroup(group.id).then(setCards).finally(() => setLoading(false))
  }, [group.id])

  const allSelected  = cards.length > 0 && cards.every(c => selectedCardIds.has(c.id))
  const someSelected = cards.some(c => selectedCardIds.has(c.id)) && !allSelected

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    await ipc.cards.delete(pendingDelete.id)
    setCards(prev => prev.filter(c => c.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  if (loading) return (
    <div className="ml-10 pl-3 py-2 border-l border-surface-4">
      <span className="text-[0.75rem] text-text-secondary">Loading…</span>
    </div>
  )

  if (cards.length === 0) return (
    <div className="ml-10 pl-3 py-2 border-l border-surface-4">
      <span className="text-[0.75rem] text-text-secondary">No cards in this group</span>
    </div>
  )


  return (
    <>
      <div className="ml-10 flex flex-col border-l border-surface-4">
        <div
          className="flex items-center gap-2 pl-3 pr-2 py-1.5 border-b border-surface-4
                     cursor-pointer hover:bg-surface-2 transition-colors duration-100"
          onClick={() => onToggleAllCards(group.id, cards.map(c => c.id))}
        >
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => onToggleAllCards(group.id, cards.map(c => c.id))}
          />
          <span className="text-[0.72rem] text-text-secondary font-medium uppercase tracking-[0.08em]">
            {selectedCardIds.size > 0
              ? `${selectedCardIds.size} card${selectedCardIds.size !== 1 ? 's' : ''} selected`
              : `${cards.length} card${cards.length !== 1 ? 's' : ''}`
            }
          </span>
        </div>
        {cards.map(card => (
          <CardRow
            key={card.id}
            card={card}
            accentColor={group.accentColor}
            selected={selectedCardIds.has(card.id)}
            onToggleSelect={() => onToggleCard(card.id)}
            onRename={(cardId, name) => onRenameCard(group.id, cardId, name)}
            onDelete={card => setPendingDelete(card)}
            itemSelectCardId={itemSelectCardId}
            selectedItemIds={selectedItemIds}
            onOpenItemSelect={onOpenItemSelect}
            onToggleItem={onToggleItem}
            onToggleAllItems={onToggleAllItems}
          />
        ))}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message="All items inside this card will be permanently deleted."
          confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}


// ─── Group row ────────────────────────────────────────────────────────────────

function GroupRow({
  group, selected, onToggleSelect, onUpdate, onEdit, onRequestDelete,
  selectedCardIds, onToggleCard, onToggleAllCards, onRenameCard,
  itemSelectCardId, selectedItemIds,
  onOpenItemSelect, onToggleItem, onToggleAllItems,
  bulkMode,
}: {
  group:             Group
  selected:          boolean
  onToggleSelect:    () => void
  onUpdate:          (input: UpdateGroupInput) => Promise<void>
  onEdit:            () => void
  onRequestDelete:   () => void
  selectedCardIds:   Set<string>
  onToggleCard:      (cardId: string) => void
  onToggleAllCards:  (groupId: string, cardIds: string[]) => void
  onRenameCard:      (groupId: string, cardId: string, name: string) => Promise<void>
  itemSelectCardId:  string | null
  selectedItemIds:   Set<string>
  onOpenItemSelect:  (cardId: string | null) => void
  onToggleItem:      (itemId: string) => void
  onToggleAllItems:  (items: Item[]) => void
  bulkMode:          boolean
}) {
  const [editing,  setEditing]  = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id, disabled: bulkMode })

  useEffect(() => { setEditName(group.name) }, [group.name])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  async function commitRename() {
    const trimmed = editName.trim()
    setEditing(false)
    if (trimmed && trimmed !== group.name) {
      await onUpdate({ id: group.id, name: trimmed }).catch(() => setEditName(group.name))
    } else {
      setEditName(group.name)
    }
  }

  const rowStyle: React.CSSProperties = {
    transform:       CSS.Transform.toString(transform),
    transition,
    opacity:         isDragging ? 0.5 : 1,
    borderColor:     selected ? 'var(--accent)' : 'var(--surface-4)',
    backgroundColor: selected ? 'var(--accent-soft)' : undefined,
  }


  return (
    <div
      ref={setNodeRef}
      style={rowStyle}
      className="flex flex-col border rounded-card overflow-hidden transition-colors duration-fast"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1">
        {!bulkMode && (
          <span {...attributes} {...listeners} title="Drag to reorder"
            className="text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing
                       opacity-40 hover:opacity-100 transition-opacity duration-fast shrink-0 select-none">
            <GripVertical size={14} />
          </span>
        )}
        <Checkbox checked={selected} onChange={onToggleSelect} />
        <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Show cards'}
          className="w-5 h-5 flex items-center justify-center shrink-0
                     text-text-muted hover:text-text-primary transition-colors duration-fast">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: group.accentColor }} />
        <div className="w-7 h-7 flex items-center justify-center shrink-0">
          {group.icon && isLibraryIcon(group.icon)
            ? <GroupIcon name={group.icon} color={group.accentColor} />
            : group.icon
              ? <span className="text-base leading-none">{group.icon}</span>
              : <LayoutGrid size={14} className="text-text-muted" />
          }
        </div>
        {editing ? (
          <input ref={inputRef} value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitRename()
              if (e.key === 'Escape') { setEditName(group.name); setEditing(false) }
            }}
            maxLength={64}
            className="flex-1 text-sm font-medium text-text-primary bg-surface-3
                       rounded-input px-2 h-7 outline-none border border-accent"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-text-primary truncate
                           cursor-text hover:text-accent transition-colors duration-fast"
            onClick={() => setEditing(true)}>
            {group.name}
          </span>
        )}
        {!editing && !selected && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} title="Edit appearance"
              className="w-7 h-7 flex items-center justify-center rounded-btn
                         text-text-muted hover:text-text-primary hover:bg-surface-3
                         transition-colors duration-fast">
              <Pencil size={13} />
            </button>
            <button onClick={onRequestDelete} title="Delete group"
              className="w-7 h-7 flex items-center justify-center rounded-btn
                         text-text-muted hover:text-danger hover:bg-surface-3
                         transition-colors duration-fast">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-surface-4 bg-surface-0 py-1">
          <ExpandedCards
            group={group}
            selectedCardIds={selectedCardIds}
            onToggleCard={onToggleCard}
            onToggleAllCards={onToggleAllCards}
            onRenameCard={onRenameCard}
            itemSelectCardId={itemSelectCardId}
            selectedItemIds={selectedItemIds}
            onOpenItemSelect={onOpenItemSelect}
            onToggleItem={onToggleItem}
            onToggleAllItems={onToggleAllItems}
          />
        </div>
      )}
    </div>
  )
}


// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({
  groupCount, cardCount, itemCount, allGroups,
  onDeleteGroups, onRecolorGroups, onDeleteCards, onMoveCards, onMoveItems, onClearAll,
}: {
  groupCount:      number
  cardCount:       number
  itemCount:       number
  allGroups:       Group[]
  onDeleteGroups:  () => void
  onRecolorGroups: (color: string) => void
  onDeleteCards:   () => void
  onMoveCards:     (targetGroupId: string) => void
  onMoveItems:     (targetCardId: string) => void
  onClearAll:      () => void
}) {
  const [showRecolor,   setShowRecolor]   = useState(false)
  const [showMoveItems, setShowMoveItems] = useState(false)
  const [showMoveCards, setShowMoveCards] = useState(false)
  const [allCards,      setAllCards]      = useState<(Card & { groupName: string })[]>([])
  const [cardsLoaded,   setCardsLoaded]   = useState(false)

  useEffect(() => {
    if (!showMoveItems) return
    setCardsLoaded(false)
    Promise.all(
      allGroups.map(g =>
        ipc.cards.getByGroup(g.id).then(cards => cards.map(c => ({ ...c, groupName: g.name })))
      )
    ).then(nested => { setAllCards(nested.flat()); setCardsLoaded(true) })
  }, [showMoveItems, allGroups])

  const total = groupCount + cardCount + itemCount
  if (total === 0) return null

  const parts: string[] = []
  if (groupCount > 0) parts.push(`${groupCount} group${groupCount !== 1 ? 's' : ''}`)
  if (cardCount  > 0) parts.push(`${cardCount} card${cardCount !== 1 ? 's' : ''}`)
  if (itemCount  > 0) parts.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`)

  const mixedSelection = (groupCount > 0 && (cardCount > 0 || itemCount > 0)) ||
                         (cardCount > 0 && itemCount > 0)


  return (
    <div className="fixed bottom-6 left-[224px] right-0 z-[100] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--surface-3)', border: '1px solid var(--surface-4)', minWidth: 320 }}
      >
        <span className="text-[0.75rem] font-medium text-text-primary whitespace-nowrap">
          {parts.join(', ')} selected
        </span>
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: 'var(--surface-4)' }} />

        {mixedSelection && (
          <span className="text-[0.72rem] text-text-secondary italic">
            Select one type at a time to act
          </span>
        )}

        {/* Group actions */}
        {groupCount > 0 && !mixedSelection && (
          <>
            <div className="relative">
              <button
                onClick={() => { setShowRecolor(v => !v); setShowMoveItems(false) }}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded text-[0.75rem] font-medium
                           transition-colors duration-fast"
                style={{ backgroundColor: 'var(--surface-4)', color: 'var(--text-secondary)' }}
              >
                <Palette size={12} /> Recolor
              </button>
              {showRecolor && (
                <div
                  className="absolute bottom-10 left-0 p-3 rounded-lg shadow-2xl z-10 w-56"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}
                >
                  <p className="text-[0.72rem] text-text-secondary font-medium uppercase tracking-[0.08em] mb-2">
                    Apply to {groupCount} group{groupCount !== 1 ? 's' : ''}
                  </p>
                  <ColorPicker
                    value=""
                    onChange={color => { onRecolorGroups(color); setShowRecolor(false) }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowRecolor(false); onDeleteGroups() }}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded text-[0.75rem] font-medium
                         transition-colors duration-fast"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}


        {/* Card actions */}
        {cardCount > 0 && !mixedSelection && (
          <>
            <div className="relative">
              <button
                onClick={() => { setShowMoveCards(v => !v); setShowRecolor(false); setShowMoveItems(false) }}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded text-[0.75rem] font-medium
                           transition-colors duration-fast"
                style={{ backgroundColor: 'var(--surface-4)', color: 'var(--text-secondary)' }}
              >
                <MoveRight size={12} /> Move to group
              </button>
              {showMoveCards && (
                <div
                  className="absolute bottom-10 left-0 rounded-lg shadow-2xl z-10 overflow-hidden"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)', minWidth: 200, maxHeight: 240, overflowY: 'auto' }}
                >
                  <p className="text-[0.72rem] text-text-secondary font-medium uppercase tracking-[0.08em] px-3 pt-2.5 pb-1">
                    Move {cardCount} card{cardCount !== 1 ? 's' : ''} to
                  </p>
                  {allGroups.length === 0 && (
                    <p className="px-3 py-2 text-[0.75rem] text-text-secondary">No groups found</p>
                  )}
                  {allGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { onMoveCards(g.id); setShowMoveCards(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[0.75rem] text-left
                                 hover:bg-surface-3 transition-colors duration-fast"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.accentColor }} />
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowMoveCards(false); onDeleteCards() }}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded text-[0.75rem] font-medium
                         transition-colors duration-fast"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}


        {/* Item actions */}
        {itemCount > 0 && !mixedSelection && (
          <div className="relative">
            <button
              onClick={() => { setShowMoveItems(v => !v); setShowRecolor(false) }}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded text-[0.75rem] font-medium
                         transition-colors duration-fast"
              style={{ backgroundColor: 'var(--surface-4)', color: 'var(--text-secondary)' }}
            >
              <MoveRight size={12} /> Move to card
            </button>
            {showMoveItems && (
              <div
                className="absolute bottom-10 left-0 rounded-lg shadow-2xl z-10 overflow-hidden"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)', minWidth: 200, maxHeight: 240, overflowY: 'auto' }}
              >
                <p className="text-[0.72rem] text-text-secondary font-medium uppercase tracking-[0.08em] px-3 pt-2.5 pb-1">
                  Move {itemCount} item{itemCount !== 1 ? 's' : ''} to
                </p>
                {!cardsLoaded && (
                  <p className="px-3 py-2 text-[0.75rem] text-text-secondary">Loading…</p>
                )}
                {cardsLoaded && allCards.length === 0 && (
                  <p className="px-3 py-2 text-[0.75rem] text-text-secondary">No cards found</p>
                )}
                {allCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => { onMoveItems(card.id); setShowMoveItems(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[0.75rem] text-left
                               hover:bg-surface-3 transition-colors duration-fast"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Layers size={11} className="shrink-0 text-text-muted" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{card.name}</span>
                      <span className="text-[0.72rem] text-text-secondary truncate">{card.groupName}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClearAll}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded
                     text-text-muted hover:text-text-primary transition-colors duration-fast"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function GroupManagerPage({
  groups, onUpdateGroup, onDeleteGroup, onReorderGroups,
}: GroupManagerPageProps) {
  const [editingGroup,   setEditingGroup]   = useState<Group | null>(null)
  const [pendingDelete,  setPendingDelete]  = useState<Group | null>(null)
  const [confirmBulkDel, setConfirmBulkDel] = useState<'groups' | 'cards' | null>(null)

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [selectedCardMap,  setSelectedCardMap]  = useState<Map<string, Set<string>>>(new Map())
  const [itemSelectCardId, setItemSelectCardId] = useState<string | null>(null)
  const [selectedItemIds,  setSelectedItemIds]  = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const totalSelectedCards = Array.from(selectedCardMap.values()).reduce((s, set) => s + set.size, 0)
  const bulkMode = selectedGroupIds.size > 0 || totalSelectedCards > 0 || selectedItemIds.size > 0

  function toggleGroup(id: string) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  function toggleCard(groupId: string, cardId: string) {
    setSelectedCardMap(prev => {
      const next = new Map(prev)
      const set  = new Set(next.get(groupId) ?? [])
      set.has(cardId) ? set.delete(cardId) : set.add(cardId)
      next.set(groupId, set); return next
    })
  }

  function toggleAllCards(groupId: string, cardIds: string[]) {
    setSelectedCardMap(prev => {
      const next     = new Map(prev)
      const existing = next.get(groupId) ?? new Set()
      next.set(groupId, cardIds.every(id => existing.has(id)) ? new Set() : new Set(cardIds))
      return next
    })
  }

  function openItemSelect(cardId: string | null) {
    setItemSelectCardId(cardId)
    setSelectedItemIds(new Set())
  }

  function toggleItem(itemId: string) {
    setSelectedItemIds(prev => {
      const next = new Set(prev); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next
    })
  }

  function toggleAllItems(items: Item[]) {
    setSelectedItemIds(prev =>
      items.every(i => prev.has(i.id)) ? new Set() : new Set(items.map(i => i.id))
    )
  }

  function clearAll() {
    setSelectedGroupIds(new Set())
    setSelectedCardMap(new Map())
    setItemSelectCardId(null)
    setSelectedItemIds(new Set())
  }


  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex(g => g.id === active.id)
    const newIndex = groups.findIndex(g => g.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderGroups(arrayMove(groups, oldIndex, newIndex).map(g => g.id))
  }

  async function handleConfirmGroupDelete() {
    if (!pendingDelete) return
    await onDeleteGroup(pendingDelete.id)
    setPendingDelete(null)
  }

  async function handleBulkDeleteGroups() {
    for (const id of selectedGroupIds) await onDeleteGroup(id)
    setSelectedGroupIds(new Set())
    setConfirmBulkDel(null)
  }

  async function handleBulkRecolor(color: string) {
    for (const id of selectedGroupIds) await onUpdateGroup({ id, accentColor: color })
    setSelectedGroupIds(new Set())
  }

  async function handleBulkDeleteCards() {
    for (const [, cardSet] of selectedCardMap) {
      for (const cardId of cardSet) await ipc.cards.delete(cardId)
    }
    setSelectedCardMap(new Map())
    setConfirmBulkDel(null)
  }


  async function handleBulkMoveCards(targetGroupId: string) {
    for (const [, cardSet] of selectedCardMap) {
      for (const cardId of cardSet) await ipc.cards.move(cardId, targetGroupId)
    }
    setSelectedCardMap(new Map())
  }

  async function handleBulkMoveItems(targetCardId: string) {
    for (const itemId of selectedItemIds) await ipc.items.move(itemId, targetCardId)
    setSelectedItemIds(new Set())
    setItemSelectCardId(null)
  }

  const handleRenameCard = useCallback(async (_groupId: string, cardId: string, name: string) => {
    await ipc.cards.update({ id: cardId, name } as UpdateCardInput)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">Group Manager</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">
          Select groups or cards with checkboxes, then act via the bar below.
          Open a card's Items panel to select and move items between cards.
        </p>
      </div>


      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {groups.length === 0 ? (
          <div className="py-10 text-sm text-text-muted text-center">
            No groups yet — create one from the sidebar
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2 max-w-xl">
                {groups.map(group => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    selected={selectedGroupIds.has(group.id)}
                    onToggleSelect={() => toggleGroup(group.id)}
                    onUpdate={onUpdateGroup}
                    onEdit={() => setEditingGroup(group)}
                    onRequestDelete={() => setPendingDelete(group)}
                    selectedCardIds={selectedCardMap.get(group.id) ?? new Set()}
                    onToggleCard={cardId => toggleCard(group.id, cardId)}
                    onToggleAllCards={toggleAllCards}
                    onRenameCard={handleRenameCard}
                    itemSelectCardId={itemSelectCardId}
                    selectedItemIds={selectedItemIds}
                    onOpenItemSelect={openItemSelect}
                    onToggleItem={toggleItem}
                    onToggleAllItems={toggleAllItems}
                    bulkMode={bulkMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>


      {editingGroup && (
        <AddGroupModal
          editing={editingGroup}
          onClose={() => setEditingGroup(null)}
          onUpdate={async input => { await onUpdateGroup(input); setEditingGroup(null) }}
        />
      )}

      {pendingDelete && !confirmBulkDel && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message="All cards and items inside this group will be permanently deleted."
          confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
          onConfirm={handleConfirmGroupDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {confirmBulkDel === 'groups' && (
        <ConfirmDialog
          title={`Delete ${selectedGroupIds.size} group${selectedGroupIds.size !== 1 ? 's' : ''}?`}
          message="All cards and items inside these groups will be permanently deleted."
          confirmLabel={`Delete ${selectedGroupIds.size} group${selectedGroupIds.size !== 1 ? 's' : ''}`}
          cancelLabel="Cancel" variant="danger"
          onConfirm={handleBulkDeleteGroups}
          onCancel={() => setConfirmBulkDel(null)}
        />
      )}

      {confirmBulkDel === 'cards' && (
        <ConfirmDialog
          title={`Delete ${totalSelectedCards} card${totalSelectedCards !== 1 ? 's' : ''}?`}
          message="All items inside these cards will be permanently deleted."
          confirmLabel={`Delete ${totalSelectedCards} card${totalSelectedCards !== 1 ? 's' : ''}`}
          cancelLabel="Cancel" variant="danger"
          onConfirm={handleBulkDeleteCards}
          onCancel={() => setConfirmBulkDel(null)}
        />
      )}

      <BulkActionBar
        groupCount={selectedGroupIds.size}
        cardCount={totalSelectedCards}
        itemCount={selectedItemIds.size}
        allGroups={groups}
        onDeleteGroups={() => setConfirmBulkDel('groups')}
        onRecolorGroups={handleBulkRecolor}
        onDeleteCards={() => setConfirmBulkDel('cards')}
        onMoveCards={handleBulkMoveCards}
        onMoveItems={handleBulkMoveItems}
        onClearAll={clearAll}
      />
    </div>
  )
}
