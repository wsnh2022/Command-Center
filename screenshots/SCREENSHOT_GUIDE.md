# Screenshot Guide — Command-Center

Take each screenshot at 1280×800 (the default window size).
Use the dark theme unless stated otherwise.
Crop to the app window only — no OS chrome, no taskbar.

---

## 1. `01-home-favorites-recents.png`
**What to show:** The Home screen with populated favorites and recent launches.

**Setup:**
- Pin at least 4–5 items to Home (right-click any item → Pin to Home)
- Launch several items so the Recents section is populated
- Make sure item icons are loaded (favicons, emoji, library icons — mix of types)

**Focus:** The two-column layout — Pinned on the left, Recent on the right.

---

## 2. `02-group-page-cards-items.png`
**What to show:** A group page with multiple cards open, each containing several items.

**Setup:**
- Navigate to a group that has 3–4 cards with 4–6 items each
- Hover over one item row so the drag grip is visible (slides in from the left of the icon)
- Show a mix of item types (URL with favicon, software, folder)

**Focus:** The card grid layout, item density, and the drag grip affordance on hover.

---

## 3. `03-item-form-url.png`
**What to show:** The item add/edit form panel open with the URL type selected.

**Setup:**
- Click the **Add Card** button at the bottom-right of the grid to create a card first, then click the `+` row inside a card to open the item form
- Select the URL type (first pill in the type selector)
- Enter a URL so the favicon preview is visible in the icon section

**Focus:** The horizontal type selector, favicon icon preview, and form layout.

---

## 4. `04-item-form-command-templates.png`
**What to show:** The item form with the Command type selected and the template picker visible.

**Setup:**
- Open the item form, select Command type
- Click the template selector to show the dropdown list (PowerShell, CMD, Node REPL, etc.)

**Focus:** The command templates — a unique UI element in the form.

---

## 5. `05-icon-picker-library-color.png`
**What to show:** The Icon Picker modal open on the Library tab with an icon selected and a custom color applied.

**Setup:**
- Edit any item, click the icon button to open the Icon Picker
- Switch to the Library tab
- Search for an icon (e.g. "code") and click one to select it
- Pick a color from the preset swatches or enter a custom hex
- The preview box at the top should show the icon in the chosen color

**Focus:** The 4-tab icon picker, the icon grid, and the colour picker row below it.

---

## 6. `06-search-results.png`
**What to show:** The global search bar active with results populated.

**Setup:**
- Click the search bar in the TopBar (or press `Ctrl+S`)
- Type a short query that returns 4–6 results across different groups
- Make sure results show the group/card breadcrumb and item icons

**Focus:** The search overlay showing fuzzy results grouped by group → card.

---

## 7. `07-sidebar-dividers-group-icons.png`
**What to show:** The sidebar with group icons visible on pills and at least one named section divider.

**Setup:**
- Add a divider between two groups (right-click any group pill → Insert divider after)
- Give it a label (e.g. `── TOOLS ──`)
- Make sure the groups above and below it have icons set (emoji or library icon)
- The active group should be highlighted with accent fill

**Focus:** Group icons on pills, the `── LABEL ──` divider line, and the sidebar structure.

---

## 8. `08-webview-panel-right.png`
**What to show:** The embedded webview panel open on the right side with a URL loaded.

**Setup:**
- Right-click a URL item → Open in Webview
- Let the page load (use a clean, recognisable site)
- Make sure the webview toolbar (back, forward, reload, eject, close) is visible

**Focus:** The split-panel layout — launcher on the left, embedded browser on the right.

---

## 9. `09-group-manager-bulk.png`
**What to show:** The Group Manager with checkboxes selected and the BulkActionBar visible.

**Setup:**
- Navigate to Group Manager (sidebar → bottom icon bar)
- Tick checkboxes on 2–3 groups so they highlight with the accent colour
- The floating BulkActionBar should appear at the bottom of the page showing count + action buttons (Recolor, Delete)
- Expand one group so cards with checkboxes are also visible

**Focus:** Multi-select UI — highlighted rows, BulkActionBar, and the hierarchical tree.

---

## 10. `10-group-manager-filter.png`
**What to show:** The Group Manager with the inline filter active and results narrowed.

**Setup:**
- Type a search term in the filter input that matches items across multiple groups
- Matching groups auto-expand with card panels open and items highlighted
- Non-matching groups collapse or hide

**Focus:** Real-time cross-level filter — groups, cards, and items all responding simultaneously.

---

## 11. `11-group-manager-undo-toast.png`
**What to show:** The undo toast visible after a bulk delete or move operation.

**Setup:**
- Select several items using the Items panel inside an expanded card
- Move them to a different card via BulkActionBar → Move to card
- Immediately screenshot while the toast is visible (5-second window)
- The countdown progress bar should be partially drained

**Focus:** The toast in the bottom-right corner — Undo button, countdown bar.

---

## 12. `12-settings-appearance.png`
**What to show:** The Settings page with the Appearance section visible.

**Setup:**
- Navigate to Settings
- The Appearance section (theme toggle, font size, density) should be fully visible
- Use light theme here to show the animated pill toggle in its day-sky state (blue-pink gradient, spinning sun thumb)

**Focus:** The animated theme toggle and the clean settings layout.

---

## README grid layout (for reference)

| Left | Right |
|---|---|
| 01-home-favorites-recents | 02-group-page-cards-items |
| 06-search-results | 07-sidebar-dividers-group-icons |
| 09-group-manager-bulk | 10-group-manager-filter |
| 08-webview-panel-right | 12-settings-appearance |

Screenshots 03, 04, 05, and 11 are detail shots — use them as a third/fourth row or under a **Details** heading to show form, icon picker, and undo depth.
