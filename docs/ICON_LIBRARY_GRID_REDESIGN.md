# ICON_LIBRARY_GRID_REDESIGN.md
# Command-Center — Icon Library Grid Redesign Plan

> **Created:** 2026-03-14
> **Status:** Approved — pending implementation
> **Scope:** Two files only — `lucide-registry.ts` + `IconPicker.tsx`
> **Phase context:** Pre-Phase 9 cleanup

---

## Problem Statement

Two bugs identified from screenshot review (Session 16):

### Bug 1 — Icons not loading (grey skeletons that never resolve)

**Root cause:** `toKebab()` in `lucide-registry.ts` does not handle
letter→digit transitions. Lucide icon names like `FileJson2`, `BarChart2`,
`FileAudio2` contain trailing digits that must become their own kebab segment.

Current regex inserts a dash before every uppercase letter only:
```
'FileJson2' → 'file-json2'   ← WRONG, no entry in dynamicIconImports
'FileJson2' → 'file-json-2'  ← CORRECT
```

`dynamicIconImports` keys are `file-json-2`, `bar-chart-2`, `file-audio-2` etc.
The lookup returns `undefined` → `loadLucideIcon` returns `null` → skeleton
stays forever.

**Fix:** Extend `toKebab` regex to also insert a dash before digit sequences
that follow a lowercase letter:
```
([a-z])(\d) → '$1-$2'
```
Applied before the existing uppercase-letter insertion.

**Verification:** After fix, `toKebab('FileJson2')` → `'file-json-2'` ✓

---

### Bug 2 — Grid UX: cards are too bulky, label takes vertical space

**Current state:**
- Each cell has a visible border + background
- Label text below every icon (always visible, 9px)
- 6-column grid → ~64px wide cells
- At 120 icons default, grid is very tall and hard to scan

**Requested:** Compact icon-only grid, label shown on hover only (Option B).

---

## Design Decision: Option B

**Icon-only cells, CSS hover reveals label below icon.**

### Cell anatomy

```
Normal state:
┌────────────────┐
│                │    ← no border, no background, transparent
│   [Icon 18px]  │    ← icon centered, text-text-secondary
│                │
└────────────────┘

Hover state:
┌────────────────┐
│   [Icon 18px]  │    ← bg-surface-3, slight highlight
│   ─────────    │
│  IconName 9px  │    ← label fades in below icon
└────────────────┘

Active (selected) state:
┌────────────────┐
│   [Icon 18px]  │    ← bg-accent-soft, text-text-primary
│   ─────────    │
│  IconName 9px  │    ← label always visible when selected
└────────────────┘
```

### Why Option B over A and C

| Option | Approach | Rejected reason |
|--------|----------|-----------------|
| A — tooltip | Browser native `title` tooltip | ~1s delay, ugly OS tooltip, no control over style |
| B — CSS hover label | Label div shown via group-hover | Instant, design-consistent, standard pattern |
| C — top label area | One label display updates on hover | Disconnected UX — user looks at icon, label is far away |

---

## Exact Changes

### File 1: `src/utils/lucide-registry.ts`

**Change:** `toKebab()` function only. No other changes.

**Current:**
```typescript
function toKebab(pascalName: string): string {
  return pascalName
    .replace(/([A-Z])/g, (_, c, i) => (i === 0 ? c : `-${c}`).toLowerCase())
    .toLowerCase()
}
```

**New:**
```typescript
function toKebab(pascalName: string): string {
  return pascalName
    .replace(/([A-Z])/g, (_, c, i) => (i === 0 ? c : `-${c}`).toLowerCase())
    .replace(/([a-z])(\d)/g, '$1-$2')   // insert dash before digit runs: json2 → json-2
    .toLowerCase()
}
```

**Test cases to verify after change:**
| Input | Expected output |
|-------|----------------|
| `Globe` | `globe` |
| `GitBranch` | `git-branch` |
| `FileJson2` | `file-json-2` |
| `BarChart2` | `bar-chart-2` |
| `FileAudio2` | `file-audio-2` |
| `ArrowUpDown` | `arrow-up-down` |
| `Cpu` | `cpu` |

