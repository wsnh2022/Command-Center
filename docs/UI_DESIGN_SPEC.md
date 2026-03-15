# UI_DESIGN_SPEC.md
# Command-Center — UI Design Specification

> **Version:** 0.1.0-beta  
> **Last Updated:** 2026-03-15  
> **Stack:** React 18 + Tailwind CSS + Lucide React  

---

## 1. Design Philosophy

| Principle | Rule |
|---|---|
| **Minimalist** | No decorative elements. Every pixel serves a purpose. |
| **Vibrant** | Per-group accent colors bring life without clutter. |
| **Readable** | High contrast text. Clean sans-serif. Never sacrificed for style. |
| **Fluid** | Transitions ≤ 150ms. No layout shifts. Instant feedback on every action. |
| **Consistent** | Same spacing, radius, shadow system everywhere. No surprises. |

---

## 2. Design Tokens

All tokens defined in `tailwind.config.ts` and consumed as CSS variables.

### 2.1 Color System

```typescript
// tailwind.config.ts
colors: {
  // Base surfaces
  surface: {
    0:  'var(--surface-0)',   // deepest background (app bg)
    1:  'var(--surface-1)',   // sidebar bg
    2:  'var(--surface-2)',   // card bg
    3:  'var(--surface-3)',   // input / hover bg
    4:  'var(--surface-4)',   // border / divider
  },
  // Text
  text: {
    primary:   'var(--text-primary)',    // headings, labels
    secondary: 'var(--text-secondary)',  // subtitles, paths
    muted:     'var(--text-muted)',      // placeholders, timestamps
    inverse:   'var(--text-inverse)',    // text on accent bg
  },
  // Accent (per-group, injected as CSS var at runtime)
  accent: {
    DEFAULT: 'var(--accent)',            // group accent color
    soft:    'var(--accent-soft)',       // 15% opacity accent
    hover:   'var(--accent-hover)',      // accent darkened 10%
  },
  // Semantic
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  info:    '#3b82f6',
}
```

### 2.2 Dark Theme CSS Variables

```css
:root,
:root[data-theme="dark"] {
  --surface-0: #0a0a0a;
  --surface-1: #1d1d1d;
  --surface-2: #252525;
  --surface-3: #2e2e2e;
  --surface-4: #383838;
  --text-primary:   #f5f5f5;
  --text-secondary: #a0a0a0;  /* contrast ~5.7:1 on #252525, passes WCAG AA */
  --text-muted:     #737373;  /* contrast ~4.5:1 on #252525, passes WCAG AA */
  --text-inverse:   #0a0a0a;
  --accent:       #7c6ff7;
  --accent-soft:  rgba(124, 111, 247, 0.12);
  --accent-hover: #6b5ef0;
}
```

### 2.3 Light Theme CSS Variables

```css
:root[data-theme="light"] {
  --surface-0: #ffffff;
  --surface-1: #f3f4f8;
  --surface-2: #f0f2f8;
  --surface-3: #e8ecf4;
  --surface-4: #c8d0e0;
  --text-primary:   #0f1117;
  --text-secondary: #4a5578;
  --text-muted:     #7a8aaa;
  --text-inverse:   #f0f4ff;
}
```

### 2.4 Typography

```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
}

fontSize: {
  // Three user-selectable sizes (font_size setting)
  // Small
  'xs':  ['11px', { lineHeight: '16px' }],
  'sm':  ['12px', { lineHeight: '18px' }],
  'base':['13px', { lineHeight: '20px' }],
  'lg':  ['15px', { lineHeight: '22px' }],
  // Medium (default)
  // +1px each tier above
  // Large
  // +2px each tier above
}
```

> Font size scaling applied via `data-font-size` attribute on `<html>`:
> - `small` → `font-size: 13px`
> - `medium` → `font-size: 15px` (default)
> - `large` → `font-size: 17px`

### 2.5 Spacing & Radius

