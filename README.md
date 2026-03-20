# Command-Center

> A personal Windows desktop control center - every tool, URL, folder, script, and system action in one keyboard-driven hub.

![Version](https://img.shields.io/badge/version-0.1.0--beta-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?style=flat-square&logo=windows)
![Status](https://img.shields.io/badge/status-feature--complete-brightgreen?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-30-47848F?style=flat-square&logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite)
![License](https://img.shields.io/badge/license-private-lightgrey?style=flat-square)

---

## Overview

Command-Center eliminates the fragmentation of scattered bookmarks, pinned apps, folder shortcuts, and scripts by consolidating every tool into one always-available desktop hub. A remappable global shortcut (`Ctrl+Shift+Space`) brings the window to the foreground from any application - find what you need, launch it, and return to work.

Items are organized hierarchically: **Groups** represent working domains (e.g. *AutoHotkey*, *N8N*, *Data Analytics*), **Cards** are thematic collections within a group, and **Items** are the launchable entries inside each card. Every item type - URL, software, folder, terminal command, or Windows system action - is first-class.

```
Ctrl+Shift+Space
      │
      ▼
 Command-Center
      │
      ├── Group (e.g. "Daily Routine")
      │     └── Card (e.g. "Dev Tools")
      │           └── Item (URL / Software / Folder / Command / Action)
      │
      └── Home (Favorites + Recents)
```

---

## Screenshots

> 📷 Taking screenshots? See the **[Screenshot Guide](screenshots/SCREENSHOT_GUIDE.md)** for exact setup instructions per image.

![Group page — cards and items](screenshots/02-group-page-cards-items.png)

| Global search | Group Manager |
|---|---|
| ![Global search results](screenshots/05-search-results.png) | ![Group manager overview](screenshots/07-group-manager-overview.png) |

---

## Features

### Core Launcher
- **5 item types** - URL, Software (`.exe`/`.bat`/`.cmd`), Folder, Command (with args + CWD), and Windows system Actions
- **Global shortcut** - `Ctrl+Shift+Space` shows/hides the window from any app (remappable in Settings → Shortcuts)
- **System tray** - closing the window hides to tray; the process stays alive and reachable at all times. Right-click the tray icon for quick access to Show/Hide, **Launch at Startup** toggle, Reload, and Quit
- **Fuzzy search** - searches item labels, paths, and tags via Fuse.js; full-text note search via SQLite FTS5. Results grouped by group → card; keyboard navigate with `↑`/`↓`, launch with `Enter`, dismiss with `Escape`
- **Drag-to-reorder items** - drag items within a card to reorder them; drag across cards in the same group to move them. A grip handle slides in on hover (left of the icon). Sort order persisted to the database on drop
- **Drag-to-reorder cards** - drag cards within a group to reorganize their layout. A grip handle appears on hover in the card header. Card order persisted to the database on drop

### Sidebar
- **Group navigation** - drag-reorderable group pills with per-group accent color and custom icon
- **Custom section dividers** - right-click any group pill → *Insert divider after* to add a named `── LABEL ──` separator line between groups. Dividers are drag-reorderable alongside groups, and right-click a divider to rename or delete it. Useful for splitting a long group list into logical sections (e.g. *Work*, *Personal*, *Tools*)

### Home Screen
- **Pinned favorites** - drag-reorderable; right-click any item → *Pin to Home*
- **Recent launches** - auto-populated, last 20 items with relative timestamps and favicons

### Item Form
- **Horizontal type selector** - URL / Open File / Folder / Command / Action displayed as a compact pill tab row; active type highlighted with accent fill
- **Command templates** - one-click fill for PowerShell, CMD, Windows Terminal, Node REPL, Python, Git Log, NPM Start
- **Notes and tags** - 450-word note per item with word counter; unlimited tags (searchable via FTS5)

### Group Manager
- **Inline filter** — real-time search across group names, card names, item labels, and paths; matching groups auto-expand and card panels auto-open
- **Expand / Collapse all** — single-click to expand or collapse all groups; separate button to open or close all item panels simultaneously
- **Undo** — a 5-second toast with a countdown bar appears after every bulk delete or bulk move; one click reverses the operation completely
- **Empty group badge** — groups with no cards display a quiet "Empty" pill so dead-weight entries are instantly visible without expanding
- **Item counts in move dropdown** — the "Move items to card" dropdown shows the current item count next to each card name

### Icon System
Four input methods per item, all resolved to a local file at runtime - no network calls at launch:

| Method | Icon source | Description |
|---|---|---|
| Auto / Favicon | `auto` / `favicon` | Fetches and caches the site favicon for URL items |
| Emoji | `emoji` | 650+ Unicode emoji with keyword search and grid picker |
| Library | `library` | 1,460 Lucide icons with a per-item custom hex color |
| File — upload | `custom` | Local image picked from disk |
| File — URL | `url-icon` | Remote image URL downloaded and cached locally |
| File — base64 | `b64-icon` | Base64 string pasted directly; decoded and saved as file |

### Data & Privacy
- **100% local** - all data in `%APPDATA%\Command-Center\`; no cloud, no telemetry, no accounts
- **Auto-backup** - snapshot on every write, rolling 10 kept; full export/import via `.zip`
- **Item notes + tags** - each item supports a 450-word note and unlimited tags, all FTS5-searchable

### Performance Limits

Items load per-card and cards load per-group — only the active group is ever in the DOM, regardless of total DB size. The practical ceilings for smooth operation are:

| Dimension | Smooth ceiling | Notes |
|---|---|---|
| Total items in DB | ~5,000 | SQLite + Fuse.js index; no degradation until ~20,000 |
| Groups in sidebar | ~50 | Pills render all at once; 100+ starts to feel sluggish |
| Cards per group | ~20 | All cards in active group render simultaneously |
| Items per card | ~50 | No virtual scroll; 100+ items in one card becomes heavy |

A typical heavy setup — 20 groups × 8 cards × 30 items = **4,800 items** — runs without any noticeable overhead.

### Customization
- Dark / light theme
- Font size (small / medium / large) and density (compact / comfortable)
- Launch on startup, minimize to tray
- Embedded webview position (right or bottom panel) with resizable split

---

## Tech Stack

| Library | Version | Role |
|---|---|---|
| [Electron](https://electronjs.org) | 30 | Desktop shell, BrowserWindow, BrowserView, IPC |
| [React](https://react.dev) | 18 | UI framework |
| [TypeScript](https://typescriptlang.org) | 5 | Type safety throughout (strict mode) |
| [Vite](https://vitejs.dev) + [electron-vite](https://electron-vite.org) | 5 / 2 | Build tooling, HMR |
| [Tailwind CSS](https://tailwindcss.com) | 3 | Styling via design tokens |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | 9 | Local SQLite database, WAL mode |
| [Fuse.js](https://fusejs.io) | 7 | Client-side fuzzy search |
| [@dnd-kit](https://dndkit.com) | 6 / 8 | Drag-and-drop reordering |
| [lucide-react](https://lucide.dev) | 0.378 | 1,460 icons, loaded on demand |
| [jszip](https://stuk.github.io/jszip) | 3 | Export / import ZIP archives |

---

## Architecture

### Security Model
- `contextIsolation: true`, `nodeIntegration: false` - renderer has no direct Node.js access
- All system calls route through typed IPC channels defined in `electron/preload.ts`
- All IPC inputs are sanitized via `electron/utils/sanitize.ts` before use

### Key Design Decisions

| Decision | Rationale |
|---|---|
| SQLite over JSON | Queryable, crash-safe, FTS5 full-text search |
| BrowserView over `<webview>` | Own process, non-blocking, stable API |
| State-based routing | No react-router needed in a single-window app |
| Dynamic Lucide loading | Barrel import excluded from Vite pre-bundle; icons loaded individually to avoid ~1 MB startup overhead |
| Auto-backup on every write | Never lose more than one operation |
| Custom asset protocol | `command-center-asset://` maps to `%APPDATA%\Command-Center\` with path traversal protection |
| Mixed flat DndContext for sidebar | Groups and dividers share one `DndContext` so dividers drag alongside groups without breaking sort order |
| Single DndContext for card grid | Cards and items share one `DndContext` in `CardGrid`; `data.type='card'` discriminates card drags from item drags so both reorder paths coexist without conflict |

### Data Paths

| Path | Contents |
|---|---|
| `%APPDATA%\Command-Center\command-center.db` | Main SQLite database |
| `%APPDATA%\Command-Center\backups\` | Auto-backup snapshots (rolling 10) |
| `%APPDATA%\Command-Center\assets\icons\` | Uploaded and URL-fetched icons |
| `%APPDATA%\Command-Center\assets\favicons\` | Cached favicons |

### Source Layout

```
src/
├── components/
│   ├── cards/          # Card grid and card header
│   ├── groups/         # Group pills, color picker, icon picker
│   ├── items/          # Item rows, form panel, icon picker, context menu
│   ├── layout/         # AppShell, TopBar, Sidebar, WebviewPanel, SearchResults
│   └── ui/             # Shared primitives (ConfirmDialog, UndoToast)
├── context/            # FavoritesContext, SettingsContext, ThemeContext
├── hooks/              # useCards, useGroups, useItems, useSearch, useRecents, useWebview
├── pages/              # HomePage, GroupPage, GroupManagerPage, SettingsPage, …
├── types/              # Shared TypeScript interfaces (Item, Group, Card, AppSettings, …)
└── utils/              # ipc.ts, lucide-registry.ts
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Windows | 10 or 11 (x64) |
| Node.js | v18+ (v22 recommended) |
| Visual Studio Build Tools | 2022 with **Desktop development with C++** workload |

> Visual Studio Build Tools are required by `better-sqlite3` to compile the native SQLite binding against the installed Electron version.

### Install

```bash
git clone https://github.com/wsnh2022/command-center.git
cd command-center
npm install
```

If `better-sqlite3` fails to compile after install:

```bash
npm run rebuild
```

### Development

```bash
npm run dev
```

> **Note:** If icons appear broken on first launch, stop the dev server and restart. The `command-center-asset://` protocol registers at app startup and cannot be hot-reloaded mid-session.

### Production Build

```bash
npm run dist
```

Outputs to `release/`:

| File | Description |
|---|---|
| `Command-Center Setup 0.1.0-beta.exe` | NSIS installer (~86 MB, includes Electron runtime) |
| `Command-Center 0.1.0-beta.exe` | Portable executable (no install required) |
| `win-unpacked/` | Unpacked build directory |

> Quit the app from the system tray before running `npm run dist`. An open process holds a file lock on the `.exe` and electron-builder will fail with `EBUSY`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Space` | Show / hide window (global - works from any app) |
| `Ctrl+S` | Focus search bar from anywhere in the window; selects existing text so you can type immediately |
| `↑` / `↓` | Navigate search results |
| `Enter` | Launch selected search result |
| `Escape` | Close search overlay / dismiss modals |

The global shortcut is remappable in **Settings → Shortcuts**.

### Context Menus (right-click)

| Target | Actions available |
|---|---|
| Any item row | Open in Webview, Pin / Unpin, Select, Edit, Copy path, Move to card, Delete |
| Group pill in sidebar | Rename / Edit, Delete, Insert divider after |
| Custom sidebar divider | Rename, Delete |
| System tray icon | Show / Hide window, Launch at Startup (checkbox), Reload, Quit |

---

## Roadmap

**v0.1.0-beta** — all core build phases complete. Fully functional for daily use.

| Phase | Status |
|---|---|
| Phase 15 — Group Manager improvements (inline filter, bulk undo, empty badges) | ✅ Complete |
| Phase 15a — Drag-to-reorder items within and across cards | ✅ Complete |
| Phase 15b — Drag-to-reorder cards within a group | ✅ Complete |
| Performance optimisation pass (memoization, parallel deletes, search nav fix) | ✅ Complete |
| `sanitizeIconSource` — added `url-icon` and `b64-icon` to allowed list | ✅ Complete |
| Phase 14 — Project Dashboard (group status, description, deadline, home screen) | 🔜 Planned |

---

## Project Logs

| File | Contents |
|---|---|
| [`PROGRESS.md`](PROGRESS.md) | Session-by-session development log |
| [`RESUME.md`](RESUME.md) | Full phase tracker, file inventory, and deferred work |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | IPC channels, security model, module boundaries |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | SQLite schema and migration history |
| [`docs/UI_DESIGN_SPEC.md`](docs/UI_DESIGN_SPEC.md) | Design tokens, color system, component patterns |

---

## Author

Built by [wsnh2022](https://github.com/wsnh2022) - Data Analyst, Automation Engineer, and desktop software developer specialising in Electron-based Windows applications.
