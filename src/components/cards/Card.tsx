import { useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Card as CardType, Item } from '../../types'
import type { CreateItemInput, UpdateItemInput } from '../../types'
import CardHeader from './CardHeader'
import ItemList from '../items/ItemList'
import { useItems } from '../../hooks/useItems'

interface CardProps {
  card:            CardType
  allCards:        CardType[]   // all cards in group for "Move to Card" submenu
  accentColor:     string
  onRename:        (id: string, name: string) => Promise<void>
  onDelete:        (id: string) => Promise<void>
  onRegisterReorder?: (fn: (activeId: string, overId: string) => void) => void
  onRegisterItems?:   (items: Item[]) => void
}

export default function Card({ card, allCards, accentColor, onRename, onDelete, onRegisterReorder, onRegisterItems }: CardProps) {
  const { items, createItem, updateItem, deleteItem, launchItem, reorderItems } = useItems(card.id)

  const { setNodeRef, isOver } = useDroppable({ id: card.id, data: { cardId: card.id } })

  // Register this card's reorderItems fn with CardGrid so DndContext can call it on drop
  useEffect(() => {
    onRegisterReorder?.(reorderItems)
  }, [reorderItems, onRegisterReorder])

  // Keep CardGrid's item lookup map current whenever items change
  useEffect(() => {
    onRegisterItems?.(items)
  }, [items, onRegisterItems])

  async function handleCreate(input: CreateItemInput) {
    await createItem(input)
  }

  async function handleUpdate(input: UpdateItemInput) {
    await updateItem(input)
  }

  async function handleDelete(id: string) {
    await deleteItem(id)
  }

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col bg-surface-2 rounded-card shadow-card overflow-hidden transition-colors duration-fast"
      style={{
        '--accent': accentColor,
        outline: isOver ? '2px solid var(--accent)' : '2px solid transparent',
      } as React.CSSProperties}
    >
      <CardHeader
        card={card}
        accentColor={accentColor}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* Items */}
      <div className="flex-1 px-2 py-2">
        <ItemList
          items={items}
          cardId={card.id}
          cards={allCards}
          accentColor={accentColor}
          onLaunch={launchItem}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={reorderItems}
        />
      </div>
    </div>
  )
}
