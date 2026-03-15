# ICON_SYSTEM.md
# Command-Center — Icon System Specification

> **Version:** 1.0.0-spec  
> **Last Updated:** 2026-03-07  
> **Principle:** All icons resolve to a local file at runtime. No exceptions.  

---

## 1. Core Principle

Every icon in Command-Center — regardless of how it was originally provided — is
normalized to a **local file on disk at save time**. At runtime the app only
ever reads a relative file path from SQLite and loads a local asset.

```
Any input method
      ↓
Save-time normalization (one-time)
      ↓
Local file: assets/icons/{uuid}.png  OR  assets/favicons/{domain}.png
      ↓
DB stores: "icon_path": "assets/icons/abc123.png"
      ↓
Runtime: read local file — always fast, always offline
```

This means **zero runtime overhead** regardless of which input method was used.
The 5 input methods are a save-time UX concern only.

---

## 2. Icon Contexts

Icons appear in three distinct contexts across the app:

| Context | Component | Size | Format |
|---|---|---|---|
| Group pill tab | `GroupPill` | 18×18px | SVG / PNG / Emoji |
| Card header | `CardHeader` | 20×20px | SVG / PNG / Emoji |
| Item row | `ItemRow` | 16×16px | SVG / PNG / Emoji / Favicon |

All three use the same resolution pipeline. Emojis rendered as text, everything
else as `<img>` with local `src` path.

---

## 3. Resolution Hierarchy

On every icon render, the app walks this chain and uses the first valid result:

```
Priority 1 — Custom icon (user-set)
  └─ Check: icon_source = 'custom' | 'emoji' | 'library'
  └─ Action: load from local path or render emoji char directly

Priority 2 — Cached favicon (auto-fetched URL icon)
  └─ Check: icon_source = 'favicon', local file exists + is valid image
  └─ Action: load from assets/favicons/{domain-hash}.png

Priority 3 — Re-fetch favicon (cache miss or corrupt file)
  └─ Check: local file missing or invalid, item type = 'url'
  └─ Action: fetch from Google Favicons API, save locally, update cache
  └─ Show: generic URL icon while fetching (non-blocking)

Priority 4 — Generic type icon (final fallback)
  └─ Always available — Lucide icon based on item type
  └─ url → Globe, exe → Terminal, folder → Folder, script → Code, ssh → Server
```

**Rule:** Priority 4 is always shown immediately while async operations
(Priority 3) complete in the background. No loading spinners. No broken states.

---

## 4. Five Input Methods

### 4.1 Auto (Favicon)

Triggered automatically when an item of type `url` is saved without a custom icon.

```typescript
// icon.service.ts
async function fetchAndCacheFavicon(url: string): Promise<string> {
  const domain = new URL(url).hostname;
  const cached = db.getIconCache(domain);

  // Return cached path if valid
  if (cached && fileExists(cached.localPath)) {
    return cached.localPath;
  }

  // Fetch from Google Favicons API
  const apiUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const buffer = await fetchImageBuffer(apiUrl);

  // Validate response is a real image (not Google's blank 16px fallback)
  if (!isValidFavicon(buffer)) {
    db.markIconCacheInvalid(domain);
    return getGenericIcon('url');
  }

  // Save locally
  const filename = `${hashDomain(domain)}.png`;
  const localPath = `assets/favicons/${filename}`;
  writeFileSync(resolveAppPath(localPath), buffer);

  // Cache the mapping
  db.upsertIconCache({ domain, localPath, fetchedAt: now(), isValid: 1 });
  return localPath;
}
```

**Validation:** Google returns a blank 16×16 grey PNG when favicon not found.
Detect this by checking: file size < 500 bytes → treat as invalid, use fallback.

---

### 4.2 Emoji

User types or picks any emoji character. Stored as plain UTF-8 text in DB.
Zero file size. Rendered as text node, not `<img>`.

```typescript
// DB storage
icon_path:   '🚀'           // emoji char stored directly
icon_source: 'emoji'

// Renderer
{item.iconSource === 'emoji'
  ? <span className="text-base leading-none">{item.iconPath}</span>
  : <img src={resolvedLocalPath} ... />
}
```

