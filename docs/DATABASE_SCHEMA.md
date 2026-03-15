# DATABASE_SCHEMA.md
# Command-Center — Database Schema

> **Version:** 0.1.0-beta  
> **Last Updated:** 2026-03-15  
> **Engine:** SQLite via `better-sqlite3`  
> **Location:** `%APPDATA%\Command-Center\command-center.db`  

---

## 1. Entity Overview

| Entity | Table | Description |
|---|---|---|
| Group | `groups` | Sidebar pill tabs — top-level organizational unit |
| Card | `cards` | Mini file-manager containers within a group |
| Item | `items` | Individual launchable entries inside a card |
| Tag | `tags` | Free-form labels attached to items |
| Item Tag | `item_tags` | Junction table — item ↔ tag many-to-many |
| Recent | `recents` | Auto-tracked recently launched items |
| Favorite | `favorites` | Manually pinned items for home screen |
| Settings | `settings` | Single-row app-wide settings store |
| Icon Cache | `icon_cache` | Maps URLs/domains to local favicon paths |

---

## 2. Table Definitions

---

### 2.1 `groups`

Represents a sidebar group pill tab.

```sql
CREATE TABLE groups (
  id          TEXT PRIMARY KEY,          -- UUID v4
  name        TEXT NOT NULL,             -- Display label (renamable)
  icon        TEXT NOT NULL DEFAULT '',  -- Local icon path or emoji char
  accent_color TEXT NOT NULL DEFAULT '#6366f1', -- Hex color string
  sort_order  INTEGER NOT NULL DEFAULT 0, -- Drag-reorder position
  created_at  TEXT NOT NULL,             -- ISO 8601 timestamp
  updated_at  TEXT NOT NULL              -- ISO 8601 timestamp
);
```

---

### 2.2 `cards`

Represents a card (mini file-manager) within a group.

```sql
CREATE TABLE cards (
  id          TEXT PRIMARY KEY,          -- UUID v4
  group_id    TEXT NOT NULL,             -- FK → groups.id
  name        TEXT NOT NULL,             -- Card title (renamable)
  icon        TEXT NOT NULL DEFAULT '',  -- Local icon path or emoji char
  sort_order  INTEGER NOT NULL DEFAULT 0, -- Position within group grid
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,

  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
```

---

### 2.3 `items`

Represents a single launchable entry inside a card.

```sql
CREATE TABLE items (
  id            TEXT PRIMARY KEY,        -- UUID v4
  card_id       TEXT NOT NULL,           -- FK → cards.id
  label         TEXT NOT NULL,           -- Display name
  path          TEXT NOT NULL,           -- URL, file path, script path, SSH string
  type          TEXT NOT NULL,           -- 'url' | 'software' | 'folder' | 'command' | 'action'
  icon_path     TEXT NOT NULL DEFAULT '', -- Relative path to local icon file
  icon_source   TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'favicon' | 'custom' | 'emoji' | 'library'
  note          TEXT NOT NULL DEFAULT '', -- Up to 450-word markdown note
  -- command-type extra fields
  command_args  TEXT NOT NULL DEFAULT '', -- CLI arguments (e.g. -NoProfile -Command ...)
  working_dir   TEXT NOT NULL DEFAULT '', -- Working directory (optional; default: Documents)
  -- action-type extra field
  action_id     TEXT NOT NULL DEFAULT '', -- Predefined action key (e.g. 'lock_screen') or 'custom'
  icon_color    TEXT NOT NULL DEFAULT '', -- Hex e.g. '#6366f1' or '' — library icons only (migration 003)
  sort_order    INTEGER NOT NULL DEFAULT 0,
  launch_count  INTEGER NOT NULL DEFAULT 0, -- Total times launched (for recents weight)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,

  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
```

**Item type values:**
| Value | Meaning |
|---|---|
| `url` | Web URL — opens in webview or browser |
| `software` | Local executable or `.bat` file (was `exe`) |
| `folder` | Local folder path |
| `command` | Terminal command — launches via spawn with args + working dir (was `script`) |
| `action` | Predefined Windows system action OR user-defined custom action (was `ssh`) |

