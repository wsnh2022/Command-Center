# DATA_FLOW.md
# Command-Center — Data Flow Specification

> **Version:** 1.0.0-spec  
> **Last Updated:** 2026-03-07  
> **Principle:** Renderer never touches the DB or filesystem directly. All data flows through IPC.  

---

## 1. Core Data Flow Rule

```
Renderer (React)
    │
    │  window.api.{domain}.{action}(payload)    ← typed IPC call
    │
    ▼
Preload Script (contextBridge)
    │
    │  ipcRenderer.invoke(channel, payload)
    │
    ▼
Main Process (IPC Handler)
    │
    ├── Sanitize + validate input
    ├── Call service or query function
    ├── DB read/write (better-sqlite3)
    ├── Trigger auto-backup (on writes)
    └── Return typed result
    │
    ▼
Renderer receives typed response
    │
    └── Update React state → UI re-renders
```

**Rule:** The renderer is a pure UI layer. It holds state in React, displays it,
and calls `window.api` to read or write. It never imports `better-sqlite3`,
`fs`, or any Node.js module directly.

---

## 2. Startup Data Flow

The complete sequence from process start to rendered home screen:

```
[1] electron/main.ts starts
      │
      ├─ Initialize app paths (%APPDATA%\Command-Center\)
      ├─ Open SQLite DB (or create on first run)
      ├─ Run pending migrations
      ├─ Register all IPC handlers
      ├─ Create BrowserWindow (hidden)
      ├─ Inject preload.ts via contextBridge
      ├─ Create system tray
      └─ Register Windows login item (auto-startup)

[2] BrowserWindow loads renderer (Vite-built React)
      │
      └─ index.html → main.tsx → App.tsx

[3] App.tsx mounts
      │
      ├─ SettingsContext: window.api.settings.get()
      │     └─ Returns AppSettings → apply theme + font + density to <html>
      │
      ├─ useGroups: window.api.groups.getAll()
      │     └─ Returns Group[] → populate sidebar pills
      │
      └─ Navigate to HomePage

[4] HomePage mounts
      │
      ├─ useRecents: window.api.recents.get({ limit: 20 })
      │     └─ Returns RecentItem[] → render recents list
      │
      └─ useFavorites: window.api.favorites.getAll()
            └─ Returns FavoriteItem[] → render favorites list

[5] Window shown — user sees home screen
      Total time target: < 2 seconds from cold launch
```

---

## 3. Group Navigation Flow

User clicks a group pill in the sidebar:

```
[1] User clicks GroupPill (groupId: 'abc')
      │
      └─ App.tsx: setActivePage({ type: 'group', groupId: 'abc' })

[2] GroupPage mounts with groupId prop
      │
      └─ useCards: window.api.cards.getByGroup('abc')
            └─ Returns Card[] → render CardGrid

[3] For each Card in grid:
      │
      └─ useItems: window.api.items.getByCard(cardId)
            └─ Returns Item[] (with tags joined) → render ItemList

[4] Icons resolve in parallel (non-blocking):
      │
      └─ useResolvedIcon() per item → window.api.icons.resolve(iconPath)
            └─ Returns local path → <img src={localPath} />

[5] Full group page rendered
      No blocking — cards appear as data loads, icons fill in immediately
```

---

## 4. Item Launch Flow

User single-clicks an item row:

```
[1] User clicks ItemRow (itemId: 'xyz', type: 'url', path: 'https://github.com')
      │
      └─ window.api.items.launch('xyz')

[2] Main process: items.ipc.ts → launch handler
      │
      ├─ Fetch item from DB (get path + type)
      ├─ Sanitize path (no path traversal, no unsafe protocols)
      └─ Route to launch.service.ts

[3] launch.service.ts routes by type:
      │
      ├─ 'url'    → send webview:open IPC to renderer
      │             OR shell.openExternal(path) if webview closed
      ├─ 'exe'    → shell.openPath(path)
      ├─ 'folder' → shell.openPath(path)
      ├─ 'script' → shell.openPath(path)  ← OS default handler
      └─ 'ssh'    → shell.openExternal(`ssh://${path}`)
                    opens native terminal

[4] After launch (all types):
      │
      └─ recents.service.recordLaunch(itemId)
            ├─ UPSERT into recents table (update launched_at if exists)
            └─ DELETE oldest rows if count > 20

[5] Renderer receives launch confirmation
      │
      └─ useRecents invalidates → re-fetches recents list
            └─ Home screen recents updates in background
