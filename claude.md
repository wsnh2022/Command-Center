# CLAUDE.md — Command-Center

Agentic coding context. Read this before generating any code for this project.

---

## What is being built

Command-Center — a personal Windows desktop control center.
Electron + Vite + React 18 + TypeScript + Tailwind CSS + SQLite (better-sqlite3).

Full spec lives in `/docs/`. Read those before implementing anything new.

---

## Current phase

Check PROGRESS.md → last shipped line → that determines current phase.

---

## Non-negotiable rules

- Renderer never imports Node.js modules directly. All DB/FS access goes through IPC.
- All IPC channels follow the `domain:action` naming in `ARCHITECTURE.md §4`.
- All inputs in IPC handlers must be sanitized via `electron/utils/sanitize.ts` before use.
- Every DB write must trigger `backup.service.autoBackup()`.
- Icons always resolve to a local file path. Never load from network at runtime.
- No absolute paths stored in DB — relative paths only.
- TypeScript strict mode is on. No `any` unless explicitly justified in a comment.
- Never regenerate entire files. Modify only what the current task requires.

---

## File creation order (Phase 1+)

Follow the order in `IMPLEMENTATION_PLAN.md §5`. Do not skip ahead.

---

## Stack decisions already locked

- SQLite over JSON — queryable, crash-safe, FTS5 support
- BrowserView over `<webview>` tag — own process, non-blocking
- fuse.js + FTS5 dual search — fuse handles labels/tags, FTS5 handles note body
- State-based routing — no react-router (single-window app, zero dependency)
- @dnd-kit — drag-and-drop (actively maintained, accessible)
- Native window frame v1 — custom titlebar is a v2 decision
- Auto-backup on every write — never lose more than one operation

Do not relitigate these. They are final for v1.

---

## Design tokens

All CSS variables defined in `src/index.css`. All design values from `UI_DESIGN_SPEC.md`.
Use Tailwind utility classes from `tailwind.config.ts`. No hardcoded hex values in components.

---

## What NOT to do

- Do not add dependencies not in package.json without flagging it first.
- Do not create placeholder/TODO components that don't do what they say.
- Do not use `console.log` for debug output — use structured comments flagged for removal.
- Do not optimistically update state before IPC confirms — correctness over speed (v1 rule).
- Do not add features not in the spec — YAGNI ruthlessly.
