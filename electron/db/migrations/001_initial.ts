import type Database from 'better-sqlite3'

// Migration 001 - full initial schema
// user_version is checked before running - only executes once per DB lifetime

const MIGRATION_VERSION = 1

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion >= MIGRATION_VERSION) return // already applied

  // Run entire initial schema in a single transaction - all or nothing
  db.transaction(() => {
    db.exec(`
      -- =====================================================
      -- GROUPS
      -- =====================================================
      CREATE TABLE IF NOT EXISTS groups (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        icon         TEXT NOT NULL DEFAULT '',
        accent_color TEXT NOT NULL DEFAULT '#6366f1',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );

      -- =====================================================
      -- CARDS
      -- =====================================================
      CREATE TABLE IF NOT EXISTS cards (
        id         TEXT PRIMARY KEY,
        group_id   TEXT NOT NULL,
        name       TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      -- =====================================================
      -- ITEMS
      -- =====================================================
      CREATE TABLE IF NOT EXISTS items (
        id           TEXT PRIMARY KEY,
        card_id      TEXT NOT NULL,
        label        TEXT NOT NULL,
        path         TEXT NOT NULL,
        type         TEXT NOT NULL,
        icon_path    TEXT NOT NULL DEFAULT '',
        icon_source  TEXT NOT NULL DEFAULT 'auto',
        note         TEXT NOT NULL DEFAULT '',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        launch_count INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
      );

      -- =====================================================
      -- TAGS
      -- =====================================================
      CREATE TABLE IF NOT EXISTS tags (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      -- =====================================================
      -- ITEM_TAGS (junction)
      -- =====================================================
      CREATE TABLE IF NOT EXISTS item_tags (
        item_id TEXT NOT NULL,
        tag_id  TEXT NOT NULL,
        PRIMARY KEY (item_id, tag_id),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
      );

      -- =====================================================
      -- RECENTS (max 20, enforced by app logic)
      -- =====================================================
      CREATE TABLE IF NOT EXISTS recents (
        id          TEXT PRIMARY KEY,
        item_id     TEXT NOT NULL,
        launched_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      -- =====================================================
      -- FAVORITES
      -- =====================================================
      CREATE TABLE IF NOT EXISTS favorites (
        id         TEXT PRIMARY KEY,
        item_id    TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        pinned_at  TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      -- =====================================================
      -- SETTINGS (singleton row, id = 'app')
      -- =====================================================
      CREATE TABLE IF NOT EXISTS settings (
        id                TEXT PRIMARY KEY DEFAULT 'app',
        theme             TEXT NOT NULL DEFAULT 'dark',
        font_size         TEXT NOT NULL DEFAULT 'medium',
        density           TEXT NOT NULL DEFAULT 'comfortable',
        launch_on_startup INTEGER NOT NULL DEFAULT 1,
        minimize_to_tray  INTEGER NOT NULL DEFAULT 1,
        webview_position  TEXT NOT NULL DEFAULT 'right',
        webview_width     INTEGER NOT NULL DEFAULT 480,
        last_active_group TEXT NOT NULL DEFAULT '',
        updated_at        TEXT NOT NULL
      );

      -- =====================================================
      -- ICON_CACHE
      -- =====================================================
      CREATE TABLE IF NOT EXISTS icon_cache (
        id         TEXT PRIMARY KEY,
        domain     TEXT NOT NULL UNIQUE,
        local_path TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        is_valid   INTEGER NOT NULL DEFAULT 1
      );

      -- =====================================================
      -- INDEXES
      -- =====================================================
      CREATE INDEX IF NOT EXISTS idx_groups_sort      ON groups(sort_order);
      CREATE INDEX IF NOT EXISTS idx_cards_group      ON cards(group_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_items_card       ON items(card_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_item_tags_item   ON item_tags(item_id);
      CREATE INDEX IF NOT EXISTS idx_recents_launched ON recents(launched_at DESC);
      CREATE INDEX IF NOT EXISTS idx_favorites_order  ON favorites(sort_order);
      CREATE INDEX IF NOT EXISTS idx_icon_cache_domain ON icon_cache(domain);

      -- =====================================================
      -- FTS5 VIRTUAL TABLE + SYNC TRIGGERS
      -- =====================================================
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        label,
        path,
        note,
        content='items',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS items_fts_insert AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, label, path, note)
        VALUES (new.rowid, new.label, new.path, new.note);
      END;

      CREATE TRIGGER IF NOT EXISTS items_fts_update AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, label, path, note)
        VALUES ('delete', old.rowid, old.label, old.path, old.note);
        INSERT INTO items_fts(rowid, label, path, note)
        VALUES (new.rowid, new.label, new.path, new.note);
      END;

      CREATE TRIGGER IF NOT EXISTS items_fts_delete AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, label, path, note)
        VALUES ('delete', old.rowid, old.label, old.path, old.note);
      END;

      -- =====================================================
      -- SEED SETTINGS ROW (first run only)
      -- =====================================================
      INSERT OR IGNORE INTO settings (id, updated_at)
      VALUES ('app', datetime('now'));
    `)

    // Stamp the version - prevents re-running this migration
    db.pragma(`user_version = ${MIGRATION_VERSION}`)
  })()
}