**command type field usage:**
| Column | Usage |
|---|---|
| `path` | The command executable (e.g. `powershell`, `cmd`, `wt`, `node`) |
| `command_args` | CLI arguments string (e.g. `-NoProfile -Command "..."`) |
| `working_dir` | Working directory path (optional; empty = user's Documents folder) |

**action type field usage:**
| Column | Usage |
|---|---|
| `action_id` | Predefined key (e.g. `lock_screen`, `screenshot`) OR `custom:<shell_cmd>` for user-added actions |
| `path` | Unused for predefined actions; stores shell command for custom actions (mirrors action_id) |

**Predefined action_id values (v0.1.0-beta — 11 values):**
`screenshot` `lock_screen` `sleep` `shut_down` `restart` `task_manager`
`calculator` `empty_recycle_bin` `clipboard` `run` `custom`

---

### 2.4 `tags`

Free-form text labels, shared across items.

```sql
CREATE TABLE tags (
  id    TEXT PRIMARY KEY,               -- UUID v4
  name  TEXT NOT NULL UNIQUE            -- Tag label (e.g. 'work', 'dev', 'urgent')
);
```

---

### 2.5 `item_tags`

Junction table — many-to-many between items and tags.

```sql
CREATE TABLE item_tags (
  item_id  TEXT NOT NULL,               -- FK → items.id
  tag_id   TEXT NOT NULL,               -- FK → tags.id

  PRIMARY KEY (item_id, tag_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

---

### 2.6 `recents`

Auto-tracked recently launched items. Max 20 rows enforced by app logic.

```sql
CREATE TABLE recents (
  id          TEXT PRIMARY KEY,         -- UUID v4
  item_id     TEXT NOT NULL,            -- FK → items.id
  launched_at TEXT NOT NULL,            -- ISO 8601 timestamp of last launch

  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

> **Rule:** On every launch, upsert by `item_id` (update `launched_at`). After insert, delete oldest rows beyond 20. Ordered by `launched_at DESC`.

---

### 2.7 `favorites`

Manually pinned items shown on home screen left panel.

```sql
CREATE TABLE favorites (
  id          TEXT PRIMARY KEY,         -- UUID v4
  item_id     TEXT NOT NULL UNIQUE,     -- FK → items.id (one pin per item)
  sort_order  INTEGER NOT NULL DEFAULT 0, -- User-defined order on home screen
  pinned_at   TEXT NOT NULL,            -- ISO 8601 timestamp

  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

---

### 2.8 `settings`

Single-row table. App always reads row with `id = 'app'`.

```sql
CREATE TABLE settings (
  id                TEXT PRIMARY KEY DEFAULT 'app',
  theme             TEXT NOT NULL DEFAULT 'dark',     -- 'dark' | 'light'
  font_size         TEXT NOT NULL DEFAULT 'medium',   -- 'small' | 'medium' | 'large'
  density           TEXT NOT NULL DEFAULT 'comfortable', -- 'compact' | 'comfortable'
  launch_on_startup INTEGER NOT NULL DEFAULT 1,       -- boolean (0 | 1)
  minimize_to_tray  INTEGER NOT NULL DEFAULT 1,       -- boolean (0 | 1)
  webview_position  TEXT NOT NULL DEFAULT 'right',    -- 'right' | 'bottom'
  webview_width     INTEGER NOT NULL DEFAULT 480,     -- px, last used width
  last_active_group TEXT NOT NULL DEFAULT '',         -- FK → groups.id (restore on launch)
  global_shortcut   TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+Space', -- migration 004
  updated_at        TEXT NOT NULL
);
```

---

### 2.9 `icon_cache`

Maps domain/URL to locally saved favicon path. Prevents redundant fetches.

```sql
CREATE TABLE icon_cache (
  id           TEXT PRIMARY KEY,        -- UUID v4
  domain       TEXT NOT NULL UNIQUE,    -- e.g. 'github.com'
  local_path   TEXT NOT NULL,           -- Relative path: 'assets/favicons/abc.png'
  fetched_at   TEXT NOT NULL,           -- ISO 8601 — for cache invalidation
  is_valid     INTEGER NOT NULL DEFAULT 1 -- 0 if known broken, skip fetch
);
```

---

## 3. Indexes

```sql
-- Fast group lookup for sidebar render
CREATE INDEX idx_groups_sort ON groups(sort_order);

-- Fast card lookup by group (main area render)
CREATE INDEX idx_cards_group ON cards(group_id, sort_order);

-- Fast item lookup by card (card list render)
CREATE INDEX idx_items_card ON items(card_id, sort_order);

-- Fast tag lookup per item (note/tag dropdown)
CREATE INDEX idx_item_tags_item ON item_tags(item_id);

-- Fast recents query (home screen right panel)
CREATE INDEX idx_recents_launched ON recents(launched_at DESC);

-- Recents JOIN lookup (migration 005)
CREATE INDEX idx_recents_item ON recents(item_id);

-- Fast favorites query (home screen left panel)
CREATE INDEX idx_favorites_order ON favorites(sort_order);

-- Reverse tag lookup (migration 005)
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);

-- Fast icon cache domain lookup
CREATE INDEX idx_icon_cache_domain ON icon_cache(domain);

-- Full-text search support on items
CREATE VIRTUAL TABLE items_fts USING fts5(
  label,
  path,
  note,
  content='items',
  content_rowid='rowid'
);
```

> **FTS5 Note:** `items_fts` is a virtual full-text search table. Kept in sync via triggers on items INSERT / UPDATE / DELETE. Used as fallback for deep note content search. `fuse.js` handles fuzzy label/tag search in renderer; FTS5 handles note body search in main process.

---

## 4. FTS5 Sync Triggers

```sql
-- Keep FTS index in sync with items table
CREATE TRIGGER items_fts_insert AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, label, path, note)
  VALUES (new.rowid, new.label, new.path, new.note);
