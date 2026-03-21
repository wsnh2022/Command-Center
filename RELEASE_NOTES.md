# Command-Center v0.1.0-beta - Release Notes

**Build:** `Command-Center 0.1.0-beta.exe` (portable, no install required)
**Platform:** Windows 10/11 x64
**Date:** 2026-03-21

---

## What is Command-Center?

A personal Windows desktop control center - one place to organize, launch, and manage all your apps, URLs, folders, commands, and shortcuts. Lives in your system tray. Zero cloud, zero tracking, everything stored locally in SQLite.

---

## Features in this release

### Dashboard
- Organize items into **Groups → Cards → Items** hierarchy
- 5 item types: URL, Software (`.exe`), Folder, Command (cmd + args + working dir), Action (29 system actions)
- Drag-to-reorder groups, cards, and items
- Inline rename everywhere - no modals for simple edits

### Home Screen
- Pinnable favorites with drag reorder
- Recently used items with relative timestamps (`2m ago`, `1h ago`, `yesterday`)
- Launch anything directly from home

### Search
- Fuzzy search across item labels, tags, paths, and note bodies (FTS5)
- Keyboard navigable results (↑↓ Enter Esc)
- Results grouped by Group → Card → Item hierarchy

### Webview Panel
- Opens URLs as an in-app side panel (BrowserView - own process, non-blocking)
- Drag-to-resize panel, back / forward / reload / eject controls
- Eject sends the current page to your default browser
- Right-click any URL item → **Open in Webview**

### Icon System
- 6 icon input methods: Auto (favicon fetch), Emoji, Lucide library (1,460 icons), Upload, URL, Base64
- Per-icon colour picker (12 presets + custom hex) for library icons
- Favicons auto-fetched and cached locally - no network calls at render time

### Settings
- Dark / Light theme
- Font size: Small / Medium / Large
- Density: Compact / Comfortable
- Webview panel position: Right / Bottom
- Hover-to-navigate mode
- Renameable sidebar header label

### System Integration
- System tray icon - close button hides to tray, double-click restores
- Global hotkey (default `Ctrl+Shift+Space`) - toggle visibility from any app
- Fully customizable shortcut with conflict detection
- Launch on Windows startup (optional)

### Group & Card Manager
- Dedicated management page - rename, reorder, delete groups and cards
- Bulk select + delete
- Expand groups inline to manage their cards
- Full icon + colour editor per group

### Backup & Export/Import
- Auto-backup on every write (`VACUUM INTO` clean snapshot)
- Export: full ZIP with DB + all icon/favicon assets
- Import: full restore - replaces DB and all assets atomically, reloads app

### Sidebar Dividers
- Insert labeled dividers between groups in the sidebar
- Right-click to rename or delete
- Persisted in DB, included in backups
- Static "Groups" header is renameable (right-click it)

---

## Known limitations (v1 scope)

- Windows only (x64)
- No multi-window support
- No cloud sync - local SQLite only
- Custom window frame is a v2 item (uses native Windows frame)
- SSH / remote action types not implemented in this release

---

## Fresh install / clean slate

Delete `%APPDATA%\Command-Center\` at any time - the app recreates everything cleanly on next launch. Use **Import/Export** to back up before doing so.
