# RESUME.md — Command-Center

> Last updated: 2026-03-15 · Phase 13 COMPLETE · Session 30: UI polish, colour contrast fix, sidebar redesign, home icon fix, build pipeline fixes, docs overhaul · Phase 14 (Project Dashboard) PLANNED · Phase 15a (Drag Reorder + Cross-Card) PLANNED NEXT · Version 0.1.0-beta


---

## Project identity

- **Name:** Command-Center
- **Type:** Electron desktop app for Windows
- **Stack:** Electron + Vite + React 18 + TypeScript + Tailwind CSS + SQLite (better-sqlite3)
- **Owner:** Yoghesh (wsnh2022)
- **Project root:** `C:\dev\Command_Center_Project_Assets\`
- **Spec documents:** `C:\dev\Command_Center_Project_Assets\docs\`

---

## Spec documents (read before implementing anything)

| File | Purpose |
|---|---|
| `docs/PROJECT_OVERVIEW.md` | Vision, features, tech stack, conventions |
| `docs/ARCHITECTURE.md` | Process model, folder structure, IPC channel map |
| `docs/DATABASE_SCHEMA.md` | All tables, indexes, FTS5, TypeScript interfaces |
| `docs/DATA_FLOW.md` | Every data operation traced end-to-end |
| `docs/UI_DESIGN_SPEC.md` | Design tokens, layout specs, component specs |
| `docs/ICON_SYSTEM.md` | Icon pipeline, 5 input methods, resolution hierarchy |
| `docs/IMPLEMENTATION_PLAN.md` | Phase-by-phase task lists, file creation order |
| `docs/PHASE_14_PROJECT_DASHBOARD.md` | Phase 14 full spec — Groups as Projects |
| `claude.md` | Agentic coding rules — non-negotiable constraints |


---

## Skills to load per session

Always load `wsnh` first — it carries personal context that overrides generic defaults.

| Skill | SKILL.md path | Purpose |
|---|---|---|
| `wsnh` | `/mnt/skills/user/wsnh/SKILL.md` | Personal context — load **first** every session |
| `electron-app` | `/mnt/skills/user/electron-app/SKILL.md` | IPC, BrowserWindow, packaging |
| `frontend-design` | `/mnt/skills/public/frontend-design/SKILL.md` | Component design, Tailwind, UI quality |
| `software-architecture` | `/mnt/skills/user/software-architecture/SKILL.md` | Service layer — Phase 10 + Phase 13 only |

> **Conflict rule:** `electron-app` governs process architecture and IPC. `frontend-design` governs visual execution.

---

## Environment status

| Item | Status |
|---|---|
| Node.js | v22.22.0 |
| OS | Windows 11 (Windows_NT 10.0.26200) |
| VS Build Tools 2026 (18.3.2) | INSTALLED + patched `find-visualstudio.js` for v18 + MSVC v143 |
| npm install | COMPLETE — `better-sqlite3` compiled |
| npm run dev | VERIFIED — window opens, full app renders |
| npm run dist | VERIFIED — `release/Command-Center Setup 0.1.0-beta.exe` produced |

> ⚠️ On clean `npm install`, re-patch `node_modules/@electron/node-gyp/lib/find-visualstudio.js` (3 changes for versionYear 2026 + toolset v143). See PROGRESS.md Session 1 for exact patch steps.


---

## Phase tracker

| Phase | Name | Status | Skills | Completion check |
|---|---|---|---|---|
| 0 | Project Scaffolding | **COMPLETE** | `electron-app` | Window opens, React renders, Tailwind works, TS compiles |
| 1 | Database + IPC Core | **COMPLETE** | `electron-app` | `window.api.groups.getAll()` returns `[]`, DB file exists |
| 2 | App Shell + Navigation | **COMPLETE** | `electron-app` · `frontend-design` | Full layout renders, routing works, dark/light toggle works |
| 3 | Groups & Cards | **COMPLETE** | `electron-app` · `frontend-design` | Create/rename/reorder/delete groups + cards fully functional |
| 4 | Items + Launch System | **COMPLETE** | `electron-app` · `frontend-design` | All 5 item types add and launch correctly |
| 5 | Home Screen | **COMPLETE** | `electron-app` · `frontend-design` | HomePage + useRecents + FavoritesContext + IPC all wired |
| 6 | Search | **COMPLETE** | `electron-app` · `frontend-design` | useSearch + SearchResults + TopBar — fuzzy + FTS5 |
| 7 | Webview Panel | **COMPLETE** | `electron-app` · `frontend-design` | BrowserView opens on URL launch, nav + drag resize + eject |
| 8 | Icon System | **COMPLETE** | `electron-app` · `frontend-design` | 6 input methods, command-center-asset:// protocol, all bugs fixed |
| 9 | Settings + Theming | **COMPLETE** | `frontend-design` · `electron-app` | SettingsPage wired, Direction-A theme polish shipped |
| 9.5 | Icon Colour | **COMPLETE** | `frontend-design` · `electron-app` | migration 003, icon_color in DB/IPC/types/UI |
| 10 | Backup + Export/Import | **COMPLETE** | `electron-app` · `software-architecture` | VACUUM INTO export, clean import, no race condition |
| 11 | System Integration | **COMPLETE** | `electron-app` · `frontend-design` | Tray + global shortcut + ShortcutsPage all wired |
| 12 | Group & Card Manager | **COMPLETE** | `frontend-design` · `electron-app` | Bulk ops, BulkActionBar, ConfirmDialog, drag-reorder |
| 13 | Polish + Performance | **COMPLETE** | `electron-app` · `frontend-design` | UI typography pass (all 5 pages), colour contrast fix, sidebar redesign, home icon pipeline fix, build pipeline fixes, tray prod fix, taskbar icon fix, docs rewrite. v0.1.0-beta shipped. |
| 14 | Project Dashboard | **PLANNED** | `electron-app` · `frontend-design` | Groups get `status`/`description`/`deadline` · Home screen project section · See `docs/PHASE_14_PROJECT_DASHBOARD.md` |
| 15a | Drag Reorder + Cross-Card | **PLANNED NEXT** | `electron-app` · `frontend-design` | Drag to reorder within card · drag across cards in same group · @dnd-kit multi-container · DndContext lifted to CardGrid |
| 15b | Cross-Group Drag | **DEFERRED** | `electron-app` · `frontend-design` | Hover-to-navigate sidebar while dragging · global drag context above router · architectural change |


---

## Phase 15a — Drag Reorder + Cross-Card (PLANNED NEXT)

### Scope

| Behaviour | Mechanism |
|---|---|
| Reorder items within same card | Drag up/down, drop to new position, sort_order persisted |
| Move item to another card (same group) | Drag from card A, drop onto card B |

### Not in scope (Phase 15b)
- Cross-group drag via sidebar hover-to-navigate

### Files to change

| File | Change |
|---|---|
| `src/components/items/ItemRow.tsx` | Add `GripVertical` drag handle, visible on hover |
| `src/components/items/ItemList.tsx` | Wrap items in `SortableContext`, pass drag props |
| `src/components/cards/Card.tsx` | Register as `useDroppable` container |
| `src/components/cards/CardGrid.tsx` | Lift `DndContext` here — single context for all cards in group · `handleDragEnd` routes reorder vs cross-card move |
| `electron/db/queries/items.queries.ts` | Add `reorderItems(db, cardId, orderedIds[])` query |
| `electron/ipc/items.ipc.ts` | Add `items:reorder` handler |
| `electron/preload.ts` | Expose `items.reorder` |
| `src/utils/ipc.ts` | Typed wrapper for `items.reorder` |

### Key decisions
- Drag activation distance: 6px (matches group pill drag — prevents accidental drags on click)
- Drag handle: `GripVertical` icon on each item row, `opacity-0 group-hover:opacity-100`
- Cross-card drop: item removed from source card state immediately, target card refetches
- Sort order persisted to DB on `dragEnd` — same pattern as group reorder in `GroupPillList`
- Right-click Move to Card menu kept as fallback (cross-group case)

---

## Phase 15b — Cross-Group Drag (DEFERRED)

### Why deferred
Dragged item is owned by `useItems` inside a card. When the app navigates to a new group, `GroupPage` unmounts — destroying the drag context. `@dnd-kit` does not survive a component tree unmount mid-drag.

### What it requires (future session)
- Global drag context lifted above router in `App.tsx`
- Dragged item stored in global state (not inside `useItems`)
- Hover-to-navigate timer on sidebar group pills (~500ms dwell)
- Newly navigated group's cards register as drop targets before drag ends
- Drop handled at `App` level → `ipc.items.move` → refresh both groups

### Files it will touch
`App.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `GroupPillList.tsx`, `GroupPage.tsx`, `CardGrid.tsx`, `Card.tsx`, `useItems.ts`