END;

CREATE TRIGGER items_fts_update AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, label, path, note)
  VALUES ('delete', old.rowid, old.label, old.path, old.note);
  INSERT INTO items_fts(rowid, label, path, note)
  VALUES (new.rowid, new.label, new.path, new.note);
END;

CREATE TRIGGER items_fts_delete AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, label, path, note)
  VALUES ('delete', old.rowid, old.label, old.path, old.note);
END;
```

---

## 5. Relationships Diagram

```
groups
  │
  └──< cards (group_id)
         │
         └──< items (card_id)
                │
                ├──< item_tags (item_id) >──── tags
                │
                ├──< recents (item_id)
                │
                └──< favorites (item_id)

settings        [singleton row]
icon_cache      [domain → local path]
items_fts       [virtual FTS5 mirror of items]
```

---

## 6. TypeScript Interfaces

Matching types used across main process queries and renderer hooks.

```typescript
// types/index.ts

export type ItemType = 'url' | 'software' | 'folder' | 'command' | 'action';
export type Theme = 'dark' | 'light';
export type FontSize = 'small' | 'medium' | 'large';
export type Density = 'compact' | 'comfortable';
export type IconSource = 'auto' | 'favicon' | 'custom' | 'emoji' | 'library';

// All predefined action keys for ActionType items
export type ActionId =
  | 'screenshot'     | 'lock_screen'    | 'sleep'
  | 'shut_down'      | 'restart'        | 'task_manager'
  | 'calculator'     | 'empty_recycle_bin'
  | 'clipboard'      | 'run'
  | 'custom'  // user-defined — shell cmd stored in `path`

