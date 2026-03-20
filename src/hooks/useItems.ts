import { useState, useCallback, useEffect, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { Item, CreateItemInput, UpdateItemInput } from '../types'
import { ipc } from '../utils/ipc'

export interface UseItemsResult {
  items:       Item[]
  loadItems:   (cardId: string) => Promise<void>
  createItem:  (input: CreateItemInput) => Promise<Item>
  updateItem:  (input: UpdateItemInput) => Promise<void>
  deleteItem:  (id: string) => Promise<void>
  launchItem:  (id: string) => Promise<void>
  reorderItems:(activeId: string, overId: string) => Promise<void>
}

export function useItems(cardId: string): UseItemsResult {
  const [items, setItems] = useState<Item[]>([])

  const loadItems = useCallback(async (cid: string) => {
    const all = await ipc.items.getByCard(cid)
    setItems(all)
  }, [])

  useEffect(() => {
    if (cardId) loadItems(cardId).catch(console.error)
  }, [cardId, loadItems])

  // Use a ref so the event handler always sees the latest items
  // without needing items in its dependency array — avoids re-registering
  // the listener on every state change (stale closure / accumulating listeners).
  const itemsRef = useRef<Item[]>(items)
  useEffect(() => { itemsRef.current = items }, [items])

  // Listen for item-moved events dispatched by ItemContextMenu after ipc.items.move.
  // Two cases:
  //   1. itemId was in THIS card  → remove it from local state immediately (no refetch needed)
  //   2. targetCardId is THIS card → refetch to get the newly arrived item
  useEffect(() => {
    function handleItemMoved(e: Event) {
      const { itemId, targetCardId } = (e as CustomEvent<{ itemId: string; targetCardId: string }>).detail

      const isSource = itemsRef.current.some(i => i.id === itemId)   // item lived here
      const isTarget = targetCardId === cardId                         // item is coming here

      if (isSource) {
        // Remove immediately — no round-trip needed, DB already updated
        setItems(prev => prev.filter(i => i.id !== itemId))
      }
      if (isTarget) {
        // Refetch — we need the full item data from the DB
        loadItems(cardId).catch(console.error)
      }
    }

    window.addEventListener('command-center:itemMoved', handleItemMoved)
    return () => window.removeEventListener('command-center:itemMoved', handleItemMoved)
  }, [cardId, loadItems])   // items removed from deps — itemsRef covers it


  const createItem = useCallback(async (input: CreateItemInput): Promise<Item> => {
    const created = await ipc.items.create(input)
    setItems(prev => [...prev, created])
    return created
  }, [])

  const updateItem = useCallback(async (input: UpdateItemInput): Promise<void> => {
    const updated = await ipc.items.update(input)
    if (!updated) {
      // Backend returned null (item not found after update) — refetch to keep state consistent
      await loadItems(cardId)
      return
    }
    setItems(prev => prev.map(i => i.id === input.id ? updated : i))
  }, [cardId, loadItems])

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    await ipc.items.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const launchItem = useCallback(async (id: string): Promise<void> => {
    await ipc.items.launch(id)
    // Update launch count locally without refetch
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, launchCount: i.launchCount + 1 } : i
    ))
  }, [])

  const reorderItems = useCallback((activeId: string, overId: string): Promise<void> => {
    const oldIndex = items.findIndex(i => i.id === activeId)
    const newIndex = items.findIndex(i => i.id === overId)
    if (oldIndex === -1 || newIndex === -1) return Promise.resolve()
    const reordered = arrayMove(items, oldIndex, newIndex)
    const updates = reordered.map((item, idx) => ({ id: item.id, sortOrder: idx }))
    // Optimistic update — pure state write, no side effects inside updater
    setItems(reordered.map((item, idx) => ({ ...item, sortOrder: idx })))
    ipc.items.reorder(updates).catch(console.error)
    return Promise.resolve()
  }, [items])

  return { items, loadItems, createItem, updateItem, deleteItem, launchItem, reorderItems }
}
