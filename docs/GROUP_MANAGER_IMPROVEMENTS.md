# Group Manager Improvements — Phase 15

**Status:** Planned · **Depends on:** Phase 12 (Group & Card Manager) complete  
**Origin:** Brainstorm session 2026-03-16

---

## Overview

Four targeted productivity improvements to the Group Manager page.
Each is self-contained and can be implemented independently in the order listed.
All changes are additive — no existing behaviour is removed or broken.

**Recommended implementation order:**

```
Feature 3 → Feature 4 → Feature 1 → Feature 2
```

Ordered by complexity: DB-only additions first, pure-frontend second, most complex last.

---

## Feature Index

| # | Feature | Complexity | Backend? | New IPC? |
|---|---|---|---|---|
| 1 | Inline Search / Filter Bar | Medium | No | No |
| 2 | Undo Last Action | High | Yes | Yes |
| 3 | Empty Group Indicator | Low | Yes | Yes |
| 4 | Card Item Count in Move Dropdown | Low | Yes | Yes |

---

## Feature 1 — Inline Search / Filter Bar

### Problem
With 10+ groups the user must scroll to find what they want to edit.
There is no way to narrow the view without manually expanding and collapsing groups.

### Goal
A text input in the header that filters groups, cards, and items by name in real time.
Matched groups auto-expand. Matched cards auto-open their items panel.
Non-matching entries are hidden. Clearing the filter restores prior state exactly.

### Behaviour spec
- Filter is case-insensitive
- Matches against: group name, card name, item label, item path
- A group is visible if: its name matches OR any of its cards match OR any card's item matches
- A card is visible if: its name matches OR any of its items match
- An item is visible if: its label or path matches
- When filter is active, matched groups are force-expanded (visual override only)
- When filter is active, matched cards force-open their items panel (visual override)
- Filter does NOT mutate `expandedGroupIds` or `openItemCardIds` state — it is a derived overlay
- Clearing the filter returns the view to whatever the user had manually set before
- An `×` clear button appears inside the input when text is present
- Input is focused when the user presses `Ctrl+F` (keyboard shortcut)

### Files touched

| File | Change |
|---|---|
| `src/pages/GroupManagerPage.tsx` | All changes — filter state, derived filtered data, input UI, keyboard shortcut |

### State additions (main page)
```ts
const [filterQuery, setFilterQuery] = useState('')
```

### Derived data (computed from filterQuery + existing data)
```ts
// Only computed when filterQuery is non-empty — otherwise pass-through
const filteredGroups:   Group[]              // groups that pass the filter
const filteredCardIds:  Set<string>          // card IDs that are visible under each group
const filteredItemIds:  Set<string>          // item IDs that are visible under each card
const forceExpandedIds: Set<string>          // group IDs to force-expand (union of expandedGroupIds + filter matches)
const forceOpenCardIds: Set<string>          // card IDs to force-open items panel (union of openItemCardIds + filter matches)
```

### Component changes
- `GroupRow` receives `filteredCardIds` — `ExpandedCards` only renders cards in this set
- `ExpandedCards` receives `filteredItemIds` — `CardRow` only renders items in this set
- `CardRow` receives `filteredItemIds` — `ItemSelectRow` only renders items in this set
- Header toolbar: search input added between title block and Expand All / Open Items buttons

### No backend changes needed
All filtering is pure frontend — data is already loaded into component state.

---

## Feature 2 — Undo Last Action

### Problem
Bulk delete and bulk move are immediately destructive with no recovery path.
A misclick on "Delete 5 groups" or "Move 12 items" to the wrong card is unrecoverable
without restarting and restoring from a backup snapshot.

### Goal
After any bulk destructive operation a toast notification appears for 5 seconds
with an "Undo" button. Clicking Undo reverses the operation exactly and refreshes the UI.

