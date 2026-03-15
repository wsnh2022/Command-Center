# IMPLEMENTATION_PLAN.md
# Command-Center — Implementation Plan

> **Version:** 0.1.0-beta  
> **Last Updated:** 2026-03-15  
> **Status:** Complete — all 13 phases shipped  

---

## 1. Guiding Principles

| Principle | Rule |
|---|---|
| **Foundation first** | No UI before DB + IPC works |
| **One feature complete** | Finish a feature end-to-end before starting the next |
| **No orphaned code** | Every file written serves a confirmed spec decision |
| **Test as you build** | Verify each phase before advancing |
| **YAGNI ruthlessly** | If it's not in the spec, it doesn't get built in v1 |

---

## 2. Phase Overview

```
Phase 0 — Project Scaffolding          (foundation)
Phase 1 — Database + IPC Core          (data layer)
Phase 2 — App Shell + Navigation       (layout skeleton)
Phase 3 — Groups & Cards               (core structure)
Phase 4 — Items + Launch System        (core functionality)
Phase 5 — Home Screen                  (favorites + recents)
Phase 6 — Search                       (fuzzy + FTS5)
Phase 7 — Webview Panel                (BrowserView)
Phase 8 — Icon System                  (full icon pipeline)
Phase 9 — Settings + Theming           (visual customization)
Phase 10 — Backup + Export/Import      (data safety)
Phase 11 — System Integration          (tray, startup, shortcuts)
Phase 12 — Group & Card Manager        (bulk operations)
Phase 13 — Polish + Performance        (final hardening)
```

---

## 3. Phase Detail

---

### Phase 0 — Project Scaffolding

**Goal:** Working Electron + Vite + React + TypeScript skeleton that opens a window.

**Tasks:**
- [ ] Initialize project with `electron-vite` template
- [ ] Configure TypeScript (strict mode, path aliases)
- [ ] Install core dependencies:
  - `better-sqlite3` + `@types/better-sqlite3`
  - `react` + `react-dom` + `@types/react`
  - `tailwindcss` + `autoprefixer`
  - `lucide-react`
  - `fuse.js`
  - `jszip`
  - `uuid` + `@types/uuid`
- [ ] Configure Tailwind with design tokens from `UI_DESIGN_SPEC.md`
- [ ] Set up Inter + JetBrains Mono fonts (local, bundled)
- [ ] Verify: `npm run dev` opens Electron window with React app

**Completion check:** Window opens, React renders, Tailwind classes work, TypeScript compiles clean.

---

### Phase 1 — Database + IPC Core

**Goal:** SQLite database initializes, all tables exist, IPC channels are registered and callable from renderer.

**Tasks:**
- [ ] Implement `electron/db/database.ts` — connection, WAL mode, foreign keys on
- [ ] Implement migration runner + `001_initial.ts` — all tables from `DATABASE_SCHEMA.md`
- [ ] Implement FTS5 virtual table + sync triggers
- [ ] Implement all query files (`groups.queries.ts`, `cards.queries.ts`, etc.)
- [ ] Implement `electron/preload.ts` — `contextBridge` exposing `window.api`
- [ ] Register all IPC handlers (all channels from `ARCHITECTURE.md §4`)
- [ ] Implement `electron/utils/sanitize.ts` — validate all IPC inputs
- [ ] Implement `electron/utils/paths.ts` — all `%APPDATA%` path constants
- [ ] Seed default settings row on first run
- [ ] Implement `src/utils/ipc.ts` — typed wrapper functions for all channels

**Completion check:** Can call `window.api.groups.getAll()` from browser console and get `[]`. DB file exists at correct path.

---

### Phase 2 — App Shell + Navigation

**Goal:** Full layout renders. Sidebar, TopBar, and main area visible. Page routing works.