No file created. No disk I/O. Instant render.

---

### 4.3 Built-in Library (Lucide Icons)

~200 curated Lucide icons bundled with the app. Searchable by name.
Stored as icon name string, rendered as React component.

```typescript
// DB storage
icon_path:   'Globe'         // Lucide component name
icon_source: 'library'

// Renderer — dynamic Lucide component
import * as Icons from 'lucide-react';
const IconComponent = Icons[item.iconPath as keyof typeof Icons];
<IconComponent size={16} color="var(--text-secondary)" />
```

Zero file I/O. Zero network. Pure bundle reference.

**Curated library categories:**
- Development: `Code`, `Terminal`, `GitBranch`, `Database`, `Server`, `Bug`
- Files: `Folder`, `File`, `FileCode`, `Archive`, `Package`
- Web: `Globe`, `Link`, `Chrome`, `Wifi`, `Cloud`
- Tools: `Settings`, `Wrench`, `Hammer`, `Zap`, `Key`
- Media: `Image`, `Video`, `Music`, `Camera`
- Communication: `Mail`, `MessageSquare`, `Bell`, `Send`
- UI: `Home`, `Star`, `Bookmark`, `Heart`, `Flag`, `Tag`
- Arrows/Nav: `ArrowRight`, `ExternalLink`, `Download`, `Upload`

---

### 4.4 Upload (Local File)

User picks a local `.svg`, `.png`, `.jpg`, or `.ico` file via file picker
or drag-and-drop. File is copied into app's assets folder at save time.

```typescript
async function saveUploadedIcon(sourcePath: string): Promise<string> {
  const ext = path.extname(sourcePath).toLowerCase();
  const allowed = ['.svg', '.png', '.jpg', '.jpeg', '.ico'];

  if (!allowed.includes(ext)) throw new Error('Unsupported format');

  // Normalize: convert .ico and .jpg to .png for consistency
  // .svg files kept as-is (smaller, scalable)
  const normalized = ext === '.svg'
    ? await copySvg(sourcePath)
    : await convertToPng(sourcePath);   // use sharp or jimp

  const filename = `${uuid()}.${ext === '.svg' ? 'svg' : 'png'}`;
  const localPath = `assets/icons/${filename}`;
  writeFileSync(resolveAppPath(localPath), normalized);

  return localPath;
}
```

**Accepted formats:**

| Format | Handling |
|---|---|
| `.svg` | Copied as-is, rendered as `<img>` (safe, no script execution) |
| `.png` | Copied as-is |
| `.jpg` / `.jpeg` | Converted to PNG |
| `.ico` | First frame extracted, converted to PNG |

---

### 4.5 URL (Remote Image)

User pastes any direct image URL. Downloaded once at save time,
saved locally. Never fetched again.

```typescript
async function saveIconFromUrl(imageUrl: string): Promise<string> {
  const buffer = await fetchImageBuffer(imageUrl);

  // Detect format from Content-Type or magic bytes
  const format = detectImageFormat(buffer);   // 'png' | 'jpg' | 'svg' | 'ico'
  const normalized = await normalizeToPng(buffer, format);

  const filename = `${uuid()}.png`;
  const localPath = `assets/icons/${filename}`;
  writeFileSync(resolveAppPath(localPath), normalized);

  return localPath;
}
```

Live preview shown in `IconPicker` before confirming — fetches to memory first,
only writes to disk on "Save" confirmation.

---

### 4.6 Base64

User pastes a base64 encoded image string (with or without data URI prefix).
Decoded and written to disk at save time.

```typescript
async function saveBase64Icon(base64: string): Promise<string> {
  // Strip data URI prefix if present: "data:image/png;base64,..."
  const raw = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');

  const format = detectImageFormat(buffer);
  const normalized = await normalizeToPng(buffer, format);

  const filename = `${uuid()}.png`;
  const localPath = `assets/icons/${filename}`;
  writeFileSync(resolveAppPath(localPath), normalized);

  return localPath;
}
```

---

## 5. IconPicker Component Specification

