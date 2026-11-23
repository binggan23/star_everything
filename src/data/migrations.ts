import { HOME_FOLDER_ID, HOME_FOLDER_NAME } from '../domain/collection';

export type MigrationColumn = {
  table: string;
  column: string;
  definition: string;
};

export type Migration = {
  version: number;
  statements: readonly string[];
  /** Columns added after the table already exists; applied only when missing. */
  columns?: readonly MigrationColumn[];
};

/**
 * Ordered schema migrations. Every statement is safe to re-run, so a migration that was
 * interrupted before its version was recorded can be applied again.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders (id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      )`,
      `INSERT OR IGNORE INTO folders (id, name, parent_id, created_at)
        VALUES ('${HOME_FOLDER_ID}', '${HOME_FOLDER_NAME}', NULL, '1970-01-01T00:00:00.000Z')`,
      `CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        url TEXT,
        author TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (url IS NOT NULL OR author IS NOT NULL)
      )`,
      `CREATE TABLE IF NOT EXISTS entry_folders (
        entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
        folder_id TEXT NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, folder_id)
      )`,
      `CREATE INDEX IF NOT EXISTS entry_folders_folder_id ON entry_folders (folder_id)`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS platform_labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS platform_labels_name_nocase
        ON platform_labels (name COLLATE NOCASE)`,
      `INSERT OR IGNORE INTO platform_labels (id, name, created_at) VALUES
        ('platform-bilibili', 'Bilibili', '1970-01-01T00:00:00.000Z'),
        ('platform-douyin', '抖音', '1970-01-01T00:00:00.000Z'),
        ('platform-xiaohongshu', '小红书', '1970-01-01T00:00:00.000Z')`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS content_labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS content_labels_name_nocase
        ON content_labels (name COLLATE NOCASE)`,
      `CREATE TABLE IF NOT EXISTS entry_content_labels (
        entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES content_labels (id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, label_id)
      )`,
      `CREATE INDEX IF NOT EXISTS entry_content_labels_label_id
        ON entry_content_labels (label_id)`,
    ],
    columns: [
      { table: 'entries', column: 'title', definition: 'TEXT' },
      {
        table: 'entries',
        column: 'platform_label_id',
        definition: 'TEXT REFERENCES platform_labels (id) ON DELETE SET NULL',
      },
    ],
  },
];