---

### File 2: `src/components/items/IconPicker.tsx`

**Change:** `LibraryGridItem` component only. No other changes.

**Current `LibraryGridItem`:**
```tsx
function LibraryGridItem({ name, active, onSelect }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  const Icon = icon
  return (
    <button onClick={() => onSelect(name)} title={name}
      className={[
        'flex flex-col items-center gap-1 py-2 rounded-btn border transition-base duration-base',
        active
          ? 'bg-accent-soft border-accent text-text-primary'
          : 'border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3',
      ].join(' ')}>
      {Icon
        ? <Icon size={18} strokeWidth={1.75} />
        : <span className="w-[18px] h-[18px] rounded-sm bg-surface-4 animate-pulse" />
      }
      <span className="text-[9px] truncate w-full text-center px-1 leading-tight">{name}</span>
    </button>
  )
}
```

**New `LibraryGridItem`:**
- Remove: `border`, visible background in non-active state, always-visible label
- Add: `group` class for CSS hover coordination
- Label: hidden by default (`opacity-0`), shown on hover (`group-hover:opacity-100`)
  AND shown always when `active`
- Skeleton: same pulse but frameless
- Cell size: `w-9 h-9` (36px square) — tighter than current `py-2` tall card
- Grid columns: increase from 6 to 8 in `LibraryTab`

```tsx
// New structure:
<button className="group relative flex flex-col items-center justify-center
  w-9 h-9 rounded-btn transition-base duration-base
  [active: bg-accent-soft text-text-primary]
  [inactive: text-text-secondary hover:bg-surface-3 hover:text-text-primary]">

  {/* Icon */}
  <Icon size={16} strokeWidth={1.75} />

  {/* Label — hidden until hover or active */}
  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2
    text-[9px] text-text-muted whitespace-nowrap pointer-events-none
    opacity-0 group-hover:opacity-100 transition-opacity duration-fast z-10
    [active: opacity-100]">
    {name}
  </span>
</button>
```

**Note on label overflow:** Label uses `absolute` positioning below the cell.
Grid has `overflow-visible` — the label floats below without affecting layout.
The last row labels may clip at grid bottom — acceptable UX, grid scrolls.

**Grid column change in `LibraryTab`:**
```tsx
// Current:
style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}

// New:
style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}
```

---

## What Does NOT Change

- `PreviewBox` — unchanged
- `LibraryIconPreview` — unchanged
- `LibraryTab` search logic — unchanged (only grid column count changes)
- `ALL_ICON_NAMES`, `DEFAULT_ICONS`, `SEARCH_LIMIT` — unchanged
- All other tabs (Auto, Emoji, Upload, URL, Base64) — unchanged
- All other files — unchanged

---

## Implementation Order

1. Fix `toKebab` in `lucide-registry.ts` — one line addition
2. Rewrite `LibraryGridItem` in `IconPicker.tsx` — one component
3. Change grid columns from 6 → 8 in `LibraryTab` — one line

**Total lines changed: ~15 lines across 2 files.**

---

## Verification Checklist

After implementation:

- [ ] `FileJson2`, `BarChart2`, `FileAudio2` icons resolve (no grey skeleton)
- [ ] Library tab grid shows icons without borders or card backgrounds
- [ ] Hovering an icon reveals its name label below
- [ ] Selected icon shows label always (not just on hover)
- [ ] 8-column grid fits more icons per row
- [ ] Search still works — filtering correct names
- [ ] Existing selected icon (from DB) still highlighted on open
- [ ] No TypeScript errors
- [ ] No layout shift when scrolling the grid

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `toKebab` regex change breaks existing names | Low | Test cases cover all patterns |
| Absolute label overlaps adjacent cells | Medium | `z-10` + `pointer-events-none` prevent click interference |
| Label clips at modal bottom edge | Low | Acceptable — grid scrolls, last row rarely hovered |
| Tailwind `group-hover` not available | None | `group` is a core Tailwind utility, present in v3 |

---

*Plan approved. Proceed with implementation in order listed above.*