```
┌─────────────────────────────────────────────────┐
│  Choose Icon                              [✕]   │
│  ─────────────────────────────────────────────  │
│  [Auto] [😀 Emoji] [⊞ Library] [↑ Upload]      │
│  [🔗 URL] [{ } Base64]                          │
│  ─────────────────────────────────────────────  │
│                                                 │
│  [Live preview — 48×48px]                       │
│                                                 │
│  [Tab-specific input area]                      │
│                                                 │
│  ─────────────────────────────────────────────  │
│  [Cancel]                          [Use Icon]   │
└─────────────────────────────────────────────────┘
```

**Tab behaviors:**

| Tab | Input Area |
|---|---|
| Auto | Read-only current icon preview + "Reset to auto" button |
| Emoji | Search input + scrollable emoji grid (grouped by category) |
| Library | Search input + icon name grid (Lucide icons, 6-col) |
| Upload | Drag-and-drop zone + "Browse" button + format hint |
| URL | Text input + live preview (fetches on blur/enter) |
| Base64 | Textarea + live preview (decodes on input) |

**Rules:**
- "Use Icon" button disabled until valid icon selected/loaded
- Live preview always shows 48×48px centered in a rounded square
- Invalid inputs show inline error (red border + message), not a toast
- Cancel discards all changes, no disk write occurs

---

## 6. Export / Import Handling

### Export
All icon files bundled into the ZIP export:

```
command-center-export-2026-03-07.zip
├── config.json                    ← all DB data as JSON
└── assets/
    ├── icons/
    │   ├── abc123.png
    │   └── def456.svg
    └── favicons/
        ├── a1b2c3d4.png           ← github.com favicon
        └── e5f6g7h8.png           ← notion.so favicon
```

All paths in `config.json` are **relative** (e.g. `assets/icons/abc123.png`).
Never absolute. Works on any machine.

### Import (ZIP)
```
1. Extract ZIP to temp folder
2. Copy assets/ to %APPDATA%\Command-Center\assets\
3. Parse config.json
4. Conflict resolution:
   - "Replace All"        → drop existing DB, import fresh
   - "Keep Existing"      → merge, skip duplicate item IDs
5. Rebuild icon_cache table from imported favicons folder
6. Clean up temp folder
```

### Import (JSON only)
```
1. Parse config.json
2. Import all groups, cards, items, settings
3. Icons: attempt to re-fetch favicons for URL items
4. Custom icons: show as generic fallback (file not available)
5. User notified: "X custom icons could not be restored.
   Re-assign them manually or import from a ZIP backup."
```

---

## 7. Runtime File Validation

On every icon load in `ItemRow`, `CardHeader`, `GroupPill`:

```typescript
function useResolvedIcon(iconPath: string, iconSource: IconSource, itemType: ItemType) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(iconPath);

  useEffect(() => {
    if (iconSource === 'emoji' || iconSource === 'library') return; // no file needed

    window.api.icons.resolve(iconPath).then(({ resolvedPath }) => {
      setResolvedSrc(resolvedPath);
    });
  }, [iconPath]);

  return resolvedSrc;
}
```

`icons:resolve` IPC handler in main process:
```typescript
1. Check if file exists at localPath
2. If yes → return localPath
3. If no + source = 'favicon' → re-fetch favicon, return new path
4. If no + source = 'custom' → return generic type icon path
5. If no + source = 'auto' → return generic type icon path
```

**Result:** No broken `<img>` tags. Ever. Fallback always served synchronously
while async re-fetch runs in background.

---

## 8. Supported Formats Summary

| Format | Input Methods | Storage | Render |
|---|---|---|---|
| PNG | Upload, URL, Base64, Favicon | Local file | `<img>` |
| SVG | Upload, Library (as component) | Local file / bundle ref | `<img>` / React component |
| JPG/JPEG | Upload, URL, Base64 | Converted → PNG | `<img>` |
| ICO | Upload | First frame → PNG | `<img>` |
| Emoji | Emoji picker | UTF-8 text in DB | `<span>` |
| Lucide | Library picker | Component name in DB | React component |

---

*See also: `DATA_FLOW.md` for how icon paths flow through IPC and DB layers.*
