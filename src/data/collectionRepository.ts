import { HOME_FOLDER_ID, normalizeOptional } from '../domain/collection';
import { createId } from '../domain/id';
import { migrations } from './migrations';
import type { SqlDriver } from './sqlDriver';

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type Entry = {
  id: string;
  url: string | null;
  author: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntryQuery = {
  folderId?: string;
};

export type EntryDraft = {
  url: string;
  author: string;
};

export type SaveErrorCode = 'URL_OR_AUTHOR_REQUIRED' | 'ENTRY_NOT_FOUND';

export type SaveResult = { ok: true; entry: Entry } | { ok: false; error: SaveErrorCode };

export interface CollectionRepository {
  /** Applies pending schema migrations. Safe to call more than once. */
  init(): Promise<void>;
  listFolders(): Promise<Folder[]>;
  listEntries(query?: EntryQuery): Promise<Entry[]>;
  createEntry(draft: EntryDraft): Promise<SaveResult>;
  updateEntry(id: string, draft: EntryDraft): Promise<SaveResult>;
}

type FolderRow = { id: string; name: string; parent_id: string | null };
type EntryRow = {
  id: string;
  url: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
};

const ENTRY_COLUMNS = 'e.id, e.url, e.author, e.created_at, e.updated_at';

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  url: row.url,
  author: row.author,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createCollectionRepository(driver: SqlDriver): CollectionRepository {
  async function migrate(): Promise<void> {
    const [row] = await driver.select<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = row?.user_version ?? 0;

    for (const migration of migrations) {
      if (migration.version <= currentVersion) continue;
      for (const statement of migration.statements) {
        await driver.execute(statement);
      }
      await driver.execute(`PRAGMA user_version = ${migration.version}`);
    }
  }

  return {
    init: migrate,

    async listFolders() {
      const rows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      return rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id }));
    },

    async listEntries(query = {}) {
      if (query.folderId !== undefined) {
        const rows = await driver.select<EntryRow>(
          `SELECT ${ENTRY_COLUMNS}
           FROM entries e
           JOIN entry_folders ef ON ef.entry_id = e.id
           WHERE ef.folder_id = ?
           ORDER BY e.created_at DESC, e.rowid DESC`,
          [query.folderId],
        );
        return rows.map(toEntry);
      }

      const rows = await driver.select<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM entries e ORDER BY e.created_at DESC, e.rowid DESC`,
      );
      return rows.map(toEntry);
    },

    async createEntry(draft) {
      const url = normalizeOptional(draft.url);
      const author = normalizeOptional(draft.author);
      if (url === null && author === null) {
        return { ok: false, error: 'URL_OR_AUTHOR_REQUIRED' };
      }

      const id = createId();
      const now = new Date().toISOString();
      const entry: Entry = { id, url, author, createdAt: now, updatedAt: now };

      await driver.execute(
        'INSERT INTO entries (id, url, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [entry.id, entry.url, entry.author, entry.createdAt, entry.updatedAt],
      );
      await driver.execute(
        'INSERT OR IGNORE INTO entry_folders (entry_id, folder_id) VALUES (?, ?)',
        [entry.id, HOME_FOLDER_ID],
      );

      return { ok: true, entry };
    },

    async updateEntry(id, draft) {
      const url = normalizeOptional(draft.url);
      const author = normalizeOptional(draft.author);
      if (url === null && author === null) {
        return { ok: false, error: 'URL_OR_AUTHOR_REQUIRED' };
      }

      await driver.execute('UPDATE entries SET url = ?, author = ?, updated_at = ? WHERE id = ?', [
        url,
        author,
        new Date().toISOString(),
        id,
      ]);
      const [row] = await driver.select<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM entries e WHERE e.id = ?`,
        [id],
      );

      return row ? { ok: true, entry: toEntry(row) } : { ok: false, error: 'ENTRY_NOT_FOUND' };
    },
  };
}
