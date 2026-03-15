# ARCHITECTURE.md
# Command-Center — Application Architecture

> **Version:** 1.0.0-spec  
> **Last Updated:** 2026-03-07  
> **Status:** Pre-implementation blueprint  

---

## 1. Process Architecture

Electron runs two isolated processes. Understanding this split is critical for every implementation decision.

```
┌─────────────────────────────────────────────────────────┐
│                     MAIN PROCESS                        │
│  (Node.js — full OS access)                             │
│                                                         │
│  • App lifecycle (start, tray, minimize, quit)          │
│  • SQLite database (better-sqlite3)                     │
│  • File system operations (icons, backups, exports)     │
│  • Script / executable launching (shell.openPath)       │
│  • BrowserView management (webview)                     │
│  • Auto-backup scheduler                                │
│  • IPC handler registration                             │
│  • Windows startup registration                         │
│  • System tray management                               │
└────────────────────┬────────────────────────────────────┘
                     │  IPC Bridge (ipcMain / ipcRenderer)
                     │  Preload script (contextBridge)
┌────────────────────▼────────────────────────────────────┐
│                  RENDERER PROCESS                       │
│  (Chromium — React + Tailwind UI)                       │
│                                                         │
│  • All UI rendering (React components)                  │
│  • State management (React state + context)             │
│  • Fuzzy search (fuse.js — runs in renderer)            │
│  • User interactions → IPC calls to main                │
│  • NO direct file system or DB access                   │
│  • NO Node.js APIs directly                             │
└─────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               BROWSER VIEW (Webview)                    │
│  (Separate Chromium instance)                           │
│                                                         │
│  • Renders embedded websites                            │
│  • Fully isolated from app renderer                     │
│  • Controlled entirely by main process                  │
│  • Navigation events forwarded to renderer via IPC      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Project Folder Structure

```
command-center/
│
├── electron/                        # Main process code
│   ├── main.ts                      # App entry, window creation, tray setup
│   ├── preload.ts                   # contextBridge — exposes safe IPC to renderer
│   ├── ipc/                         # IPC handler modules (one file per domain)
│   │   ├── groups.ipc.ts            # Group CRUD operations
│   │   ├── cards.ipc.ts             # Card CRUD operations
│   │   ├── items.ipc.ts             # Item CRUD + launch operations
│   │   ├── search.ipc.ts            # Search data fetch for renderer
│   │   ├── icons.ipc.ts             # Icon fetch, save, resolve
│   │   ├── backup.ipc.ts            # Auto-backup, export, import
│   │   ├── webview.ipc.ts           # BrowserView control
│   │   ├── settings.ipc.ts          # App settings read/write
│   │   └── system.ipc.ts            # Launch items, open folders, SSH
│   ├── db/                          # Database layer
│   │   ├── database.ts              # SQLite connection + initialization
│   │   ├── migrations/              # Schema version migrations
│   │   │   └── 001_initial.ts       # Initial schema creation
│   │   └── queries/                 # Typed query functions
│   │       ├── groups.queries.ts
│   │       ├── cards.queries.ts
│   │       ├── items.queries.ts
│   │       ├── recents.queries.ts
│   │       └── settings.queries.ts
│   ├── services/                    # Business logic services
│   │   ├── backup.service.ts        # Auto-backup + rolling snapshot logic
│   │   ├── icon.service.ts          # Icon resolution hierarchy + saving
│   │   ├── launch.service.ts        # Item launch routing by type
│   │   ├── export.service.ts        # ZIP export + JSON export
│   │   └── import.service.ts        # ZIP import + conflict resolution
│   └── utils/
│       ├── paths.ts                 # App path constants (%APPDATA% etc.)
│       └── sanitize.ts              # Input sanitization for IPC payloads
│
├── src/                             # Renderer process code (React)
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root component + router
│   ├── pages/                       # Top-level page components
│   │   ├── HomePage.tsx             # Favorites + recents launchpad
│   │   ├── GroupPage.tsx            # Card grid for a group
│   │   ├── SettingsPage.tsx         # Theme, font, density, startup
│   │   ├── GroupManagerPage.tsx     # Bulk group + card management
│   │   ├── ImportExportPage.tsx     # Backup, restore, share
│   │   ├── ShortcutsPage.tsx        # Keyboard shortcuts reference
│   │   └── AboutPage.tsx            # Version, credits
│   ├── components/                  # Reusable UI components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # Root layout (sidebar + topbar + main)
│   │   │   ├── Sidebar.tsx          # Group pill tabs + page icons
│   │   │   ├── TopBar.tsx           # Search bar + window controls
│   │   │   └── WebviewPanel.tsx     # Resizable BrowserView panel
│   │   ├── groups/
│   │   │   ├── GroupPill.tsx        # Single draggable group tab
│   │   │   ├── GroupPillList.tsx    # Drag-reorderable pill list
│   │   │   └── AddGroupModal.tsx    # Modal: new group (name, icon, color)
│   │   ├── cards/
│   │   │   ├── CardGrid.tsx         # 4×2 responsive card grid
│   │   │   ├── Card.tsx             # Single card (header + item list)
│   │   │   ├── CardHeader.tsx       # Icon + renamable title
│   │   │   └── AddCardButton.tsx    # + Add Card trigger
│   │   ├── items/
│   │   │   ├── ItemList.tsx         # Flat file-manager list
│   │   │   ├── ItemRow.tsx          # Single item row (icon, label, info btn)
│   │   │   ├── ItemContextMenu.tsx  # Right-click context menu
│   │   │   ├── ItemNoteDropdown.tsx # 450-word note + tags expand
│   │   │   ├── ItemFormPanel.tsx    # Slide-in add/edit panel
│   │   │   └── AddItemButton.tsx    # + Add Item trigger
│   │   ├── icons/
│   │   │   └── IconPicker.tsx       # Icon picker modal (5 input methods)
│   │   ├── search/
│   │   │   ├── SearchBar.tsx        # Always-visible top search input
│   │   │   └── SearchResults.tsx    # Grouped results dropdown
│   │   └── ui/                      # Primitive UI components
│   │       ├── Modal.tsx
│   │       ├── SlidePanel.tsx
│   │       ├── ContextMenu.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── ColorPicker.tsx
│   ├── hooks/                       # Custom React hooks
│   │   ├── useGroups.ts             # Group state + IPC calls
│   │   ├── useCards.ts              # Card state + IPC calls
│   │   ├── useItems.ts              # Item state + IPC calls
│   │   ├── useRecents.ts            # Recently used tracking
│   │   ├── useSearch.ts             # fuse.js search logic
│   │   ├── useSettings.ts           # App settings state
│   │   └── useWebview.ts            # Webview panel state + controls
│   ├── context/                     # React context providers
│   │   ├── ThemeContext.tsx          # Dark/light + accent colors
│   │   └── SettingsContext.tsx       # Global settings state
│   ├── types/                       # TypeScript interfaces
│   │   └── index.ts                 # All shared types (see DATABASE_SCHEMA.md)
│   └── utils/
│       ├── ipc.ts                   # Typed IPC call wrappers
│       ├── fuzzy.ts                 # fuse.js configuration + search logic
│       └── format.ts                # Date, path, label formatting helpers
│
├── assets/                          # Static assets bundled with app
│   └── icons/                       # Built-in Lucide icon exports
│
├── public/                          # Vite public folder
│   └── app-icon.png                 # App window + tray icon
│
├── electron.vite.config.ts          # Vite config for Electron (main + renderer)
├── tailwind.config.ts               # Tailwind config + design tokens
├── tsconfig.json                    # TypeScript config
├── package.json
└── README.md
```

---

## 3. User Data Folder Structure (Runtime)

```
%APPDATA%\Command-Center\
├── command-center.db                   # Main SQLite database
├── backups\                         # Rolling auto-backups (max 10)
│   ├── command-center-backup-2026-03-07-120000.db
│   └── command-center-backup-2026-03-07-115500.db
└── assets\
    ├── icons\                       # User-set custom icons
    │   └── {uuid}.png / {uuid}.svg
    └── favicons\                    # Auto-fetched URL favicons
        └── {domain-hash}.png
