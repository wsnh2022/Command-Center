# PROJECT_OVERVIEW.md
# Command-Center — Project Overview

> **Version:** 1.0.0-spec  
> **Last Updated:** 2026-03-07  
> **Status:** Pre-implementation blueprint  

---

## 1. Vision

Command-Center is a **personal Windows desktop control center** built with Electron. It eliminates the friction of scattered bookmarks, folder shortcuts, and script launchers by bringing every tool, link, path, and connection into one fast, beautiful, always-available hub.

The experience must feel **native, instantaneous, and effortless** — not like a web app wrapped in a window.

---

## 2. Core Philosophy

| Principle | Meaning |
|---|---|
| **Local-first** | All data lives on disk. No cloud dependency in v1. |
| **Speed above all** | Sub-2s cold launch. Fluid navigation. Zero jank. |
| **Personal-first, team-ready** | Built for one power user, architected cleanly for team distribution later. |
| **Minimalist but vibrant** | Clean UI, no clutter, strong accent colors per group. |
| **Zero broken states** | Every fallback is handled. Icons, paths, missing files — always graceful. |

---

## 3. Target Users

### Primary (v1)
- A single power user (developer / technical professional) on Windows
- Manages dozens of tools, URLs, scripts, folders, and SSH connections daily
- Values speed, organization, and keyboard-friendly navigation

### Future (v2+)
- Small developer teams (2–10 people)
- Shared config via exported `.zip` bundles
- Potential internal tooling distribution

---

## 4. Feature Summary

### 4.1 Home Screen
- Launches on app open
- **Left side:** manually pinned favorite items (quick access)
- **Right side:** recently used items (auto-populated, last 20)
- Acts as a launchpad — no setup required to start using

### 4.2 Left Sidebar — Group Navigation
- Unlimited groups (no cap)
- Each group: drag-reorderable pill tab with icon + renamable label
- Per-group custom accent color
- `+ Add Group` button at bottom of sidebar
- Bottom icon bar for app pages (Settings, About, etc.)

### 4.3 Main Area — Card Grid
- 4×2 card grid per group (scrollable overflow)
- Each card has: icon + renamable title header
- Inside each card: flat file-manager style list of items
- Items show: icon, label, path/URL preview
- Hover on item → info button appears → shows tags + 450-word note
- `+ Add Card` button at bottom of group area
- `+ Add Item` button at bottom of each card's list

### 4.4 Item Types
| Type | DB Value | Launch Behavior |
|---|---|---|
| URL | `url` | Opens in embedded webview (default) or default browser |
| Software | `software` | Launches .exe / .bat via OS default handler (`shell.openPath`) |
| Folder | `folder` | Opens in Windows File Explorer (`shell.openPath`) |
| Command | `command` | Spawns terminal command with args + working directory (`child_process.spawn`) |
| Action | `action` | Executes predefined Windows system action via IPC (`action_id` dispatch) OR custom shell command |

### 4.5 Embedded Webview
- Opens on demand as a resizable split panel alongside card grid
- Has browser-style navigation bar (back, forward, refresh, URL display)
- Eject button → opens current URL in default browser
- Close button → dismisses webview, restores full card grid view
- Powered by Electron `BrowserView` (not `<webview>` tag)

### 4.6 Item Interaction
- **Single click** → launch immediately
- **Hover** → info button appears (bottom-right of item row)
- **Info button click** → expands 450-word note + tags dropdown
- **Right-click** → context menu:
  - Open in Webview
  - Edit (opens slide-in panel)
  - Copy Path to Clipboard
  - Move to Card... (submenu)
  - Delete

### 4.7 Adding & Editing
- **New card** → `+ Add Card` → centered modal dialog (name, icon, accent color)
- **New item** → `+ Add Item` inside card → slide-in right panel
- **Edit item** → right-click → Edit → same slide-in right panel, pre-filled
- **Slide-in panel fields:** label, path/URL, type, icon picker, tags, 450-word note