**Tasks:**
- [ ] Implement `AppShell.tsx` — sidebar + topbar + main layout (CSS Grid)
- [ ] Implement `Sidebar.tsx` — static group list area + page icon bar
- [ ] Implement `TopBar.tsx` — search bar placeholder + window controls
- [ ] Implement `App.tsx` — page router (state-based, no react-router needed)
- [ ] Implement stub pages: `HomePage`, `GroupPage`, `SettingsPage`, `AboutPage`, `ShortcutsPage`, `ImportExportPage`, `GroupManagerPage`
- [ ] Implement `ThemeContext.tsx` — dark/light toggle, CSS variable injection
- [ ] Implement `SettingsContext.tsx` — global settings state
- [ ] Apply dark theme by default, verify all surfaces render correctly
- [ ] Window: set min size 900×600, default 1280×800, centered
- [ ] Implement responsive column collapse (`auto-fill` card grid CSS)

**Completion check:** App renders full layout. Clicking page icons navigates between stubs. Dark/light toggle works.

---

### Phase 3 — Groups & Cards

**Goal:** Groups and cards fully functional — create, rename, reorder, delete, color.

**Tasks:**
- [ ] Implement `useGroups.ts` hook — load, create, update, delete, reorder
- [ ] Implement `GroupPill.tsx` — all states (default, hover, active, dragging)
- [ ] Implement `GroupPillList.tsx` — drag-reorder (use `@dnd-kit/core`)
- [ ] Implement `AddGroupModal.tsx` — name + icon + accent color picker
- [ ] Implement `ColorPicker.tsx` — 12 presets + custom hex input
- [ ] Wire sidebar groups to DB via IPC
- [ ] Implement `useCards.ts` hook — load, create, update, delete, reorder
- [ ] Implement `CardGrid.tsx` — 4-col responsive grid
- [ ] Implement `Card.tsx` — full card component with header + item list area
- [ ] Implement `CardHeader.tsx` — icon + renamable title + `[⋮]` menu
- [ ] Implement `AddCardButton.tsx`
- [ ] Wire cards to DB via IPC
- [ ] Apply accent color as CSS variable per group — card left border reflects it

**Completion check:** Can create groups, rename them, reorder by drag, assign colors. Cards appear in grid, can be added, renamed, deleted.

---

### Phase 4 — Items + Launch System

**Goal:** Items fully functional inside cards. Every item type launches correctly.

**Pre-requisite — run DB migration 002 first:**
- Create `electron/db/migrations/002_item_type_refactor.ts`
- Adds: `command_args`, `working_dir`, `action_id` columns to `items`
- Renames legacy values: `exe→software`, `script→command`, `ssh→action`
- Update migration runner to apply 002 after 001

**Type system updates before any UI work:**
- `src/types/index.ts` — `ItemType = 'url' | 'software' | 'folder' | 'command' | 'action'`
- Add `ActionId` type (all 29 predefined action keys + 'custom')
- Add `commandArgs`, `workingDir`, `actionId` fields to `Item` interface + input types
- `electron/utils/sanitize.ts` — update `sanitizeItemType` to accept new values

**Tasks:**
- [ ] Write migration `002_item_type_refactor.ts`
- [ ] Update `src/types/index.ts` — new ItemType, ActionId, Item fields
- [ ] Update `electron/utils/sanitize.ts` — sanitizeItemType new values
- [ ] Update `electron/db/queries/items.queries.ts` — include new columns in all INSERT/SELECT
- [ ] Implement `useItems.ts` hook
- [ ] Implement `ItemList.tsx` — flat file-manager list
- [ ] Implement `ItemRow.tsx` — icon, label, path preview, hover info button
- [ ] Implement `ItemNoteDropdown.tsx` — tags + 450-word note expand/collapse
- [ ] Implement `ItemContextMenu.tsx` — all 5 context menu actions
- [ ] Implement `ItemFormPanel.tsx` — slide-in panel, type-aware fields:
  - URL: label + url field
  - Software: label + path + Browse (.exe/.bat filter)
  - Folder: label + path + Browse (folder picker)
  - Command: label + command field + arguments field + working dir field + Browse
  - Action: label + action grid (29 predefined buttons + icons + custom option)