```

---

## 4. IPC Channel Map

All communication between renderer and main process goes through named IPC channels. The preload script exposes these via `contextBridge` as `window.api`.

### Convention
- `domain:action` naming (e.g. `groups:create`)
- All handlers in main process validate + sanitize inputs before execution
- All responses typed — never raw DB rows to renderer

### Groups
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `groups:getAll` | R → M | — | `Group[]` |
| `groups:create` | R → M | `CreateGroupInput` | `Group` |
| `groups:update` | R → M | `UpdateGroupInput` | `Group` |
| `groups:delete` | R → M | `{ id: string }` | `{ success: boolean }` |
| `groups:reorder` | R → M | `{ ids: string[] }` | `{ success: boolean }` |

### Cards
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `cards:getByGroup` | R → M | `{ groupId: string }` | `Card[]` |
| `cards:create` | R → M | `CreateCardInput` | `Card` |
| `cards:update` | R → M | `UpdateCardInput` | `Card` |
| `cards:delete` | R → M | `{ id: string }` | `{ success: boolean }` |
| `cards:reorder` | R → M | `{ ids: string[] }` | `{ success: boolean }` |

### Items
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `items:getByCard` | R → M | `{ cardId: string }` | `Item[]` |
| `items:create` | R → M | `CreateItemInput` | `Item` |
| `items:update` | R → M | `UpdateItemInput` | `Item` |
| `items:delete` | R → M | `{ id: string }` | `{ success: boolean }` |
| `items:move` | R → M | `{ itemId, targetCardId }` | `{ success: boolean }` |
| `items:moveBulk` | R → M | `{ itemIds[], targetCardId }` | `{ success: boolean }` |
| `items:launch` | R → M | `{ id: string }` | `{ success: boolean }` |
| `items:getAll` | R → M | — | `Item[]` (for search index) |

### Search
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `search:getIndex` | R → M | — | `SearchIndexEntry[]` |

### Icons
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `icons:fetchFavicon` | R → M | `{ url: string }` | `{ localPath: string }` |
| `icons:saveCustom` | R → M | `{ source, type }` | `{ localPath: string }` |
| `icons:resolve` | R → M | `{ localPath: string }` | `{ resolvedPath: string }` |

### Webview
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `webview:open` | R → M | `{ url: string }` | — |
| `webview:navigate` | R → M | `{ url: string }` | — |
| `webview:back` | R → M | — | — |
| `webview:forward` | R → M | — | — |
| `webview:reload` | R → M | — | — |
| `webview:close` | R → M | — | — |
| `webview:eject` | R → M | — | — (opens in browser) |
| `webview:urlChanged` | M → R | `{ url: string }` | — |

### Settings
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `settings:get` | R → M | — | `AppSettings` |
| `settings:update` | R → M | `Partial<AppSettings>` | `AppSettings` |

### Backup / Export / Import
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `backup:exportZip` | R → M | `{ destPath: string }` | `{ success: boolean }` |
| `backup:importZip` | R → M | `{ srcPath, mode }` | `{ success: boolean }` |
| `backup:listSnapshots` | R → M | — | `Snapshot[]` |
| `backup:restoreSnapshot` | R → M | `{ snapshotPath: string }` | `{ success: boolean }` |

### System
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `system:openExternal` | R → M | `{ url: string }` | — |
| `system:openPath` | R → M | `{ path: string }` | — |
| `system:revealInExplorer` | R → M | `{ path: string }` | — |
| `system:copyToClipboard` | R → M | `{ text: string }` | — |

### Recents
| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `recents:get` | R → M | `{ limit?: number }` | `RecentItem[]` |
| `recents:record` | R → M | `{ itemId: string }` | — |

---

## 5. Window Management

### Main Window
- Default size: `1280 × 800` (centered on launch)
- Minimum size: `900 × 600` (prevents layout breakage)
- Freely resizable + maximizable
- All layouts use CSS Grid/Flexbox — reflow cleanly at any size
- `frame: false` with custom title bar OR `frame: true` with native title bar *(decision: native title bar for v1 — simpler, faster)*

### Tray Behavior
- App minimizes to tray on window close (does not quit)
- Tray left-click → show/hide main window
- Tray right-click → context menu (see PROJECT_OVERVIEW.md §4.11)
- Quit only via tray menu → Quit

### BrowserView (Webview Panel)
- Attached to main window
- Positioned dynamically by main process based on panel open/close state
- Resizable via draggable divider (renderer sends resize events → main repositions BrowserView bounds)
- Min width: `300px`, Max width: `70%` of window width

---

## 6. Startup Sequence

```
1. Electron main.ts starts
2. App paths initialized (%APPDATA%\Command-Center\)
3. SQLite DB opened (or created on first run)
4. Migrations run (if needed)
5. Main window created (hidden)
6. Preload script injected
7. Renderer loads (Vite-built React app)
8. IPC handlers registered
9. System tray created
10. Auto-startup registered (Windows login item)
11. Main window shown
12. Renderer fetches initial data (groups, settings, recents)
13. Home screen rendered
```

---

*Next document: → `DATABASE_SCHEMA.md`*