### 4.8 Search
- Always-visible search bar spanning full window width at top
- Fuzzy search powered by `fuse.js`
- Searches across: item labels, paths, tags, note content, card titles, group names
- Results grouped by group → card → item
- Instant results as you type (debounced 150ms)

### 4.9 Speed & Performance
- Cold launch target: < 2 seconds
- All DB reads synchronous via `better-sqlite3`
- Icons loaded from local file paths only at runtime
- No blocking network calls on startup
- Recently used: tracked automatically, last 20 items stored in DB

### 4.10 Visual Customization
- Dark / light theme toggle
- Per-group accent color (color picker, saved per group)
- Compact / comfortable density toggle (affects card and list spacing)
- Font size control (Small / Medium / Large)
- Minimalist aesthetic: clean backgrounds, vibrant accents, readable typography

### 4.11 System Integration (Windows)
- Auto-launches on Windows startup (via Electron `app.setLoginItemSettings`)
- Lives in both system tray + taskbar
- Tray right-click menu:
  - Show / Hide Window
  - Home
  - Quick Launch (submenu: last 5 used items)
  - Global Search (focus app on search bar)
  - Reload App
  - Check for Updates
  - Quit

### 4.12 Data & Backup
- All data stored in SQLite at `%APPDATA%\Command-Center\command-center.db`
- Auto-backup on every write: rolling 10 snapshots in `%APPDATA%\Command-Center\backups\`
- Backup filename format: `command-center-backup-YYYY-MM-DD-HHmmss.db`
- Export: produces `command-center-export.zip` containing `config.json` + `/assets/` folder
- Import: accepts `.zip` (full restore) or `.json` (config only, icons re-fetched/fallback)
- Conflict resolution on import: "Replace All" or "Keep Existing, Add New Only"

### 4.13 Bulk Operations
- Checkbox appears on item hover (multi-select mode)
- Floating action bar on selection: Move to... | Delete Selected | Copy Paths
- Group & Card Management page: bulk rename, reorder, recolor, delete groups and cards

### 4.14 App Pages
Accessed via bottom icon bar on left sidebar:

| Page | Purpose |
|---|---|
| Home | Favorites + recents launchpad |
| Settings | Theme, font, density, startup, window behavior |
| Group & Card Manager | Bulk organize groups and cards |
| Import / Export | Backup, restore, share config |
| Keyboard Shortcuts | Reference all shortcuts |
| About | Version, credits, update check |

---

## 5. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | **Electron** (latest stable) | Cross-process, native OS integration |
| Build tool | **Vite** | Lightning fast dev + build, minimal config |
| UI framework | **React 18** | Component-driven, ideal for dynamic card/group UI |
| Styling | **Tailwind CSS** | Utility-first, no heavy CSS framework |
| Database | **SQLite via better-sqlite3** | Fast, synchronous, crash-safe, queryable |
| Search | **fuse.js** | Lightweight fuzzy search, zero dependencies |
| Icons (built-in) | **Lucide React** | Clean, consistent, already bundled |
| Webview | **Electron BrowserView** | Own process, non-blocking, stable |
| Zip handling | **jszip** | Export/import `.zip` bundles |
| Language | **TypeScript** | Type safety across main + renderer |

---

## 6. Explicit Non-Goals (v1)

- ❌ No cloud sync or remote config storage
- ❌ No in-app terminal emulator
- ❌ No multi-user live collaboration
- ❌ No password vault or secrets manager
- ❌ No mobile or web version
- ❌ No plugin system (v1)
- ❌ No macOS or Linux support (v1)

---

## 7. Project Conventions

- All file paths stored as **relative paths** in DB — never absolute
- Icons always resolved to local files before any network fallback
- All IPC calls validated and sanitized in main process before execution
- All DB writes trigger auto-backup
- No external network calls at runtime except: favicon fetch (on-demand, save-once) and update check (manual trigger only)
- Component naming: PascalCase React components, camelCase utilities
- File naming: kebab-case for all files and folders

---

## 8. Working App Name

**Command-Center** *(confirmed working name — rename anytime)*

---

*Next document: → `ARCHITECTURE.md`*