- [ ] Implement `AddItemButton.tsx`
- [ ] Implement bulk select mode — checkbox on hover, floating action bar
- [ ] Implement `electron/services/launch.service.ts`:
  - `url` → webview IPC or `shell.openExternal`
  - `software` / `folder` → `shell.openPath`
  - `command` → `child_process.spawn(path, parseArgs(commandArgs), { cwd: workingDir })`
  - `action` → dispatch by `action_id` (lock screen, sleep, etc. via PowerShell/Win32 API)
- [ ] Implement `items:launch` IPC handler — routes by type, records recent
- [ ] Implement `recents:record` — upsert + trim to 20
- [ ] Wire all item CRUD + launch to IPC

**Bug fixes from Phase 2/3 (fix in this phase):**
- [ ] `TopBar.tsx` — replace `<span>Search everything...</span>` with real `<input type="text" />`
- [ ] `GroupPillList.tsx` / `GroupPill` — add right-click context menu (Rename / Edit Color / Delete)
  wired to open `AddGroupModal` in edit mode. Also wire `onEditGroup` + `onDeleteGroup` callbacks.

**Completion check:** Can add items of all 5 types. Command type spawns terminal correctly.
Action type executes predefined Windows actions. Search bar is typeable. Group pills are right-click editable.

---

### Phase 5 — Home Screen

**Goal:** Home screen shows favorites (left) and recents (right), both functional.

**Tasks:**
- [ ] Implement `HomePage.tsx` — two-column layout
- [ ] Implement `useRecents.ts` — fetch last 20 with item data
- [ ] Implement recents list with relative timestamps (`2m ago`, `1h ago`)
- [ ] Implement favorites — pin item via right-click context menu option
- [ ] Implement favorites drag-reorder
- [ ] Implement `favorites:pin` + `favorites:unpin` IPC handlers
- [ ] Home screen items are launchable (same launch service)
- [ ] Navigate to home screen on app startup

**Completion check:** Home screen shows pinned favorites + auto-updated recents. Items launch from home screen. Favorites reorderable.

---

### Phase 6 — Search

**Goal:** Global fuzzy search works across all content, results grouped and navigable.

**Tasks:**
- [ ] Implement `search:getIndex` IPC — returns full `SearchIndexEntry[]`
- [ ] Implement `useSearch.ts` — loads index on mount, refreshes on data change
- [ ] Configure `fuse.js` — keys: label (weight 3), tags (weight 2), path (weight 1)
- [ ] Implement `SearchBar.tsx` — always visible, focus on click
- [ ] Implement `SearchResults.tsx` — grouped dropdown, match highlighting
- [ ] Wire FTS5 query for note body search — merge results with fuse results
- [ ] Debounce input 150ms
- [ ] Keyboard: ↑↓ navigate results, Enter launches, Escape closes
- [ ] Clicking result: navigates to group + card, highlights item

**Completion check:** Typing in search bar returns results from labels, paths, tags, and note content across all groups. Results grouped, highlighted, launchable.

---

### Phase 7 — Webview Panel

**Goal:** BrowserView opens on demand, resizable, with nav controls and eject button.

**Tasks:**
- [ ] Implement `electron/ipc/webview.ipc.ts` — all webview IPC handlers
- [ ] Implement BrowserView creation + attachment in `main.ts`
- [ ] Implement resize logic — renderer sends panel width → main repositions BrowserView bounds
- [ ] Implement `WebviewPanel.tsx` — header bar + drag handle
- [ ] Implement nav controls (back, forward, reload) wired to IPC
- [ ] Implement URL display — updated via `webview:urlChanged` push event
- [ ] Implement eject button → `system:openExternal` with current URL
- [ ] Implement close button → hide BrowserView, restore full card grid
- [ ] Wire `items:launch` for URL type → open in webview by default

**Completion check:** Clicking a URL item opens BrowserView alongside card grid. Nav controls work. Panel resizes by dragging. Eject opens in browser. Close dismisses panel.

---

### Phase 8 — Icon System

**Goal:** Full icon resolution pipeline working. All 5 input methods save correctly. Fallback chain never shows broken icon.