```

---

## 5. Item Create/Edit Flow

User clicks `+ Add Item` or right-click → Edit:

```
[1] ItemFormPanel slides in (right edge)
      │
      └─ If edit: window.api.items.getByCard(cardId) already loaded
                  Pre-fill form fields from existing Item data

[2] User fills form:
      Label, Path, Type, Icon, Tags, Note
      │
      ├─ Icon: opens IconPicker → resolves to local path (see ICON_SYSTEM.md)
      ├─ Tags: free-form input → stored as tag names
      └─ Note: textarea with live word count (max 450 words)

[3] User clicks Save
      │
      ├─ Renderer validates: label required, path required, type selected
      └─ window.api.items.create(payload)  OR  window.api.items.update(payload)

[4] Main process: items.ipc.ts
      │
      ├─ Sanitize all fields
      ├─ Generate UUID for new item
      ├─ INSERT or UPDATE items table
      ├─ Sync tags:
      │     ├─ Upsert each tag into tags table
      │     ├─ Delete old item_tags for this item
      │     └─ Insert new item_tags rows
      ├─ If new URL item + no custom icon:
      │     └─ Trigger async favicon fetch (non-blocking)
      ├─ Trigger auto-backup
      └─ Return saved Item (with tags joined)

[5] Renderer:
      │
      ├─ useItems updates state with new/updated item
      ├─ ItemList re-renders with new item
      └─ SlidePanel closes
```

---

## 6. Search Flow

User types in the always-visible SearchBar:

```
[1] SearchBar mounts
      │
      └─ useSearch: window.api.search.getIndex()
            └─ Returns SearchIndexEntry[] — all items across all groups
                  Fields: itemId, label, path, note, tags[], cardId,
                          cardName, groupId, groupName

[2] Index stored in React ref (not state — no re-render on index load)
      │
      └─ fuse.js instance created with index
            Keys + weights:
              label      weight: 3   (most important)
              tags       weight: 2
              path       weight: 1
              note       weight: 0.5 (long text, lower weight)
              cardName   weight: 1
              groupName  weight: 0.5

[3] User types query (debounced 150ms)
      │
      ├─ fuse.js runs fuzzy search → returns scored results
      └─ For deep note search: window.api.search.fullText(query)
              └─ Main process runs FTS5 query → returns matching itemIds
                    └─ Merge with fuse results, deduplicate, re-rank

[4] SearchResults renders grouped dropdown:
      │
      ├─ Group: "Work" → Card: "Dev Tools" → [GitHub item]
      ├─ Group: "Personal" → Card: "Reading" → [Article item]
      └─ ...
      Matched characters highlighted with <mark> (accent color)

[5] User clicks result:
      │
      ├─ Navigate to group page (setActivePage)
      ├─ Scroll card into view
      ├─ Highlight item row briefly (flash accent bg 500ms)
      └─ Close search dropdown

[6] Search index refresh:
      │
      └─ Triggered after any items:create, items:update, items:delete
            └─ useSearch re-fetches index → fuse instance rebuilt
```

---

## 7. Webview Data Flow

User opens a URL item in embedded webview:

```
[1] launch.service.ts detects type = 'url'
      │
      └─ ipcMain sends 'webview:open' push event to renderer
            Payload: { url: 'https://github.com' }

[2] Renderer: useWebview hook receives 'webview:open'
      │
      ├─ setWebviewOpen(true)
      ├─ setWebviewUrl(url)
      └─ WebviewPanel slides in from right

[3] WebviewPanel renders — sends 'webview:open' to main
      │
      └─ Main process: BrowserView.loadURL(url)
            BrowserView bounds set to panel area
            BrowserView attached to main window

[4] BrowserView navigates
      │
      └─ 'did-navigate' event fires
            └─ main sends 'webview:urlChanged' push to renderer
                  └─ WebviewPanel URL bar updates

[5] User resizes panel (drags divider)
      │
      └─ Renderer sends 'webview:resize' { width: 520 }
            └─ Main recalculates BrowserView bounds
                  └─ BrowserView.setBounds({ x, y, width, height })

[6] User clicks Eject button
      │
      └─ window.api.webview.eject()
            └─ Main: shell.openExternal(currentBrowserViewUrl)
                  Browser opens — webview panel stays open

[7] User clicks Close (✕)
      │
      ├─ window.api.webview.close()
      │     └─ Main: BrowserView detached + hidden
      └─ Renderer: setWebviewOpen(false) → full card grid restored
```

---

## 8. Settings Data Flow

```
[1] App startup:
      SettingsContext → window.api.settings.get()
      └─ Returns AppSettings from DB
      └─ Apply to DOM:
            document.documentElement.setAttribute('data-theme', settings.theme)
            document.documentElement.setAttribute('data-font-size', settings.fontSize)
            document.documentElement.setAttribute('data-density', settings.density)

