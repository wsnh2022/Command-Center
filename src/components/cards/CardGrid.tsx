import { useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { Card as CardType, Item } from '../../types'
import { ipc } from '../../utils/ipc'
import Card from './Card'
import AddCardButton from './AddCardButton'

interface CardGridProps {
  cards:           CardType[]
  groupId:         string
  accentColor:     string
  onRenameCard:    (id: string, name: string) => Promise<void>
  onDeleteCard:    (id: string) => Promise<void>
  onAddCard:       (groupId: string, name: string) => Promise<void>
  onReorderCards:  (orderedIds: string[]) => Promise<void>
}

export default function CardGrid({
  cards, groupId, accentColor, onRenameCard, onDeleteCard, onAddCard, onReorderCards,
}: CardGridProps) {
  // Per-card reorder fn refs - registered by each Card instance on mount
  const reorderRefs   = useRef<Map<string, (activeId: string, overId: string) => void>>(new Map())
  // Item lookup map - registered by each Card so DragOverlay can resolve the active item
  const itemLookupRef = useRef<Map<string, Item>>(new Map())

  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const [activeCard, setActiveCard] = useState<CardType | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'card') {
      // Card drag - show card overlay, suppress item overlay
      const card = cards.find(c => c.id === String(event.active.id))
      setActiveCard(card ?? null)
      setActiveItem(null)
    } else {
      // Item drag
      setActiveCard(null)
      const item = itemLookupRef.current.get(String(event.active.id))
      setActiveItem(item ?? null)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)
    setActiveCard(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    // ── Card reorder ──────────────────────────────────────────────────────────
    if (active.data.current?.type === 'card') {
      const oldIndex = cards.findIndex(c => c.id === String(active.id))
      const newIndex = cards.findIndex(c => c.id === String(over.id))
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(cards, oldIndex, newIndex)
        onReorderCards(reordered.map(c => c.id)).catch(console.error)
      }
      return
    }

    // ── Item drag (same-card reorder or cross-card move) ──────────────────────
    const activeCardId = active.data.current?.cardId as string | undefined
    const overCardId   = over.data.current?.cardId ?? over.id  // over can be a card or an item

    if (!activeCardId) return

    if (activeCardId === overCardId) {
      // Same card - delegate to that card's registered reorder fn
      const reorder = reorderRefs.current.get(activeCardId)
      if (reorder) reorder(String(active.id), String(over.id))
    } else {
      // Cross-card move
      const targetCardId = String(overCardId)
      ipc.items.move(String(active.id), targetCardId).then(() => {
        window.dispatchEvent(new CustomEvent('command-center:itemMoved', {
          detail: { itemId: String(active.id), targetCardId },
        }))
      }).catch(console.error)
    }
  }

  const cardIds = cards.map(c => c.id)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-4">
          {cards.length > 0 && (
            <div
              className="grid gap-4 items-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {cards.map(card => (
                <Card
                  key={card.id}
                  card={card}
                  accentColor={accentColor}
                  onRename={onRenameCard}
                  onDelete={onDeleteCard}
                  onRegisterReorder={(fn) => reorderRefs.current.set(card.id, fn)}
                  onRegisterItems={(items) => items.forEach(item => itemLookupRef.current.set(item.id, item))}
                />
              ))}
            </div>
          )}

          {cards.length === 0 && (
            <div className="py-10 text-sm text-text-muted text-center">
              No cards yet - add one below
            </div>
          )}

          <div className="flex justify-end">
            <AddCardButton groupId={groupId} onAdd={onAddCard} />
          </div>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          // Card drag overlay - ghost of the card header
          <div
            className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 rounded-card shadow-xl border border-accent opacity-90 pointer-events-none"
            style={{ borderLeft: `3px solid ${accentColor}`, minWidth: 240, maxWidth: 320 }}
          >
            {activeCard.icon && (
              <span className="text-base leading-none shrink-0">{activeCard.icon}</span>
            )}
            <span className="text-sm font-medium text-text-primary truncate">{activeCard.name}</span>
          </div>
        ) : activeItem ? (
          // Item drag overlay
          <div className="flex items-center gap-2 px-2 rounded-btn bg-surface-3 shadow-lg border border-surface-4 opacity-90"
            style={{ minHeight: 'var(--item-height, 44px)', pointerEvents: 'none' }}>
            <span className="w-4 shrink-0 flex items-center justify-center text-text-muted">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/>
                <circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
              </svg>
            </span>
            <span className="text-xs font-medium text-text-primary truncate flex-1">{activeItem.label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