### Behaviour spec
- One undo level only — the last destructive action
- Operations covered: bulk delete groups, bulk delete cards, bulk move cards, bulk move items
- Toast auto-dismisses after 5 seconds
- Clicking "Undo" dismisses the toast and reverses the operation immediately
- Clicking elsewhere does NOT dismiss the toast (only time or Undo)
- After undo: `cardRefreshToken` and `itemRefreshToken` are incremented so all panels re-fetch
- Undo is not available for single-item deletes (only bulk operations)
- Toast is NOT dismissable by the user manually (no X button) — it times out naturally

### Undo snapshot shape
```ts
type UndoSnapshot =
  | { type: 'deleteGroups'; groups: Group[] }
  | { type: 'deleteCards';  cards: Card[] }
  | { type: 'moveCards';    moves: { cardId: string; originalGroupId: string; originalSortOrder: number }[] }
  | { type: 'moveItems';    moves: { itemId: string; originalCardId: string }[] }

interface UndoState {
  snapshot:    UndoSnapshot
  label:       string       // e.g. "Deleted 3 groups" — shown in toast
  expiresAt:   number       // Date.now() + 5000
}
```

### Undo mechanics per operation type

**deleteGroups:** Re-create each group via `ipc.groups.create` with original name, icon, accentColor.
SortOrder is restored. Groups are re-created in original sort order.

**deleteCards:** Re-create each card via `ipc.cards.create` with original name, icon, groupId.
SortOrder is restored.
Note: Items inside deleted cards are permanently lost — undo only restores the card shells.
This limitation is documented in the toast: "Card contents are not restored."

**moveCards:** Move each card back to its original groupId via `ipc.cards.move`.

**moveItems:** Move each item back to its original cardId via `ipc.items.move`.

### Files touched

| File | Change |
|---|---|
| `src/pages/GroupManagerPage.tsx` | `undoState` + `undoTimer` state, capture snapshot before each bulk op, `handleUndo()`, Toast UI component |
| `src/components/ui/UndoToast.tsx` | New file — self-contained toast component with countdown bar |

### State additions (main page)
```ts
const [undoState,  setUndoState]  = useState<UndoState | null>(null)
const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

### Snapshot capture points
```ts
// Before handleBulkDeleteGroups  → snapshot type: 'deleteGroups'
// Before handleBulkDeleteCards   → snapshot type: 'deleteCards'
// Before handleBulkMoveCards     → snapshot type: 'moveCards'
// Before handleBulkMoveItems     → snapshot type: 'moveItems'
```

### Toast UI spec
```
┌─────────────────────────────────────────────────┐
│  Moved 3 items to "Dev Tools"          [Undo]   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────┘
```
- Fixed position: bottom-right, above the BulkActionBar
- Progress bar animates from full → empty over 5 seconds (CSS animation)
- "Undo" button styled with accent colour
- z-index above BulkActionBar

### No new IPC channels needed
All undo operations use existing IPC: `groups.create`, `cards.create`, `cards.move`, `items.move`.
The snapshot captures enough data to reverse each operation using what already exists.

---

## Feature 3 — Empty Group Indicator

### Problem
Groups with zero cards are invisible dead weight — you have to expand every group
to discover which ones are empty. With 10+ groups this is tedious.

### Goal
Groups with zero cards display a small "Empty" badge on their row in the Group Manager,
visible without expanding. This makes cleanup immediately obvious.

### Behaviour spec
- Badge only shows on groups with exactly 0 cards
- Groups with 1+ cards show nothing (no card count clutter on non-empty groups)
- Badge is styled as a small muted pill: grey background, "Empty" label
- Badge position: right side of group header row, before the Edit / Delete buttons
- Badge updates after: bulk delete cards, bulk move cards (re-fetch on `cardRefreshToken`)
- Badge is fetched in a single batch query on page mount — not per-group

### Files touched

| File | Change |
|---|---|
| `src/pages/GroupManagerPage.tsx` | `groupCardCounts` state, fetch on mount + `cardRefreshToken`, pass count to `GroupRow`, render badge |
| `src/utils/ipc.ts` | Add `groups.getCardCounts()` |
| `electron/preload.ts` | Expose `groups:getCardCounts` channel |
| `electron/ipc/groups.ipc.ts` | Add `groups:getCardCounts` handler |
| `electron/db/queries/groups.queries.ts` | Add `getGroupCardCounts(db)` query |

### New DB query
```ts
// electron/db/queries/groups.queries.ts
export function getGroupCardCounts(db: Database.Database): { groupId: string; cardCount: number }[] {
  const rows = db.prepare(`
    SELECT group_id as groupId, COUNT(*) as cardCount
    FROM cards
    GROUP BY group_id
  `).all()
  return rows as { groupId: string; cardCount: number }[]
}
```
Returns only groups that HAVE cards. Groups absent from the result have 0 cards.
The renderer builds a `Map<groupId, number>` and treats missing entries as 0.

### New IPC handler
```ts
// electron/ipc/groups.ipc.ts — added inside registerGroupHandlers()
ipcMain.handle('groups:getCardCounts', () => {
  return getGroupCardCounts(getDb())
})
```

### New preload entry
```ts
// electron/preload.ts — inside groups: {}
getCardCounts: () => invoke<{ groupId: string; cardCount: number }[]>('groups:getCardCounts'),
```

### New ipc.ts entry
```ts
// src/utils/ipc.ts — inside ipc.groups
getCardCounts: (): Promise<{ groupId: string; cardCount: number }[]> => api.groups.getCardCounts(),
```

### State additions (main page)
```ts
const [groupCardCounts, setGroupCardCounts] = useState<Map<string, number>>(new Map())