**Tasks:**
- [ ] Implement `electron/services/icon.service.ts`:
  - `resolveIcon(localPath)` — check file exists + valid, else fallback chain
  - `fetchFavicon(url)` — Google Favicons API → save to `assets/favicons/`
  - `saveCustomIcon(source, type)` — handle all 5 input types → normalize to local file
  - `getGenericIcon(itemType)` — returns type-based Lucide icon name
- [ ] Implement `icon_cache` table queries
- [ ] Implement `IconPicker.tsx` — all 6 tabs (Auto, Emoji, Library, Upload, URL, Base64)
- [ ] Bundle Lucide icon set as JSON manifest for library tab search
- [ ] Wire icon resolution to `ItemRow.tsx` — always uses resolved local path
- [ ] Handle broken/missing icon gracefully — silent fallback, no broken image flash

**Completion check:** All 5 icon input methods save correctly. Icons display in items. Deleting icon file triggers graceful fallback. Favicon auto-fetches and caches on URL item save.

---

### Phase 9 — Settings + Theming

**Goal:** All settings functional. Theme, font size, density changes apply instantly app-wide.

**Tasks:**
- [ ] Implement `SettingsPage.tsx` — all setting controls
- [ ] Implement theme toggle — injects `data-theme` on `<html>`
- [ ] Implement font size control — injects `data-font-size` on `<html>`
- [ ] Implement density toggle — injects `data-density` on `<html>`
- [ ] Implement per-group accent color application — CSS var on group container
- [ ] Implement `settings:get` + `settings:update` IPC fully
- [ ] Implement `useSettings.ts` — loads on mount, persists on change
- [ ] Implement Windows startup toggle — `app.setLoginItemSettings`
- [ ] Implement minimize-to-tray setting

**Completion check:** All settings persist across restarts. Theme, font, density change instantly without reload. Group accent colors render correctly per group.

---

### Phase 10 — Backup + Export/Import

**Goal:** Auto-backup runs on every write. Export produces clean ZIP. Import restores fully.

**Tasks:**
- [ ] Implement `electron/services/backup.service.ts`:
  - `autoBackup()` — copy `.db` to `/backups/`, trim to 10 snapshots
  - Call `autoBackup()` after every DB write operation
- [ ] Implement `electron/services/export.service.ts`:
  - Bundle `command-center.db` → `config.json` export
  - Bundle `assets/` folder
  - Produce `command-center-export-{date}.zip` via `jszip`
- [ ] Implement `electron/services/import.service.ts`:
  - Accept `.zip` — extract, apply conflict resolution
  - Accept `.json` — config only, re-fetch missing icons
- [ ] Implement `ImportExportPage.tsx` — export button + import file picker
- [ ] Implement `backup:listSnapshots` + `backup:restoreSnapshot` IPC
- [ ] Show snapshot list in Import/Export page — restore any snapshot

**Completion check:** Every data change triggers backup file. Export ZIP contains all data + icons. Import from ZIP fully restores. Snapshot list visible and restorable.

---

### Phase 11 — System Integration

**Goal:** Tray, auto-startup, and keyboard shortcuts all working.

**Tasks:**
- [ ] Implement system tray in `main.ts` — icon + all menu items
- [ ] Implement tray Quick Launch submenu — queries last 5 recents
- [ ] Implement tray Global Search — focuses window + search bar
- [ ] Implement window show/hide on tray click + minimize-to-tray on close
- [ ] Implement auto-startup via `app.setLoginItemSettings`
- [ ] Implement global keyboard shortcuts (Electron `globalShortcut`):
  - `Ctrl+F` — focus search bar
  - `Ctrl+H` — go to home screen
  - `Escape` — close modal / panel / search
  - `Ctrl+,` — open settings
- [ ] Implement `ShortcutsPage.tsx` — reference table of all shortcuts

**Completion check:** App in tray after window close. Tray menu items all work. Auto-starts with Windows. Keyboard shortcuts functional.

---

### Phase 12 — Group & Card Manager

**Goal:** Bulk management page fully functional.