export interface Group {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  groupId: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  cardId: string;
  label: string;
  path: string;          // URL / file path / command name / action shell cmd
  type: ItemType;
  iconPath: string;
  iconSource: IconSource;
  note: string;
  tags: string[];        // resolved from item_tags join
  // command-type extras
  commandArgs: string;   // CLI arguments string (empty for non-command types)
  workingDir: string;    // Working directory (empty = default Documents)
  // action-type extras
  actionId: string;      // ActionId key or 'custom' (empty for non-action types)
  iconColor: string;     // hex e.g. '#6366f1' or '' — library icons only
  sortOrder: number;
  launchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface RecentItem {
  id: string;
  itemId: string;
  item: Item;               // joined
  launchedAt: string;
}

export interface FavoriteItem {
  id: string;
  itemId: string;
  item: Item;               // joined
  sortOrder: number;
  pinnedAt: string;
}

export interface AppSettings {
  theme: Theme;
  fontSize: FontSize;
  density: Density;
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  webviewPosition: 'right' | 'bottom';
  webviewWidth: number;
  lastActiveGroup: string;
  globalShortcut: string;   // accelerator e.g. 'CommandOrControl+Shift+Space'
  updatedAt: string;
}

export interface SearchIndexEntry {
  itemId: string;
  label: string;
  path: string;
  type: ItemType;    // used for icon rendering in search results
  note: string;
  tags: string[];
  cardId: string;
  cardName: string;
  groupId: string;
  groupName: string;
}

// Input types for IPC create/update calls
export interface CreateGroupInput {
  name: string;
  icon: string;
  accentColor: string;
}

export interface UpdateGroupInput extends Partial<CreateGroupInput> {
  id: string;
  sortOrder?: number;
}

export interface CreateCardInput {
  groupId: string;
  name: string;
  icon: string;
}

export interface UpdateCardInput extends Partial<Omit<CreateCardInput, 'groupId'>> {
  id: string;
  sortOrder?: number;
}

export interface CreateItemInput {
  cardId: string;
  label: string;
  path: string;
  type: ItemType;
  iconPath?: string;
  iconSource?: IconSource;
  note?: string;
  tags?: string[];
  commandArgs?: string;    // command type only
  workingDir?: string;     // command type only
  actionId?: string;       // action type only
  iconColor?: string;      // library icons only
}

export interface UpdateItemInput extends Partial<Omit<CreateItemInput, 'cardId'>> {
  id: string;
  sortOrder?: number;
}
```

---

## 7. Key Query Patterns

```typescript
// Get all groups ordered for sidebar
db.prepare(`SELECT * FROM groups ORDER BY sort_order ASC`).all();

// Get cards for a group
db.prepare(`SELECT * FROM cards WHERE group_id = ? ORDER BY sort_order ASC`).all(groupId);

// Get items with tags for a card
db.prepare(`
  SELECT i.*, GROUP_CONCAT(t.name, ',') as tags
  FROM items i
  LEFT JOIN item_tags it ON it.item_id = i.id
  LEFT JOIN tags t ON t.id = it.tag_id
  WHERE i.card_id = ?
  GROUP BY i.id
  ORDER BY i.sort_order ASC
`).all(cardId);

// Get recents (last 20, with item data)
db.prepare(`
  SELECT r.*, i.label, i.path, i.type, i.icon_path
  FROM recents r
  JOIN items i ON i.id = r.item_id
  ORDER BY r.launched_at DESC
  LIMIT 20
`).all();

// Full-text search in notes
db.prepare(`
  SELECT i.id, i.label, i.path, snippet(items_fts, 2, '<b>', '</b>', '...', 20) as excerpt
  FROM items_fts
  JOIN items i ON i.rowid = items_fts.rowid
  WHERE items_fts MATCH ?
`).all(searchQuery);

// Upsert recent on launch
db.prepare(`
  INSERT INTO recents (id, item_id, launched_at)
  VALUES (?, ?, ?)
  ON CONFLICT(item_id) DO UPDATE SET launched_at = excluded.launched_at
`).run(uuid(), itemId, new Date().toISOString());
```

---

## 8. Migration History

All migrations are idempotent — guarded by try/catch, safe to re-run on every `getDb()` call.

| # | File | What it adds |
|---|---|---|
| 001 | `001_initial.ts` | Full initial schema: all tables, indexes, FTS5 virtual table + sync triggers |
| 002 | `002_item_type_refactor.ts` | `command_args`, `working_dir`, `action_id` columns; renames `exe→software`, `script→command`, `ssh→action` |
| 003 | `003_icon_color.ts` | `icon_color TEXT NOT NULL DEFAULT ''` on `items` |
| 004 | `004_global_shortcut.ts` | `global_shortcut TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+Space'` on `settings` |
| 005 | `005_indexes.ts` | `idx_recents_item` on `recents(item_id)` and `idx_item_tags_tag` on `item_tags(tag_id)` |

---

*Next document: → `UI_DESIGN_SPEC.md`*
