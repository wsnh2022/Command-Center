import { useState, useCallback, useEffect } from 'react'
import type { RecentItem } from '../types'
import { ipc } from '../utils/ipc'

export function useRecents(limit = 20) {
  const [recents, setRecents] = useState<RecentItem[]>([])

  const load = useCallback(() => {
    ipc.recents.get(limit).then(setRecents).catch(console.error)
  }, [limit])

  useEffect(() => { load() }, [load])

  async function launch(itemId: string) {
    await ipc.items.launch(itemId).catch(console.error)
    load()  // refresh recents list after launch so this item moves to top
  }

  return { recents, launch, refresh: load }
}
