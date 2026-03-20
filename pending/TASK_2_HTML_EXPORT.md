# HTML Export — Static Dashboard Page

## What it is

A one-click export that converts all URL items from Command-Center into a
self-contained `export.html` file. The file preserves the full Group → Card → Item
hierarchy, accent colors, and favicons — and works as either a personal browser
start page or a hosted GitHub Pages portfolio.

---

## Use Cases

### 1. Browser Start Page
Export → open `export.html` as your browser's new tab page.
All your URL tools in one place, organized exactly like the app.
Re-export anytime to reflect changes.

### 2. GitHub Pages Portfolio
Push `export.html` as `index.html` to a `gh-pages` branch.
Instantly a live URL showcasing your organized toolset.
Demonstrates the app working with real data.

---

## Scope

**Only URL items are exported.** Everything else is excluded:

| Item Type | Exported |
|---|---|
| URL | ✅ Yes — rendered as clickable link |
| Software | ❌ No |
| Folder | ❌ No |
| Command | ❌ No |
| Action | ❌ No |

Cards where all items are non-URL are hidden entirely.
Groups where all cards are hidden are hidden entirely.

---

## Data Pipeline

```
SQLite
  → SELECT items WHERE type = 'url'
  → JOIN cards, groups for hierarchy + accent colors
  → Read cached favicon files → encode as base64 data URIs
  → Render HTML string with embedded CSS
  → Write to export.html (single self-contained file)
```

No external dependencies. No server. One file.

---

## Output Structure

```
export.html
  ├── <head>  embedded CSS (tokens from app theme)
  └── <body>
        ├── Group: Desktop App Dev  (accent: #6366f1)
        │     ├── Card: Editors
        │     │     └── [favicon] VS Code
        │     └── Card: Docs
        │           ├── [favicon] MDN Web Docs
        │           └── [favicon] Stack Overflow
        ├── Group: Data Analytics   (accent: #10b981)
        │     └── ...
        └── ...
```

---

## Design Decisions

| Decision | Rationale |
|---|---|
| URL-only scope | Keeps output clean and functional. Non-URL items make no sense in a browser context. |
| Single `.html` file | Zero dependencies, works offline, easy to share or host. |
| Favicons embedded as base64 | No broken image requests. Works fully offline and on hosted pages. |
| Accent colors preserved | Visual identity matches the app — makes the export feel like a real product. |
| localhost URLs included | Valid for start page use. On hosted pages they simply won't resolve — acceptable. |

---

## Open Questions (decide before implementation)

1. **Localhost URLs** — show with a dimmed "local only" badge, or include as-is?
2. **Export trigger location** — Settings page button, or File menu item?
3. **Theme** — always export in dark theme, or match current app theme?
4. **File name** — fixed `export.html`, or prompt user to choose save location?

---

## Implementation Plan (high level)

### Main Process
- [ ] `electron/handlers/export.handler.ts` — new IPC handler `export:html`
- [ ] Query: `SELECT items (type=url) + cards + groups + favicons`
- [ ] Read favicon files from `assets/favicons/`, encode to base64
- [ ] Render HTML string via template function
- [ ] `ipc.system.showSaveDialog` → write file to chosen path

### Renderer
- [ ] Add "Export as HTML" button in `SettingsPage.tsx`
- [ ] Call `ipc.export.html()` on click
- [ ] Show success toast with file path on completion

### IPC
- [ ] Add `export` domain to `electron/preload.ts`
- [ ] Channel: `export:html`

---

## Files to create / modify

| File | Change |
|---|---|
| `electron/handlers/export.handler.ts` | New — core export logic |
| `electron/preload.ts` | Add `export` domain |
| `electron/utils/html-template.ts` | New — HTML/CSS template renderer |
| `src/utils/ipc.ts` | Add `ipc.export.html()` |
| `src/pages/SettingsPage.tsx` | Add export button |

---

## Status

> `planned` — not started