**Tasks:**
- [ ] Implement `GroupManagerPage.tsx` — table view of all groups + cards
- [ ] Implement bulk select (checkboxes) for groups and cards
- [ ] Implement bulk actions: rename, recolor, reorder, delete
- [ ] Implement bulk item selection + move within cards
- [ ] Implement drag-reorder within manager page

**Completion check:** Can bulk select and delete multiple groups. Can reorder groups and cards from manager. Bulk move items between cards works.

---

### Phase 13 — Polish + Performance

**Goal:** App feels native, fast, and complete. No rough edges.

**Tasks:**
- [ ] Audit all transitions — verify ≤ 150ms rule everywhere
- [ ] Audit all icon states — no broken images anywhere
- [ ] Audit all empty states — every list/grid has a helpful empty state message
- [ ] Verify cold launch < 2 seconds (profile with Chrome DevTools)
- [ ] Verify DB queries — add missing indexes if any queries are slow
- [ ] Verify memory usage — no leaks from BrowserView or event listeners
- [ ] Verify window resize — all layouts reflow cleanly at 900px minimum
- [ ] Implement `AboutPage.tsx` — version, build date, credits
- [ ] Implement update check (tray menu → opens releases page in browser)
- [ ] Final accessibility audit — focus rings, aria labels, tab order
- [ ] Build for Windows (`electron-builder`) — verify installer works
- [ ] Test auto-startup, tray, backup on clean Windows install

**Completion check:** Clean install → app starts < 2s → all features work → backup file created → export/import round-trips cleanly.

---

## 4. Dependency Install Reference

```bash
# Core
npm install electron electron-vite vite react react-dom
npm install -D typescript @types/react @types/react-dom

# Database
npm install better-sqlite3
npm install -D @types/better-sqlite3

# Styling
npm install tailwindcss autoprefixer
npm install lucide-react

# Search
npm install fuse.js

# Drag and drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Utilities
npm install uuid jszip
npm install -D @types/uuid

# Build
npm install -D electron-builder
```

---

## 5. File Creation Order

Follow this strict order — each file depends on the ones before it:

```
1.  electron/utils/paths.ts
2.  electron/utils/sanitize.ts
3.  electron/db/database.ts
4.  electron/db/migrations/001_initial.ts
5.  electron/db/queries/*.ts           (all query files)
6.  src/types/index.ts
7.  electron/preload.ts
8.  electron/ipc/*.ipc.ts              (all IPC handlers)
9.  electron/main.ts
10. src/utils/ipc.ts
11. src/context/ThemeContext.tsx
12. src/context/SettingsContext.tsx
13. src/components/layout/AppShell.tsx
14. src/components/layout/Sidebar.tsx
15. src/components/layout/TopBar.tsx
16. src/App.tsx + stub pages
17. [Phase 3 onwards — feature by feature]
```

---

## 6. Decision Log

| # | Decision | Alternatives Considered | Reason |
|---|---|---|---|
| 1 | SQLite over JSON | JSON flat file | Queryable, crash-safe, supports FTS5 search |
| 2 | BrowserView over `<webview>` | `<webview>` tag | Own process, non-blocking, more stable |
| 3 | fuse.js + FTS5 dual search | fuse.js only | fuse.js handles labels/tags; FTS5 handles long note body search |
| 4 | State-based routing over react-router | react-router, TanStack Router | Zero dependency, simpler for single-window app |
| 5 | @dnd-kit over react-beautiful-dnd | react-beautiful-dnd | Actively maintained, accessible, no deprecated deps |
| 6 | Native window frame (v1) | Custom frameless titlebar | Simpler, faster to implement, revisit in v2 |
| 7 | Icons normalized to local files at save-time | Resolve at render-time | Zero runtime overhead, consistent load path |
| 8 | Auto-backup on every write | Scheduled interval backup | Never lose more than one operation of data |
| 9 | ZIP export bundle | JSON-only export | Icons travel with config, portable across machines |
| 10 | Unlimited groups | Cap at 8 | User requested expandability, no technical reason to cap |

---

*All 5 core documents complete. See also: `ICON_SYSTEM.md` and `DATA_FLOW.md`*
