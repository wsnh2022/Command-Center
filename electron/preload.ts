import { contextBridge, ipcRenderer } from 'electron'
import type {
  Group, Card, Item, AppSettings, RecentItem, FavoriteItem, SearchIndexEntry,
  CreateGroupInput, UpdateGroupInput,
  CreateCardInput, UpdateCardInput,
  CreateItemInput, UpdateItemInput,
} from '../src/types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', {

  groups: {
    getAll: () => invoke<Group[]>('groups:getAll'),
    create: (input: CreateGroupInput) => invoke<Group>('groups:create', input),
    update: (input: UpdateGroupInput) => invoke<Group>('groups:update', input),
    delete: (id: string) => invoke<{ success: boolean }>('groups:delete', { id }),
    reorder: (ids: string[]) => invoke<{ success: boolean }>('groups:reorder', { ids }),
    getCardCounts: () => invoke<{ groupId: string; cardCount: number }[]>('groups:getCardCounts'),
  },

  cards: {
    getByGroup: (groupId: string) => invoke<Card[]>('cards:getByGroup', { groupId }),
    create: (input: CreateCardInput) => invoke<Card>('cards:create', input),
    update: (input: UpdateCardInput) => invoke<Card>('cards:update', input),
    delete: (id: string) => invoke<{ success: boolean }>('cards:delete', { id }),
    reorder: (ids: string[]) => invoke<{ success: boolean }>('cards:reorder', { ids }),
    move: (cardId: string, targetGroupId: string) => invoke<{ success: boolean }>('cards:move', { cardId, targetGroupId }),
  },

  items: {
    getByCard: (cardId: string) => invoke<Item[]>('items:getByCard', { cardId }),
    getAll: (): Promise<Item[]> => invoke('items:getAll'),
    create: (input: CreateItemInput) => invoke<Item>('items:create', input),
    update: (input: UpdateItemInput) => invoke<Item>('items:update', input),
    delete: (id: string) => invoke<{ success: boolean }>('items:delete', { id }),
    move: (itemId: string, targetCardId: string) =>
      invoke<{ success: boolean }>('items:move', { itemId, targetCardId }),
    reorder: (updates: { id: string; sortOrder: number }[]) =>
      invoke<{ success: boolean }>('items:reorder', { updates }),
    launch: (id: string) => invoke<{ success: boolean }>('items:launch', { id }),
    getCountsByCard: () => invoke<{ cardId: string; itemCount: number }[]>('items:getCountsByCard'),
  },

  search: {
    getIndex: () => invoke<SearchIndexEntry[]>('search:getIndex'),
    fullText: (query: string) => invoke<string[]>('search:fullText', { query }),
  },

  recents: {
    get: (limit?: number) => invoke<RecentItem[]>('recents:get', { limit }),
    record: (itemId: string) => invoke<void>('recents:record', { itemId }),
  },

  favorites: {
    getAll: () => invoke<FavoriteItem[]>('favorites:getAll'),
    pin: (itemId: string) => invoke<{ success: boolean }>('favorites:pin', { itemId }),
    unpin: (itemId: string) => invoke<{ success: boolean }>('favorites:unpin', { itemId }),
    reorder: (ids: string[]) => invoke<{ success: boolean }>('favorites:reorder', { ids }),
  },

  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    update: (input: Partial<AppSettings>) => invoke<AppSettings>('settings:update', input),
  },

  webview: {
    open: (url: string) => invoke<void>('webview:open', { url }),
    navigate: (url: string) => invoke<void>('webview:navigate', { url }),
    back: () => invoke<void>('webview:back'),
    forward: () => invoke<void>('webview:forward'),
    reload: () => invoke<void>('webview:reload'),
    close: () => invoke<void>('webview:close'),
    eject: () => invoke<void>('webview:eject'),
    resize: (size: number) => invoke<void>('webview:resize', { width: size, height: size }),
  },

  icons: {
    resolve: (iconPath: string, iconSource: string, itemType: string, itemUrl?: string) =>
      invoke<{ resolvedPath: string; source: string }>('icons:resolve', { iconPath, iconSource, itemType, itemUrl: itemUrl ?? '' }),
    saveUpload: (sourcePath: string) =>
      invoke<{ localPath: string }>('icons:saveUpload', { sourcePath }),
    saveUrl: (imageUrl: string) =>
      invoke<{ localPath: string }>('icons:saveUrl', { imageUrl }),
    saveBase64: (base64: string) =>
      invoke<{ localPath: string }>('icons:saveBase64', { base64 }),
    previewUrl: (imageUrl: string) =>
      invoke<{ dataUri: string }>('icons:previewUrl', { imageUrl }),
    previewLocal: (sourcePath: string) =>
      invoke<{ dataUri: string }>('icons:previewLocal', { sourcePath }),
    fetchFavicon: (itemUrl: string) =>
      invoke<{ localPath: string }>('icons:fetchFavicon', { itemUrl }),
    extractFileIcon: (filePath: string) =>
      invoke<{ localPath: string }>('icons:extractFileIcon', { filePath }),
  },

  window: {
    minimize: () => invoke<void>('window:minimize'),
    maximize: () => invoke<void>('window:maximize'),
    close:    () => invoke<void>('window:close'),
  },

  system: {
    openExternal: (url: string) => invoke<void>('system:openExternal', { url }),
    openPath: (path: string) => invoke<void>('system:openPath', { path }),
    revealInExplorer: (path: string) => invoke<void>('system:revealInExplorer', { path }),
    copyToClipboard: (text: string) => invoke<void>('system:copyToClipboard', { text }),
    showOpenDialog: (opts: { type: 'file' | 'folder'; title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      invoke<string | null>('system:showOpenDialog', opts),
    showSaveDialog: (opts: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      invoke<string | null>('system:showSaveDialog', opts),
    getUserDataPath: () => invoke<string>('system:getUserDataPath'),
  },

  backup: {
    listSnapshots:    () =>
      invoke<{ filename: string; timestamp: string; sizeBytes: number }[]>('backup:listSnapshots'),
    restoreSnapshot:  (filename: string) =>
      invoke<{ success: boolean }>('backup:restoreSnapshot', { filename }),
    export:           (destPath: string) =>
      invoke<{ success: boolean }>('backup:export', { destPath }),
    import:           (zipPath: string) =>
      invoke<{ success: boolean }>('backup:import', { zipPath }),
  },

  shortcuts: {
    get:   () =>
      invoke<{ accelerator: string }>('shortcuts:get'),
    set:   (accelerator: string) =>
      invoke<{ success: boolean; accelerator: string }>('shortcuts:set', { accelerator }),
    reset: () =>
      invoke<{ success: boolean; accelerator: string }>('shortcuts:reset'),
  },

  startup: {
    // Reads from OS Startup folder — always reflects true OS state
    get: () =>
      invoke<boolean>('startup:get'),
    // Sets OS shortcut + syncs DB.  Returns { success, error? }
    set: (enabled: boolean) =>
      invoke<{ success: boolean; error?: string }>('startup:set', { enabled }),
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as never)
  },
})

export { }