```typescript
spacing: {
  // Compact density
  'card-pad-compact':  '10px',
  'item-height-compact': '32px',
  // Comfortable density (default)
  'card-pad':          '14px',
  'item-height':       '40px',
}

borderRadius: {
  'card':   '10px',
  'pill':   '999px',
  'modal':  '14px',
  'input':  '6px',
  'btn':    '6px',
  'panel':  '0px',   // slide-in panels go edge-to-edge
}
```

### 2.6 Shadows

```typescript
boxShadow: {
  'card':   '0 2px 8px rgba(0,0,0,0.18)',
  'modal':  '0 8px 32px rgba(0,0,0,0.32)',
  'panel':  '−4px 0 24px rgba(0,0,0,0.24)',
  'tray':   '0 2px 12px rgba(0,0,0,0.22)',
  'none':   'none',
}
```

### 2.7 Transitions

```typescript
transitionDuration: {
  'fast':   '100ms',
  'base':   '150ms',
  'slow':   '250ms',
}
transitionTimingFunction: {
  'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
}
```

> **Rule:** All interactive elements use `transition-base`. Slide-in panels use `transition-slow`. Never exceed `250ms`.

---

## 3. Layout Architecture

### 3.1 App Shell

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (h-12)  [SearchBar ─────────────────] [WinControls] │
├──────────┬──────────────────────────┬───────────────────────┤
│          │                          │                       │
│ Sidebar  │     Main Content Area    │   Webview Panel       │
│ (w-56)   │     (flex-1)             │   (resizable, hidden  │
│          │                          │    by default)        │
│ Groups   │  HomePage /              │                       │
│ Pills    │  GroupPage /             │   BrowserView         │
│          │  SettingsPage / etc.     │   renders here        │
│ ────────  │                          │                       │
│ Page     │                          │                       │
│ Icons    │                          │                       │
└──────────┴──────────────────────────┴───────────────────────┘
```

### 3.2 Sidebar (w-56, fixed)

```
┌────────────────────┐
│  ▣ Command-Center     │  ← App logo + name (top)
│  ──────────────    │
│  ● Work            │  ← Group pill (active, accent colored)
│  ○ Dev Tools       │  ← Group pill (inactive)
│  ○ Research        │
│  ○ Personal        │
│  + Add Group       │  ← Add button (bottom of pills)
│                    │
│  [flex spacer]     │
│  ──────────────    │
│  ⚙ ⊞ ↑↓ ⌨ ℹ     │  ← Page icon bar (Settings, Manager,
└────────────────────┘     Import/Export, Shortcuts, About)
```

### 3.3 TopBar (h-12, full width)

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Search everything...              [─] [□] [✕]       │
└─────────────────────────────────────────────────────────┘
```
- Search bar spans full width minus window controls
- Window controls: minimize, maximize, close (native frame or custom)
- Search results dropdown appears below, full width

### 3.4 Card Grid (GroupPage)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 📁 Card  │ │ 🌐 Card  │ │ ⚡ Card  │ │ 🔧 Card  │
│ ──────── │ │ ──────── │ │ ──────── │ │ ──────── │
│ > item 1 │ │ > item 1 │ │ > item 1 │ │ > item 1 │
│ > item 2 │ │ > item 2 │ │ > item 2 │ │ > item 2 │
│ > item 3 │ │ > item 3 │ │ > item 3 │ │ > item 3 │
│ + Add    │ │ + Add    │ │ + Add    │ │ + Add    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 📊 Card  │ │ 🔐 Card  │ │ 📝 Card  │ │ 🚀 Card  │
│  ...     │ │  ...     │ │  ...     │ │  ...     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

                                        [+ Add Card]
