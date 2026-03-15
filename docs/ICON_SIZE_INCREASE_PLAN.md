# ICON_SIZE_INCREASE_PLAN.md
# Command-Center — Icon Size Increase (Sidebar + Item Rows)

> **Created:** 2026-03-14
> **Status:** Awaiting approval
> **Request:** Make sidebar icons and each group item icons ~50% larger

---

## Scope: What "Side Panel and Group Item Icons" Means

After reading all relevant files, the request covers two distinct zones:

### Zone 1 — Sidebar panel icons
All icons rendered inside `Sidebar.tsx` and `GroupPillList.tsx`:

| Location | Component | Current size | Target (×1.5) |
|----------|-----------|-------------|---------------|
| Home button icon | `Sidebar.tsx` line: `<Home size={15} />` | 15px | 22px |
| Page icon bar (Settings, LayoutGrid, etc.) | `Sidebar.tsx` line: `<Icon size={16} />` | 16px | 24px |
| Group pill icon (Lucide) | `GroupPillList.tsx` `PillIcon`: `<Icon size={14} />` | 14px | 21px |
| Group pill icon (emoji fallback) | `GroupPillList.tsx` `PillIcon`: `text-base` (16px) | 16px | 24px → `text-xl` (20px) |
| Group pill icon (dot fallback) | `GroupPillList.tsx` `PillIcon`: `w-2 h-2` dot | 8px | 12px → `w-3 h-3` |
| Add Group button icon | `GroupPillList.tsx`: `<Plus size={13} />` | 13px | — (skip, it's a UI action button not a content icon) |

### Zone 2 — Item row icons (inside each card)
Icons rendered inside `ItemRow.tsx`:

| Location | Component | Current size | Target (×1.5) |
|----------|-----------|-------------|---------------|
| Item type icon (generic fallback) | `ItemRow.tsx` → `ItemTypeIcon`: `size={14}` | 14px | 21px |
| Item custom library icon | `ItemRow.tsx` → `LibraryIcon`: `size={14}` | 14px | 21px |
| Item image/favicon | `ItemRow.tsx`: `w-4 h-4` (16px) | 16px | 24px → `w-6 h-6` |
| Item emoji icon | `ItemRow.tsx`: `text-sm` (14px) | 14px | 21px → `text-[21px]` |
| Icon container span | `ItemRow.tsx`: `w-4 h-4` | 16px | 24px → `w-6 h-6` |

### Zone 3 — HomePage item icons (Favorites + Recents)
Icons in `HomePage.tsx` — same item type icons used in those rows:

| Location | Current | Target |
|----------|---------|--------|
| `SortableFavRow` ItemTypeIcon | `className="w-3.5 h-3.5"` | `w-5 h-5` (21px) |
| `RecentRow` ItemTypeIcon | `className="w-3.5 h-3.5"` | `w-5 h-5` (21px) |

### NOT in scope
- `ItemIcons.tsx` `ItemTypeIcon` default size prop (`size = 14`) — this is the default fallback value. Callers that pass explicit sizes control it. We change the callers, not the default.
- `CtxIcon` in `ItemIcons.tsx` (context menu icons, size 13) — context menu UI, not content icons.
- `CardHeader.tsx` icons — card menu/action icons, not content icons.
- `IconPicker.tsx` — already changed in previous session.
- `ItemFormPanel.tsx` type tab icons — form UI, not content icons.

---

## Exact Changes Per File

### File 1: `src/components/layout/Sidebar.tsx`

**Change 1 — Home button icon:** `size={15}` → `size={22}`

**Change 2 — Page icon bar buttons:** `<Icon size={16} />` → `<Icon size={24} />`

No layout changes needed — buttons are `w-8 h-8` (32px) which accommodates 24px icon fine.

---

### File 2: `src/components/groups/GroupPillList.tsx`

**Change 1 — `PillIcon` Lucide icon:** `size={14}` → `size={21}`

**Change 2 — `PillIcon` emoji span:** `text-base` → `text-xl`
(`text-base` = 16px, `text-xl` = 20px — close enough to ×1.5 without misalignment)

**Change 3 — `PillIcon` dot fallback:** `w-2 h-2` → `w-3 h-3`

**Change 4 — `PillIcon` skeleton placeholder:** `w-4 h-4` → `w-5 h-5`
(matches new icon size so skeleton doesn't shift layout on resolve)

No layout changes needed — pill height is `h-9` (36px), all sizes fit.

---

### File 3: `src/components/items/ItemRow.tsx`

**Change 1 — Icon container span:** `w-4 h-4` → `w-6 h-6`

**Change 2 — Image/favicon:** `w-4 h-4 object-contain rounded-sm` → `w-6 h-6 object-contain rounded-sm`

**Change 3 — Emoji span:** `text-sm` → `text-[21px]`

**Change 4 — `LibraryIcon` component:** `size={14}` → `size={21}`

**Change 5 — Generic type icon call:** `<ItemTypeIcon type={item.type} size={14} />` → `<ItemTypeIcon type={item.type} size={21} />`

**Note on row height:** ItemRow uses `minHeight: 'var(--item-height, 36px)'`. At comfortable density this is 36–40px. A 21px icon fits cleanly with `flex items-center`. No height change needed.

---

### File 4: `src/pages/HomePage.tsx`

**Change 1 — `SortableFavRow` ItemTypeIcon:** `className="w-3.5 h-3.5 flex-shrink-0"` → `className="w-5 h-5 flex-shrink-0"`

**Change 2 — `RecentRow` ItemTypeIcon:** `className="w-3.5 h-3.5 flex-shrink-0"` → `className="w-5 h-5 flex-shrink-0"`

Note: `ItemTypeIcon` accepts either `size` prop (numeric) or `className` (string override). These callers use `className` — change the class, not a size prop.

---

### File 5: `src/pages/GroupPage.tsx`

**Change 1 — `GroupHeaderIcon` Lucide icon:** `size={18}` → `size={27}`
(Group page header is larger context — 27px = 18 × 1.5)

**Change 2 — `GroupHeaderIcon` emoji span:** `text-xl` → `text-[27px]`

---

### File 6: `src/components/layout/SearchResults.tsx`

**Change 1 — Item type icon in search results:** `<ItemTypeIcon type={item.type} className="flex-shrink-0" />` → add explicit size
`<ItemTypeIcon type={item.type} size={16} className="flex-shrink-0" />`

Note: Current call passes no `size` prop — falls back to default `size=14`. At 14px it's tiny in search results. Increasing to 16px (reasonable for search row density, not full ×1.5 to avoid cramping the compact search dropdown).

---

## Files NOT Changed

| File | Reason |
|------|--------|
| `ItemIcons.tsx` | Default `size=14` is a fallback — callers control size |
| `CardHeader.tsx` | Card menu icons — UI chrome, not content |
| `ItemFormPanel.tsx` | Form field type tab icons — UI chrome |
| `IconPicker.tsx` | Icon picker grid — already handled |
| `ActionDefs.tsx` | Action grid icons in form — UI chrome |
| `ItemContextMenu.tsx` | `CtxIcon` — context menu chrome, not content icons |
| `ItemNoteDropdown.tsx` | No icons in this file |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 21px icon overflows item row height | Low | Visual clipping | Row uses `flex items-center` + `minHeight` — 21px fits in 36px row |
| Emoji size `text-[21px]` unsupported in Tailwind | None | Build error | Arbitrary values `text-[21px]` are standard Tailwind v3 syntax |
| Pill icon at 21px pushes text out | Low | Truncation | Pill uses `truncate` on label — already handles overflow |
| HomePage icon at `w-5 h-5` misaligns row | Low | Visual | Row uses `flex items-center gap-2` — accommodates |

---

## Summary

**6 files. ~15 specific size values changed. Zero layout restructuring.**

All changes are numeric size increases only — no class additions, no structural JSX changes.

| File | Changes |
|------|---------|
| `Sidebar.tsx` | 2 size values |
| `GroupPillList.tsx` | 4 size values |
| `ItemRow.tsx` | 5 size values |
| `HomePage.tsx` | 2 size values |
| `GroupPage.tsx` | 2 size values |
| `SearchResults.tsx` | 1 size value |

---

*Awaiting approval before any code changes.*