[2] User changes a setting (e.g. toggles theme):
      │
      └─ window.api.settings.update({ theme: 'light' })
            ├─ Main: UPDATE settings SET theme='light', updated_at=now()
            ├─ Trigger auto-backup
            └─ Return updated AppSettings

[3] Renderer receives updated settings:
      │
      └─ SettingsContext updates state
            └─ useEffect: re-apply data-* attributes to DOM
                  └─ CSS variables change → entire app re-themes instantly
                        No page reload. No flash. Pure CSS variable swap.

[4] Per-group accent color:
      │
      └─ GroupPage renders with group.accentColor
            └─ Injects inline style on group container:
                  style={{ '--accent': group.accentColor }}
                  └─ All child components use var(--accent) → correct color
```

---

## 9. Backup Auto-Trigger Flow

Runs silently after every DB write:

```
Any IPC write handler completes successfully
      │
      └─ backup.service.autoBackup()
            │
            ├─ Copy command-center.db → backups/command-center-backup-{timestamp}.db
            ├─ List all files in backups/ sorted by date DESC
            ├─ If count > 10: delete oldest files until count = 10
            └─ Return (silent — no UI notification)

[Error handling]
      │
      └─ If backup fails (disk full, permissions):
            └─ Log error to app log file
                  No crash. No user interruption. Write still succeeded.
```

---

## 10. Export ZIP Flow

User clicks Export on Import/Export page:

```
[1] User clicks "Export" → chooses save location via dialog
      │
      └─ window.api.backup.exportZip({ destPath })

[2] Main: export.service.ts
      │
      ├─ Read all DB tables → serialize to config.json
      │     Groups, Cards, Items, Tags, ItemTags,
      │     Favorites, Recents, Settings, IconCache
      │
      ├─ jszip: create new ZIP
      │     zip.file('config.json', JSON.stringify(data, null, 2))
      │
      ├─ Walk assets/icons/ → add each file to zip
      │     zip.file('assets/icons/abc.png', fileBuffer)
      │
      ├─ Walk assets/favicons/ → add each file to zip
      │     zip.file('assets/favicons/xyz.png', fileBuffer)
      │
      ├─ Generate ZIP buffer
      └─ Write to destPath

[3] Renderer:
      └─ Show success toast: "Exported to {filename}"
```

---

## 11. State Management Summary

Command-Center uses **React state + context only** — no Redux, no Zustand,
no external state library. The data layer is SQLite (source of truth).
React state is a cache of what's in the DB.

| State | Location | Scope |
|---|---|---|
| Groups list | `useGroups` hook | App-wide (loaded once) |
| Cards per group | `useCards(groupId)` hook | Per GroupPage render |
| Items per card | `useItems(cardId)` hook | Per Card render |
| Search index | `useSearch` hook | App-wide (loaded once) |
| Recents | `useRecents` hook | HomePage |
| Favorites | `useFavorites` hook | HomePage |
| App settings | `SettingsContext` | App-wide |
| Theme | `ThemeContext` | App-wide |
| Webview state | `useWebview` hook | App-wide |
| Active page | `App.tsx` local state | App-wide |

**Invalidation rule:** After any write IPC call succeeds, the relevant hook
re-fetches from DB. No optimistic updates in v1 — correctness over speed.
DB reads via `better-sqlite3` are synchronous and fast enough that
re-fetching after write is imperceptible.

---

## 12. Error Handling Conventions

| Error Type | Handling |
|---|---|
| IPC call fails (main process error) | Renderer catches, shows inline error or toast |
| DB write fails | IPC returns `{ success: false, error: string }`, no backup triggered |
| File not found (icon) | Silent fallback to generic icon (see ICON_SYSTEM.md) |
| Favicon fetch fails | Mark `is_valid = 0` in icon_cache, use generic icon |
| Launch fails (bad path) | Toast: "Could not open — check the path in Edit" |
| Import fails (corrupt ZIP) | Modal error: "Import failed — file may be corrupt" |
| Backup fails (disk full) | Log only — no user interruption |
| Window resize below min | Electron enforces minimum size — no handler needed |

**Rule:** No unhandled promise rejections. Every `window.api` call wrapped
in try/catch in hooks. Errors surfaced to user only when actionable.

---

*This document, combined with ARCHITECTURE.md and DATABASE_SCHEMA.md,
provides complete traceability for every data operation in Command-Center.*
