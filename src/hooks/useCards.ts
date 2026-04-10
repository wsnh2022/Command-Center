import { useState, useCallback } from 'react'
import type { Card, CreateCardInput, UpdateCardInput } from '../types'
import { ipc } from '../utils/ipc'

export interface UseCardsResult {
  cards:        Card[]
  setCards:     React.Dispatch<React.SetStateAction<Card[]>>
  createCard:   (input: CreateCardInput) => Promise<Card>
  updateCard:   (input: UpdateCardInput) => Promise<void>
  deleteCard:   (id: string) => Promise<void>
  reorderCards: (orderedIds: string[]) => Promise<void>
  loadCards:    (groupId: string) => Promise<void>
}

export function useCards(): UseCardsResult {
  const [cards, setCards] = useState<Card[]>([])

  const loadCards = useCallback(async (groupId: string): Promise<void> => {
    const all = await ipc.cards.getByGroup(groupId)
    setCards(all)
  }, [])

  const createCard = useCallback(async (input: CreateCardInput): Promise<Card> => {
    const created = await ipc.cards.create(input)
    setCards(prev => [...prev, created])
    return created
  }, [])

  const updateCard = useCallback(async (input: UpdateCardInput): Promise<void> => {
    await ipc.cards.update(input)
    setCards(prev => prev.map(c => c.id === input.id ? { ...c, ...input } : c))
  }, [])

  const deleteCard = useCallback(async (id: string): Promise<void> => {
    await ipc.cards.delete(id)
    setCards(prev => prev.filter(c => c.id !== id))
  }, [])

  const reorderCards = useCallback((orderedIds: string[]): Promise<void> => {
    // Optimistic update - UI snaps immediately on drop, same as reorderItems
    setCards(prev => {
      const map = new Map(prev.map(c => [c.id, c]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
    })
    ipc.cards.reorder(orderedIds).catch(console.error)
    return Promise.resolve()
  }, [])

  return { cards, setCards, createCard, updateCard, deleteCard, reorderCards, loadCards }
}