```

- Grid: `grid-cols-4 gap-4`
- Cards scroll vertically if more than 8 (2 rows)
- `+ Add Card` floats below grid, right-aligned

### 3.5 Card Component

```
┌─────────────────────────────┐
│ [icon] Card Title      [⋮]  │  ← Header (accent left border)
│ ─────────────────────────── │
│ [🌐] GitHub            [ℹ] │  ← Item row (hover shows ℹ)
│ [📁] Projects Folder   [ℹ] │
│ [⚡] deploy.ps1        [ℹ] │
│ [🔗] Staging URL       [ℹ] │
│                             │
│  ▼ Note expanded here...    │  ← 450-word note dropdown
│    Tags: #work #deploy      │
│                             │
│ + Add Item                  │
└─────────────────────────────┘
```

- Card left border: `3px solid var(--accent)` — group accent color
- Card header `[⋮]` button: rename card, change icon, delete card
- Item row height: `item-height` token (density-aware)
- Info `[ℹ]` button: visible only on row hover

### 3.6 Home Screen

```
┌──────────────────────┬──────────────────────┐
│   ★ Favorites        │   🕐 Recently Used    │
│   ────────────────   │   ────────────────    │
│   [icon] Item A      │   [icon] Item X  2m   │
│   [icon] Item B      │   [icon] Item Y  1h   │
│   [icon] Item C      │   [icon] Item Z  3h   │
│   [icon] Item D      │   [icon] Item W  1d   │
│   [icon] Item E      │   ...                 │
│   ...                │                       │
└──────────────────────┴──────────────────────┘
```

- Two equal columns (`grid-cols-2`)
- Favorites: manually pinned, drag-reorderable
- Recents: auto-populated, relative timestamps, last 20

---

## 4. Component Specifications

### 4.1 GroupPill

```
States: default | hover | active | dragging
─────────────────────────────────────────
Default:  bg-surface-2, text-secondary, icon muted
Hover:    bg-surface-3, text-primary
Active:   bg-accent-soft, text-primary, accent left border 2px
Dragging: opacity-60, scale-95, shadow-tray
```

**Edit gesture (currently missing — must be added):**
- **Right-click** on any GroupPill → small context menu with: Rename / Edit Color / Delete
- "Rename" / "Edit Color" → opens `AddGroupModal` in edit mode pre-filled with group data
- `AddGroupModal` already supports create + edit modes; the trigger just needs wiring

### 4.1.1 Item Type Icons (locked decision)

**No emoji anywhere for item types.** All type icons are hardcoded Lucide SVGs.
Central source of truth: `src/components/items/ItemIcons.tsx`

| Type | Icon | Color class |
|---|---|---|
| `url` | `Globe` | `text-sky-400` |
| `software` / `exe` | `Zap` | `text-amber-400` |
| `folder` | `Folder` | `text-yellow-500` |
| `command` / `script` | `Terminal` | `text-emerald-400` |
| `action` / `ssh` | `Cpu` | `text-violet-400` |

Colors use Tailwind spectrum classes — visible on both dark and light surfaces.
Context menu action icons (`Monitor`, `Pencil`, `Copy`, `ArrowRight`, `Trash2`) use `text-text-secondary` (CSS var) → shift automatically with theme.

### 4.2 ItemRow

```
States: default | hover | selected (bulk mode)
─────────────────────────────────────────────
Default:  transparent bg, text-secondary path truncated
Hover:    bg-surface-3, text-primary, show [ℹ] button
Selected: bg-accent-soft, show checkbox checked
```

### 4.3 SearchBar

```
Always visible in TopBar.
Rendered as a real <input type="text"> — ALWAYS editable/focusable from Phase 2 onward.
Placeholder: "Search everything..."
On focus:    border accent color, subtle glow
On type:     results dropdown appears (Phase 6) — max-h-96, overflow-scroll
Results grouped: Group Name → Card Name → Item rows
Fuzzy match highlight: matched chars wrapped in <mark> accent color
Debounce: 150ms
```
> **Bug fix (Phase 2 debt):** TopBar currently renders a `<span>` inside a `<div>`. Replace with a proper
> `<input type="text" />` so the field is immediately typeable. Full search wiring stays Phase 6.

### 4.4 AddGroupModal

```
Fields:
  - Name (text input, autofocus)
  - Icon (IconPicker component)
  - Accent Color (ColorPicker — 12 presets + custom hex)