---

## Key decisions (locked for v1)

| # | Decision |
|---|---|
| 1 | SQLite over JSON flat file |
| 2 | BrowserView over `<webview>` tag |
| 3 | fuse.js + FTS5 dual search |
| 4 | State-based routing — no react-router |
| 5 | @dnd-kit for drag-and-drop |
| 6 | Frameless window — custom drag region in TopBar |
| 7 | Icons normalized to local files at save-time |
| 8 | Auto-backup on every write |
| 9 | ZIP export bundles icons + DB |
| 10 | Unlimited groups (no cap) |
| 11 | Groups ARE Projects — additive fields, not a separate entity (Phase 14) |
| 12 | Phase 15b deferred — cross-group drag must not destabilise Phase 15a |

---

## Invariants

- Renderer never imports Node.js modules directly — all DB/FS through IPC
- All IPC inputs sanitized via `electron/utils/sanitize.ts` before execution
- Every DB write triggers `backup.service.autoBackup()`
- All paths stored as relative in DB — never absolute
- TypeScript strict mode — no `any` without justified comment
- No features outside spec — YAGNI
- Modify only what the current task requires — never regenerate entire files

---

## IPC channels wired (as of Phase 13)

| Channel | Handler file | Status |
|---|---|---|
| `groups:getAll/create/update/delete/reorder` | groups.ipc.ts | ✓ |
| `cards:getByGroup/create/update/delete/reorder` | cards.ipc.ts | ✓ |
| `items:getByCard/getAll/create/update/delete/move/launch` | items.ipc.ts | ✓ |
| `items:reorder` | items.ipc.ts | ⏳ Phase 15a |
| `search:getIndex/fullText` | items.ipc.ts | ✓ |
| `recents:get/record` | recents.ipc.ts | ✓ |
| `favorites:getAll/pin/unpin/reorder` | favorites.ipc.ts | ✓ |
| `settings:get/update` | settings.ipc.ts | ✓ |
| `system:openExternal/openPath/revealInExplorer/copyToClipboard/showOpenDialog/showSaveDialog` | system.ipc.ts | ✓ |
| `webview:open/navigate/back/forward/reload/close/eject/resize` | webview.ipc.ts | ✓ |
| `webview:urlChanged/opened/closed` (push M→R) | webview.ipc.ts | ✓ |
| `backup:export/import/listSnapshots/restoreSnapshot/importComplete` (push M→R) | backup.ipc.ts | ✓ |
| `icons:resolve/saveUpload/saveUrl/saveBase64/previewUrl/previewLocal/fetchFavicon` | icons.ipc.ts | ✓ |
| `shortcuts:get/set/reset` | shortcuts.ipc.ts | ✓ |
| `window:minimize/maximize/close` | system.ipc.ts | ✓ |


