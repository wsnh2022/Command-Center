# Phase 14 — Project Dashboard

**Status:** Planned · **Depends on:** Phase 13 (Polish + Performance) complete  
**Origin:** Brainstorm session 2026-03-15

---

## Problem

Groups are currently silent containers — name, icon, accent colour, and nothing else.
The app knows what you can open. It has no knowledge of what you're working on,
what state a project is in, or what you need to do next.

A developer using this as a daily driver has 6–8 groups. Each group represents a
real working domain. At any given moment some are active, some are stalled, some are
shipped. The app has no way to reflect this — you have to carry it in your head.

---

## Goal

Evolve Groups into Projects without breaking the existing launcher architecture.
The launcher stays functional. The project context layer is additive — new fields
on an existing entity, surfaced in new UI surfaces.

---

## Understanding Summary

| Question | Answer |
|---|---|
| What is being built | Project status + description + deadline fields on Groups; Home screen dashboard view |
| Why it exists | Groups already map to real working domains; the app should reflect their state |
| Who it's for | Personal daily use first; power-user open-source release second |
| Key constraint | Must not break Groups → Cards → Items launcher — additive only |
| Non-goals | Task manager, Kanban, team features, time tracking, cloud sync |

---

## What changes

### DB — Migration 005

```sql
ALTER TABLE groups ADD COLUMN status      TEXT NOT NULL DEFAULT 'active';
ALTER TABLE groups ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE groups ADD COLUMN deadline    TEXT;  -- ISO date string or NULL
```

**Status values:** `active` | `building` | `shipped` | `stalled` | `on-hold`

`active` is the default — existing groups get it automatically on migration.
`deadline` is nullable — not every group is a time-bound project.

---

## New fields on Group type

```typescript
// src/types/index.ts — additions to Group interface
export type ProjectStatus = 'active' | 'building' | 'shipped' | 'stalled' | 'on-hold'

export interface Group {
  // ... existing fields ...
  status:      ProjectStatus   // default: 'active'
  description: string          // free text, no hard limit
  deadline:    string | null   // ISO date 'YYYY-MM-DD' or null
}
```

---

## UI surfaces — three changes

### 1. Group sidebar pill — status dot

A small coloured dot on each pill indicating status.
Visible at a glance without clicking anything.

| Status | Dot colour |
|---|---|
| `active` | accent colour (group's own) |
| `building` | amber |
| `shipped` | green |
| `stalled` | red |
| `on-hold` | surface-4 (grey, muted) |

Location: left of the group icon, or as a small overlay badge on it.
Size: 6×6px. Not a label — just a colour signal.


### 2. GroupPage header — project context block

When you click into a group, the page header expands to show:

```
[ Group icon ] [ Group name ]   [ Status badge ]   [ Deadline chip ]
[ Description text — up to ~3 lines, expand toggle if longer ]
```

- Status badge: coloured pill with label — "Building", "Shipped", etc.
- Deadline chip: only shown if set — "Due Mar 28" or "Overdue 3d"
- Description: rendered below the header, collapsed to 2 lines by default
- Edit pencil icon on the header row opens an inline edit panel for all three fields

The card grid below is unchanged — this is a header-only addition.

---

### 3. Home screen — project dashboard section

The Home screen currently has two columns: Favorites and Recently Used.

Phase 14 adds a third section below those columns: **Projects**.

Each project card shows:
- Group icon + name
- Status badge
- Description (first line only, truncated)
- Deadline chip (if set)
- "Last active" — derived from the most recent launch of any item in this group

Click → navigates to that group's launcher view.

**Layout:** Grid of project cards, 2 or 3 columns depending on window width.
Only groups with `status !== 'active'` OR groups with a description/deadline set
are shown here — empty default groups stay out of the dashboard view.

---

## AddGroupModal — edit mode additions

The existing `AddGroupModal` already handles name, icon, and colour in edit mode.
Phase 14 adds three new fields to the modal:

- **Status** — segmented control: Active / Building / Shipped / Stalled / On Hold
- **Description** — textarea, placeholder "What is this project? What's next?"
- **Deadline** — date input, optional, clearable

These fields only appear in **edit mode** (not create mode — a brand new group
doesn't need a status or deadline on creation).

---

## IPC changes

### `groups:update` — extend `UpdateGroupInput`

```typescript
export interface UpdateGroupInput extends Partial<CreateGroupInput> {
  id:          string
  sortOrder?:  number
  status?:     ProjectStatus    // new
  description?: string          // new
  deadline?:   string | null    // new
}
```

No new IPC channels needed — `groups:update` already exists and handles partial
updates via `COALESCE`. Add the three new columns to the UPDATE query.

---

## Migration strategy

Migration 005 is additive-only:
- Three `ALTER TABLE` statements — no data loss
- All existing groups get `status = 'active'`, `description = ''`, `deadline = NULL`
- Idempotent — guarded by try/catch like all prior migrations
- Runs automatically on next app launch

---

## Files to change

| File | Change |
|---|---|
| `electron/db/migrations/005_project_dashboard.ts` | New migration — 3 ALTER TABLE |
| `electron/db/database.ts` | Import + run migration005 |
| `electron/db/queries/groups.queries.ts` | Add status/description/deadline to rowToGroup, INSERT, UPDATE |
| `electron/ipc/groups.ipc.ts` | Sanitize new fields in groups:create and groups:update |
| `src/types/index.ts` | Add ProjectStatus type + new fields to Group and UpdateGroupInput |
| `src/components/groups/AddGroupModal.tsx` | Add status/description/deadline fields in edit mode |
| `src/components/groups/GroupPillList.tsx` | Add status dot to each pill |
| `src/pages/GroupPage.tsx` | Add project context block to page header |
| `src/pages/HomePage.tsx` | Add Projects dashboard section below Favorites/Recents |

---

## Explicit non-goals

- No subtasks, assignments, or Kanban columns
- No time tracking or time logging
- No reminders or notifications for deadlines (display only)
- No team or sharing features
- No cloud sync — local SQLite only
- No separate Project entity — Groups grow new fields, not replaced

---

## Decision log

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Groups grow new fields (not a new Project entity) | Separate projects table with Group→Project FK | Groups already map 1:1 to working domains; a separate entity adds complexity for zero functional gain |
| Status default is `active` not `building` | `building`, `none` | `active` is neutral — works for non-project groups like Bookmarks without implying work-in-progress |
| Deadline is nullable TEXT not INTEGER timestamp | Required field, Unix timestamp | Optional dates are common in real use; TEXT ISO format is human-readable in DB and trivially comparable |
| Dashboard section on Home screen only (not a new page) | New Projects page in sidebar | Home screen already has the "overview" role; adding a new page increases nav surface area unnecessarily |
| Edit modal additions, not a separate Project form | New ProjectPage with full form | AddGroupModal already handles the edit flow; extending it is the minimal, consistent path |
