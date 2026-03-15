import { useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { Card as CardType, Item } from '../../types'
import { ipc } from '../../utils/ipc'
import Card from './Card'
import AddCardButton from './AddCardButton'

interface CardGridProps {
  cards:        CardType[]
  groupId:      string
  accentColor:  string
  onRenameCard: (id: string, name: string) => Promise<void>
  onDeleteCard: (id: string) => Promise<void>
  onAddCard:    (groupId: string, name: string) => Promise<void>
}

export default function CardGrid({
  cards, groupId, accentColor, onRenameCard, onDeleteCard, onAddCard,
}: CardGridProps) {
  // cardReorder refs — CardGrid needs to call reorderItems on the correct Card instance.
  // Each Card registers its reorderItems fn here via a callback ref pattern.
  const reorderRefs   = useRef<Map<string, (activeId: string, overId: string) => void>>(new Map())
  // Item lookup map — each Card registers its items array so DragOverlay can find the active item
  const itemLookupRef = useRef<Map<string, Item>>(new Map())
  const [activeItem, setActiveItem] = useState<Item | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const item = itemLookupRef.current.get(String(event.active.id))
    setActiveItem(item ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeCardId = active.data.current?.cardId as string | undefined
    const overCardId   = over.data.current?.cardId ?? over.id  // over can be a card droppable

    if (!activeCardId) return

    if (activeCardId === overCardId) {
      // Same card — reorder
      const reorder = reorderRefs.current.get(activeCardId)
      if (reorder) reorder(String(active.id), String(over.id))
    } else {
      // Cross-card move — use existing items:move IPC
      const targetCardId = String(overCardId)
      ipc.items.move(String(active.id), targetCardId).then(() => {
        // Dispatch the same event ItemContextMenu uses so both cards update their local state
        window.dispatchEvent(new CustomEvent('command-center:itemMoved', {
          detail: { itemId: String(active.id), targetCardId },
        }))
      }).catch(console.error)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        {cards.length > 0 && (
          <div
            className="grid gap-4 items-start"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {cards.map(card => (
              <Card
                key={card.id}
                card={card}
                allCards={cards}
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
            No cards yet — add one below
          </div>
        )}

        <div className="flex justify-end">
          <AddCardButton groupId={groupId} onAdd={onAddCard} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="flex items-center gap-2 px-2 rounded-btn bg-surface-3 shadow-lg border border-surface-4 opacity-90"
            style={{ minHeight: 'var(--item-height, 36px)', pointerEvents: 'none' }}>
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