---

## Memory leak audit (Phase 13 — COMPLETE)

**Renderer IPC listeners** (`useWebview.ts`, `FavoritesContext.tsx`, `ImportExportPage.tsx`) — all `ipc.on(...)` calls have matching `ipc.off(...)` in cleanup returns.

**BrowserView event listeners** — `webview.ipc.ts` had anonymous lambdas for `did-navigate` / `did-navigate-in-page` that could not be removed. Fixed: extracted to named module-scope functions. `closeWebview()` now calls `removeListener()` before nulling the view reference.

---

## Smoke test checklist (run after `npm run dist`)

- [x] Installer runs without errors
- [x] App launches, taskbar shows correct icon (not Electron default)
- [x] System tray icon appears, hide-to-tray works, Quit from tray closes cleanly
- [x] DB created at `%APPDATA%\Command-Center\command-center.db` on first launch
- [x] All 5 item types add and launch correctly
- [x] Icons (favicon, upload, library) render via `command-center-asset://`
- [x] Global shortcut `Ctrl+Shift+Space` works from another app
- [x] Export ZIP produces valid file; import replaces data
- [x] `better-sqlite3` native module loads (no "Cannot find module" crash)
- [x] `predist` script wipes `release/` cleanly on rebuild
- [ ] Phase 15a — drag reorder + cross-card drag (pending implementation)
