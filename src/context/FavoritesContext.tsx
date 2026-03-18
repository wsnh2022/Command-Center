import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'
import type { FavoriteItem } from '../types'
import { ipc } from '../utils/ipc'

interface FavoritesCtx {
  favorites:        FavoriteItem[]
  favItemIds:       Set<string>          // O(1) membership — item.id → is pinned?
  pinItem:          (itemId: string) => Promise<void>
  unpinItem:        (itemId: string) => Promise<void>
  reorderFavorites: (favIds: string[]) => Promise<void>
  launchFavorite:   (itemId: string)   => Promise<void>
  refresh:          () => void
}

const FavoritesContext = createContext<FavoritesCtx>({
  favorites:        [],
  favItemIds:       new Set(),
  pinItem:          async () => {},
  unpinItem:        async () => {},
  reorderFavorites: async () => {},
  launchFavorite:   async () => {},
  refresh:          () => {},
})

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])

  const load = useCallback(() => {
    ipc.favorites.getAll().then(setFavorites).catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  const favItemIds = useMemo(() => new Set(favorites.map(f => f.itemId)), [favorites])

  const pinItem = useCallback(async (itemId: string) => {
    await ipc.favorites.pin(itemId).catch(console.error)
    load()
  }, [load])

  const unpinItem = useCallback(async (itemId: string) => {
    await ipc.favorites.unpin(itemId).catch(console.error)
    load()
  }, [load])

  const reorderFavorites = useCallback(async (favIds: string[]) => {
    // Optimistic local reorder — keeps drag snappy
    setFavorites(prev => {
      const map = new Map(prev.map(f => [f.id, f]))
      return favIds.map(id => map.get(id)).filter(Boolean) as FavoriteItem[]
    })
    await ipc.favorites.reorder(favIds).catch(console.error)
  }, [])

  const launchFavorite = useCallback(async (itemId: string) => {
    await ipc.items.launch(itemId).catch(console.error)
    // recents are updated by the launch IPC handler — no extra call needed here
  }, [])

  const value = useMemo(
    () => ({ favorites, favItemIds, pinItem, unpinItem, reorderFavorites, launchFavorite, refresh: load }),
    [favorites, favItemIds, pinItem, unpinItem, reorderFavorites, launchFavorite, load]
  )

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() { return useContext(FavoritesContext) }
