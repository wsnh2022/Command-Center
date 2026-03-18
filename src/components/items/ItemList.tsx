import { useState, useCallback, useMemo } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ItemRow from './ItemRow'
import ItemNoteContent from './ItemNoteDropdown'
import ItemContextMenu from './ItemContextMenu'
import ItemFormPanel from './ItemFormPanel'
import AddItemButton from './AddItemButton'
import type { Item, Card, CreateItemInput, UpdateItemInput } from '../../types'

interface ItemListProps {
  items:       Item[]
  cardId:      string
  cards:       Card[]
  accentColor: string
  onLaunch:    (id: string) => Promise<void>
  onCreate:    (input: CreateItemInput) => Promise<void>
  onUpdate:    (input: UpdateItemInput) => Promise<void>
  onDelete:    (id: string) => Promise<void>
  onReorder?:  (activeId: string, overId: string) => void
}

interface CtxMenu { item: Item; x: number; y: number }

// Wrapper that gives each item row its sortable context
function SortableItem({
  item, cardId, bulkMode, selected, onSelect, onLaunch, onContextMenu,
  noteOpen, toggleNote,
}: {
  item: Item
  cardId: string
  bulkMode: boolean
  selected: boolean
  onSelect: (id: string, sel: boolean) => void
  onLaunch: (id: string) => void
  onContextMenu: (e: React.MouseEvent, item: Item) => void
  noteOpen: boolean
  toggleNote: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { cardId },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ItemRow
        item={item}
        onLaunch={onLaunch}
        onContextMenu={onContextMenu}
        bulkMode={bulkMode}
        selected={selected}
        onSelect={onSelect}
        noteOpen={noteOpen}
        onToggleNote={() => toggleNote(item.id)}
        dragHandleProps={{ attributes, listeners }}
      />
      {noteOpen && <ItemNoteContent item={item} />}
    </div>
  )
}

export default function ItemList({
  items, cardId, cards, onLaunch, onCreate, onUpdate, onDelete, onReorder,
}: ItemListProps) {
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null)
  const [formItem,   setFormItem]   = useState<Item | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [bulkMode,   setBulkMode]   = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [openNotes,  setOpenNotes]  = useState<Set<string>>(new Set())

  const toggleNote = useCallback((id: string) => {
    setOpenNotes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const openCtx = useCallback((e: React.MouseEvent, item: Item) => {
    e.preventDefault()
    setCtxMenu({ item, x: e.clientX, y: e.clientY })
  }, [])

  const openEdit = useCallback((item: Item) => { setFormItem(item); setShowForm(true) }, [])
  const openAdd  = useCallback(() =>            { setFormItem(null);  setShowForm(true) }, [])

  const handleSelect = useCallback((id: string, sel: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      sel ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const handleBulkDelete = useCallback(async () => {
    await Promise.all([...selected].map(id => onDelete(id).catch(console.error)))
    setSelected(new Set())
    setBulkMode(false)
  }, [selected, onDelete])

  const itemIds = useMemo(() => items.map(i => i.id), [items])

  return (
    <div className="flex flex-col" style={{ '--accent': 'inherit' } as React.CSSProperties}>
      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1 bg-accent-soft rounded-btn text-xs text-text-secondary">
          <span>{selected.size} selected</span>
          <button onClick={handleBulkDelete} className="ml-auto text-danger hover:opacity-80">Delete</button>
          <button onClick={() => { setBulkMode(false); setSelected(new Set()) }} className="text-text-muted hover:text-text-primary">Cancel</button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="py-10 text-sm text-text-muted text-center">
          No items yet
        </div>
      )}

      {/* Item rows + inline note expansion */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableItem
            key={item.id}
            item={item}
            cardId={cardId}
            bulkMode={bulkMode}
            selected={selected.has(item.id)}
            onSelect={handleSelect}
            onLaunch={onLaunch}
            onContextMenu={openCtx}
            noteOpen={openNotes.has(item.id)}
            toggleNote={toggleNote}
          />
        ))}
      </SortableContext>

      <div className="pt-1">
        <AddItemButton onClick={openAdd} />
      </div>

      {ctxMenu && (
        <ItemContextMenu
          item={ctxMenu.item}
          cards={cards}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onEdit={() => openEdit(ctxMenu.item)}
          onDelete={() => onDelete(ctxMenu.item.id).catch(console.error)}
          onBulkSelect={() => {
            setBulkMode(true)                              // enter bulk mode
            setSelected(new Set([ctxMenu.item.id]))       // pre-select the right-clicked item
          }}
        />
      )}

      {showForm && (
        <ItemFormPanel
          cardId={cardId}
          editing={formItem ?? undefined}
          onClose={() => setShowForm(false)}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