// Fetch on mount and whenever cardRefreshToken changes
useEffect(() => {
  ipc.groups.getCardCounts()
    .then(rows => {
      const map = new Map(rows.map(r => [r.groupId, r.cardCount]))
      setGroupCardCounts(map)
    })
    .catch(console.error)
}, [cardRefreshToken])
```

### Badge rendering in GroupRow
```tsx
// GroupRow receives: cardCount: number (from groupCardCounts.get(group.id) ?? 0)
{cardCount === 0 && (
  <span className="text-[0.7rem] px-1.5 py-0.5 rounded font-medium"
    style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}>
    Empty
  </span>
)}
```

---

## Feature 4 — Card Item Count in "Move Items to Card" Dropdown

### Problem
The "Move items to card" dropdown shows only card name + group name.
When choosing a destination you have no way to know which cards are already heavy
(many items) vs empty — forcing you to open each card manually to check.

### Goal
Each card entry in the dropdown shows its current item count as a muted `(n)` suffix,
so you can make an informed choice about where to move items.

### Behaviour spec
- Item count shown as muted `(n)` after the card name in the dropdown
- Zero-item cards show `(0)` — a useful signal that the card is empty
- Counts are fetched when the dropdown opens (same trigger as the card list fetch)
- Count reflects the current state in DB at the time the dropdown opens
- No live update while dropdown is open (static snapshot on open)

### Files touched

| File | Change |
|---|---|
| `src/pages/GroupManagerPage.tsx` | `BulkActionBar` — fetch item counts alongside card list, display `(n)` in dropdown |
| `src/utils/ipc.ts` | Add `items.getCountsByCard()` |
| `electron/preload.ts` | Expose `items:getCountsByCard` channel |
| `electron/ipc/items.ipc.ts` | Add `items:getCountsByCard` handler |
| `electron/db/queries/items.queries.ts` | Add `getItemCountsByCard(db)` query |

### New DB query
```ts
// electron/db/queries/items.queries.ts
export function getItemCountsByCard(db: Database.Database): { cardId: string; itemCount: number }[] {
  const rows = db.prepare(`
    SELECT card_id as cardId, COUNT(*) as itemCount
    FROM items
    GROUP BY card_id
  `).all()
  return rows as { cardId: string; itemCount: number }[]
}
```
Returns only cards that HAVE items. Cards absent from the result have 0 items.

### New IPC handler
```ts
// electron/ipc/items.ipc.ts — added inside registerItemHandlers()
ipcMain.handle('items:getCountsByCard', () => {
  return getItemCountsByCard(getDb())
})
```

### New preload entry
```ts
// electron/preload.ts — inside items: {}
getCountsByCard: () => invoke<{ cardId: string; itemCount: number }[]>('items:getCountsByCard'),
```

### New ipc.ts entry
```ts
// src/utils/ipc.ts — inside ipc.items
getCountsByCard: (): Promise<{ cardId: string; itemCount: number }[]> => api.items.getCountsByCard(),
```

### BulkActionBar state additions
```ts
const [itemCountMap, setItemCountMap] = useState<Map<string, number>>(new Map())

