// Typed wrapper around window.api - used by all hooks in renderer.
// Centralizes the API surface so hooks import from here, not window.api directly.

import type {
  Group, Card, Item, AppSettings, RecentItem, FavoriteItem, SearchIndexEntry,
  CreateGroupInput, UpdateGroupInput,
  CreateCardInput, UpdateCardInput,
  CreateItemInput, UpdateItemInput,
  Divider, CreateDividerInput, UpdateDividerInput,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (window as any).api

export const ipc = {
  groups: {
    getAll: (): Promise<Group[]> => api.groups.getAll(),
    create: (input: CreateGroupInput): Promise<Group> => api.groups.create(input),
    update: (input: UpdateGroupInput): Promise<Group> => api.groups.update(input),
    delete: (id: string): Promise<{ success: boolean }> => api.groups.delete(id),
    reorder: (ids: string[]): Promise<{ success: boolean }> => api.groups.reorder(ids),
    getCardCounts: (): Promise<{ groupId: string; cardCount: number }[]> => api.groups.getCardCounts(),
  },

  cards: {
    getByGroup: (groupId: string): Promise<Card[]> => api.cards.getByGroup(groupId),
    create: (input: CreateCardInput): Promise<Card> => api.cards.create(input),
    update: (input: UpdateCardInput): Promise<Card> => api.cards.update(input),
    delete: (id: string): Promise<{ success: boolean }> => api.cards.delete(id),
    reorder: (ids: string[]): Promise<{ success: boolean }> => api.cards.reorder(ids),
    move: (cardId: string, targetGroupId: string): Promise<{ success: boolean }> => api.cards.move(cardId, targetGroupId),
  },

  items: {
    getByCard: (cardId: string): Promise<Item[]> => api.items.getByCard(cardId),
    getAll: (): Promise<Item[]> => api.items.getAll(),
    create: (input: CreateItemInput): Promise<Item> => api.items.create(input),
    update: (input: UpdateItemInput): Promise<Item> => api.items.update(input),
    delete: (id: string): Promise<{ success: boolean }> => api.items.delete(id),
    move: (itemId: string, cardId: string): Promise<{ success: boolean }> => api.items.move(itemId, cardId),
    reorder: (updates: { id: string; sortOrder: number }[]): Promise<{ success: boolean }> => api.items.reorder(updates),
    launch: (id: string): Promise<{ success: boolean }> => api.items.launch(id),
    getCountsByCard: (): Promise<{ cardId: string; itemCount: number }[]> => api.items.getCountsByCard(),
  },

  search: {
    getIndex: (): Promise<SearchIndexEntry[]> => api.search.getIndex(),
    fullText: (query: string): Promise<string[]> => api.search.fullText(query),
  },

  recents: {
    get: (limit?: number): Promise<RecentItem[]> => api.recents.get(limit),
    record: (itemId: string): Promise<void> => api.recents.record(itemId),
  },

  favorites: {
    getAll: (): Promise<FavoriteItem[]> => api.favorites.getAll(),
    pin: (itemId: string): Promise<{ success: boolean }> => api.favorites.pin(itemId),
    unpin: (itemId: string): Promise<{ success: boolean }> => api.favorites.unpin(itemId),
    reorder: (ids: string[]): Promise<{ success: boolean }> => api.favorites.reorder(ids),
  },

  settings: {
    get: (): Promise<AppSettings> => api.settings.get(),
    update: (input: Partial<AppSettings>): Promise<AppSettings> => api.settings.update(input),
  },

  webview: {
    open: (url: string): Promise<void> => api.webview.open(url),
    navigate: (url: string): Promise<void> => api.webview.navigate(url),
    back: (): Promise<void> => api.webview.back(),
    forward: (): Promise<void> => api.webview.forward(),
    reload: (): Promise<void> => api.webview.reload(),
    close: (): Promise<void> => api.webview.close(),
    eject: (): Promise<void> => api.webview.eject(),
    resize: (size: number): Promise<void> => api.webview.resize(size),
  },

  icons: {
    resolve: (iconPath: string, iconSource: string, itemType: string, itemUrl?: string):
      Promise<{ resolvedPath: string; source: string }> =>
      api.icons.resolve(iconPath, iconSource, itemType, itemUrl),
    saveUpload: (sourcePath: string): Promise<{ localPath: string }> =>
      api.icons.saveUpload(sourcePath),
    saveUrl: (imageUrl: string): Promise<{ localPath: string }> =>
      api.icons.saveUrl(imageUrl),
    saveBase64: (base64: string): Promise<{ localPath: string }> =>
      api.icons.saveBase64(base64),
    previewUrl: (imageUrl: string): Promise<{ dataUri: string }> =>
      api.icons.previewUrl(imageUrl),
    previewLocal: (sourcePath: string): Promise<{ dataUri: string }> =>
      api.icons.previewLocal(sourcePath),
    fetchFavicon: (itemUrl: string): Promise<{ localPath: string }> =>
      api.icons.fetchFavicon(itemUrl),
    extractFileIcon: (filePath: string): Promise<{ localPath: string }> =>
      api.icons.extractFileIcon(filePath),
  },

  window: {
    minimize: (): Promise<void> => api.window.minimize(),
    maximize: (): Promise<void> => api.window.maximize(),
    close:    (): Promise<void> => api.window.close(),
  },

  system: {
    openExternal: (url: string): Promise<void> => api.system.openExternal(url),
    openPath: (path: string): Promise<void> => api.system.openPath(path),
    revealInExplorer: (path: string): Promise<void> => api.system.revealInExplorer(path),
    copyToClipboard: (text: string): Promise<void> => api.system.copyToClipboard(text),
    showOpenDialog: (opts: { type: 'file' | 'folder'; title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
      api.system.showOpenDialog(opts),
    showSaveDialog: (opts: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
      api.system.showSaveDialog(opts),
    getUserDataPath: (): Promise<string> => api.system.getUserDataPath(),
  },

  backup: {
    listSnapshots: (): Promise<{ filename: string; timestamp: string; sizeBytes: number }[]> =>
      api.backup.listSnapshots(),
    restoreSnapshot: (filename: string): Promise<{ success: boolean }> =>
      api.backup.restoreSnapshot(filename),
    export: (destPath: string): Promise<{ success: boolean }> =>
      api.backup.export(destPath),
    import: (zipPath: string): Promise<{ success: boolean }> =>
      api.backup.import(zipPath),
  },

  shortcuts: {
    get:   (): Promise<{ accelerator: string }> =>
      api.shortcuts?.get() ?? Promise.resolve({ accelerator: 'CommandOrControl+Shift+Space' }),
    set:   (accelerator: string): Promise<{ success: boolean; accelerator: string }> =>
      api.shortcuts?.set(accelerator) ?? Promise.reject(new Error('Shortcuts API not available')),
    reset: (): Promise<{ success: boolean; accelerator: string }> =>
      api.shortcuts?.reset() ?? Promise.reject(new Error('Shortcuts API not available')),
  },

  dividers: {
    getAll:  (): Promise<Divider[]> =>
      api.dividers.getAll(),
    create:  (input: CreateDividerInput): Promise<Divider> =>
      api.dividers.create(input),
    update:  (input: UpdateDividerInput): Promise<Divider | null> =>
      api.dividers.update(input),
    delete:  (id: string): Promise<{ success: boolean }> =>
      api.dividers.delete(id),
    reorder: (updates: { id: string; afterGroupId: string; sortOrder: number }[]): Promise<{ success: boolean }> =>
      api.dividers.reorder(updates),
  },

  startup: {
    // Reads OS Startup folder - never reads from DB
    get: (): Promise<boolean> =>
      api.startup?.get() ?? Promise.resolve(false),
    // Sets OS shortcut + syncs DB.  Returns { success, error? }
    set: (enabled: boolean): Promise<{ success: boolean; error?: string }> =>
      api.startup?.set(enabled) ?? Promise.reject(new Error('Startup API not available')),
  },

  on: (channel: string, cb: (...args: unknown[]) => void): void => api.on(channel, cb),
  off: (channel: string, cb: (...args: unknown[]) => void): void => api.off(channel, cb),
}