Size: w-96, centered
Confirm: "Create Group" (accent bg button)
Cancel:  "Cancel" (ghost button)
```

### 4.5 ItemFormPanel (Slide-in)

```
Slides in from right edge. Width: 360px.
Overlay: semi-transparent backdrop on card grid.
```

**Type tabs (5 types — renamed from original spec):**
```
[ URL ] [ Software ] [ Folder ] [ Command ] [ Action ]
   ↑         ↑           ↑          ↑           ↑
  url     software     folder    command      action
 (url)    (was exe)  (unchanged) (was script) (was ssh)
```

---

**URL type fields:**
```
Label        (text input)
URL          (text input — https://…)
Tags         (tag input)
Note         (textarea, 450 word counter)
```

---

**Software type fields:**
```
Label        (text input)
Path         (text input + Browse button → .exe / .bat / .cmd filter)
Tags         (tag input)
Note         (textarea, 450 word counter)
```

---

**Folder type fields:**
```
Label        (text input)
Path         (text input + Browse button → folder picker)
Tags         (tag input)
Note         (textarea, 450 word counter)
```

---

**Command type fields** *(ref: screenshot 1 — use slide-in panel layout, not modal)*:
```
Label              (text input — display name)
Command            (text input — e.g. powershell, cmd, wt, node)
                   stored in `path` column
Arguments          (text input — e.g. -NoProfile -Command "…")
                   stored in `command_args` column
Working Directory  (text input + Browse button — folder picker, optional)
                   placeholder: "Default: Documents"
                   stored in `working_dir` column
Tags               (tag input)
Note               (textarea, 450 word counter)
```
> Launch behavior: `child_process.spawn(command, parseArgs(arguments), { cwd: workingDir || userDocuments })`

---

**Action type fields** *(ref: screenshot 2 — use slide-in panel layout, not modal)*:
```
Choose Action      (predefined action grid — see below)
Label              (text input — auto-filled from selected action name, editable)
Tags               (tag input)
Note               (textarea, 450 word counter)
```

**Action grid layout (v0.1.0-beta — 11 predefined + custom):**
```
[ Screenshot ] [ Lock Screen ] [ Sleep      ] [ Shut Down  ]
[ Restart    ] [ Task Mgr   ] [ Calculator  ] [ Empty Bin  ]
[ Clipboard  ] [ Run        ] [ + Custom... ]
```
- Each button: Lucide icon + label text
- Selected action: `bg-accent-soft border-accent` highlight
- Clicking `Custom` → reveals a text input for a custom shell command

**Action icon mapping:**
| Action | Icon |
|---|---|
| Screenshot | `Camera` |
| Lock Screen | `Lock` |
| Sleep | `Moon` |
| Shut Down | `Power` |
| Restart | `RotateCcw` |
| Task Manager | `Monitor` |
| Calculator | `Calculator` |
| Empty Recycle Bin | `Trash2` |
| Clipboard | `Clipboard` |
| Run | `Terminal` |
| Custom | `Wrench` |

---

**Panel footer (all types):**
```
[Delete]  (danger link — edit mode only, left side)
          [Cancel]  [Save / Add Item]  (right side)
```

### 4.6 ContextMenu

```
Appears at cursor on right-click.
Auto-repositions if near screen edge.
Closes on: outside click, Escape, any item click.

Items:
  ─────────────────────
  📂 Open in Webview
  ─────────────────────
  ✏️  Edit
  📋 Copy Path
  ↗️  Move to Card   ▶
  ─────────────────────
  🗑️  Delete          ← danger color (red)
  ─────────────────────

Separator lines group related actions.
Move to Card opens submenu with all card names.
```

### 4.7 WebviewPanel

```
Opens as a resizable split panel in two positions (controlled by Settings):
  Right:  panel slides in from the right edge alongside the card grid
  Bottom: panel slides up from the bottom below the card grid

Right mode:
  Min width: 300px. Max: window width − sidebar − 50px safety buffer.
  Drag handle: 8px vertical strip on left edge (BrowserView x offset matches).

Bottom mode:
  Min height: 200px.
  Drag handle: 8px horizontal strip on top edge.

Header bar (h-10) — both modes:
  [←] [→] [↺]  [url display — truncated]  [⎋ eject] [✕ close]

BrowserView fills remaining panel area.
Resize drag sends webview:resize IPC → main process repositions BrowserView bounds.
```

### 4.8 IconPicker

```
Tabs:
  [Auto] [Emoji] [Library] [Upload] [URL] [Base64]

Auto:    Shows current resolved icon + "Reset to auto" button
Emoji:   Search input + scrollable emoji grid grouped by category
Library: Search input + virtual-scroll grid of all 1460 Lucide icons
         Colour picker below grid (12 presets + custom hex) for library icons
Upload:  Browse button — accepts .svg .png .jpg .ico
URL:     Paste image URL — live preview (fetches to memory, writes on confirm)
Base64:  Paste base64 string — live preview

All methods show a 48×48px live preview before confirming.
Library icons support a custom colour stored in icon_color column.
Confirm: saves to local assets, returns relative path + iconColor.
```

---

## 5. Animation & Motion Rules

| Interaction | Animation |
|---|---|
| Page switch | Fade in 150ms |
| Slide-in panel open | Slide from right 200ms ease-out |
| Slide-in panel close | Slide to right 150ms ease-in |
| Modal open | Scale 0.96→1 + fade 150ms |
| Modal close | Scale 1→0.96 + fade 100ms |
| Context menu open | Scale 0.98→1 + fade 100ms |
| Note dropdown | Expand height 200ms ease-out |
| Group pill drag | Scale 0.95, opacity 0.6, instant |
| Item hover | bg transition 100ms |
| Search results | Fade in 100ms |

> **Rule:** Never animate layout shifts. Only animate opacity, transform, and max-height. Never animate width/height directly (causes jank) — use max-height or transform for expand/collapse.

---

## 6. Responsive Behavior (Window Resize)

| Window Width | Layout Change |
|---|---|
| ≥ 1400px | Sidebar w-64, cards 4-col, webview up to 600px |
| 1100–1399px | Sidebar w-56 (default), cards 4-col |
| 900–1099px | Sidebar w-48, cards 3-col |
| < 900px | Blocked — minimum window size enforced (900px) |

Card grid columns controlled by:
```css
grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
```
This naturally collapses columns as window narrows.

---

## 7. Accessibility

- All interactive elements: visible focus ring (accent color outline 2px)
- Color never used as sole indicator (icons always accompany color)
- Keyboard navigable: Tab order logical, Escape closes modals/panels
- Screen reader: `aria-label` on all icon-only buttons
- Contrast ratio: text-primary on surface-2 ≥ 7:1 (both themes)

---

## 8. Page-by-Page Layout Summary

| Page | Layout |
|---|---|
| Home | Two-column grid (favorites + recents) |
| Group | Scrollable 4-col card grid |
| Settings | Single-column form sections (Appearance, Behavior, Webview, Data) |
| Group Manager | Expandable group rows with bulk select, recolor, drag reorder, card sub-rows |
| Import / Export | Export section + Import section + Snapshots list |
| Shortcuts | Key recorder + allowed key types table + current shortcut display |
| About | App logo + version + data paths + tech stack + credits |

---

*Next document: → `IMPLEMENTATION_PLAN.md`*