// Added inside existing useEffect that fires on showMoveItems
useEffect(() => {
  if (!showMoveItems) return
  // existing: load allCards...
  // new: also load item counts
  ipc.items.getCountsByCard()
    .then(rows => setItemCountMap(new Map(rows.map(r => [r.cardId, r.itemCount]))))
    .catch(console.error)
}, [showMoveItems, allGroups])
```

### Dropdown rendering change
```tsx
// Before:
<span className="truncate">{card.name}</span>

// After:
<span className="truncate">{card.name}</span>
<span className="text-[0.7rem] shrink-0"
  style={{ color: 'var(--text-muted)' }}>
  ({itemCountMap.get(card.id) ?? 0})
</span>
```

---

---

## Implementation Checklist

### Feature 3 — Empty Group Indicator
- [ ] `electron/db/queries/groups.queries.ts` — add `getGroupCardCounts(db)`
- [ ] `electron/ipc/groups.ipc.ts` — add `groups:getCardCounts` handler
- [ ] `electron/preload.ts` — expose `groups:getCardCounts`
- [ ] `src/utils/ipc.ts` — add `ipc.groups.getCardCounts()`
- [ ] `src/pages/GroupManagerPage.tsx` — `groupCardCounts` state, fetch effect, pass to `GroupRow`, badge UI

### Feature 4 — Card Item Count in Move Dropdown
- [ ] `electron/db/queries/items.queries.ts` — add `getItemCountsByCard(db)`
- [ ] `electron/ipc/items.ipc.ts` — add `items:getCountsByCard` handler
- [ ] `electron/preload.ts` — expose `items:getCountsByCard`
- [ ] `src/utils/ipc.ts` — add `ipc.items.getCountsByCard()`
- [ ] `src/pages/GroupManagerPage.tsx` — `itemCountMap` state in `BulkActionBar`, fetch in effect, render `(n)`

### Feature 1 — Inline Search / Filter Bar
- [ ] `src/pages/GroupManagerPage.tsx` — `filterQuery` state, derived filter logic, search input UI, keyboard shortcut, pass filtered sets to `GroupRow` → `ExpandedCards` → `CardRow`

### Feature 2 — Undo Last Action
- [ ] `src/pages/GroupManagerPage.tsx` — `undoState` + timer ref, snapshot capture before each bulk op, `handleUndo()`, render `<UndoToast>`
- [ ] `src/components/ui/UndoToast.tsx` — new file, toast UI with countdown bar

---

## Non-Goals (explicitly out of scope for this phase)

- Multi-level undo (only last action)
- Undo for single-item deletes
- Undo for renames
- Persisting undo history across app restarts
- Live item count updates while "Move items" dropdown is open
- Search across item notes or tags (label + path only)
- Saving filter state across navigation

---

## Open Questions

| Question | Decision |
|---|---|
| Should "Empty" badge hide after a card is added to the group without navigating away? | Yes — badge reacts to `cardRefreshToken` which increments on all card operations |
| Should Undo toast survive page navigation? | No — navigating away clears the undo state |
| Should filter query survive page navigation? | No — clears on unmount, same as expansion state |
| For deleteGroups undo — should items inside deleted cards be restored? | No — too complex for v1. Toast warns: "Card contents are not restored." |
