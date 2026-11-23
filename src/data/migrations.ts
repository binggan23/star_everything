import { HOME_FOLDER_ID, HOME_FOLDER_NAME } from '../domain/collection';

export type Migration = {
  version: number;
  statements: readonly string[];
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
];
