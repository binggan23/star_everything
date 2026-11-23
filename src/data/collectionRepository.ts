import {
  collectFolderSubtree,
  folderPath,
  HOME_FOLDER_ID,
  normalizeOptional,
} from '../domain/collection';
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
  folderIds: string[];
};

export type EntryQuery = {
  /** Selected collections; entries in any of their descendants also match. */
  folderIds?: readonly string[];
  /** Case-insensitive substring over URL, author, and collection paths. */
  search?: string;
};

export type EntryDraft = {
  url: string;
  author: string;
  /** Omit to keep the saved memberships (or default to Home for a new entry). */
  folderIds?: readonly string[];
};

export type SaveErrorCode = 'URL_OR_AUTHOR_REQUIRED' | 'ENTRY_NOT_FOUND';

export type SaveResult = { ok: true; entry: Entry } | { ok: false; error: SaveErrorCode };

export type FolderErrorCode = 'NAME_REQUIRED' | 'FOLDER_NOT_FOUND' | 'INVALID_MOVE';

export type FolderResult = { ok: true; folder: Folder } | { ok: false; error: FolderErrorCode };

export interface CollectionRepository {
  /** Applies pending schema migrations. Safe to call more than once. */
  init(): Promise<void>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string, parentId: string): Promise<FolderResult>;
  renameFolder(id: string, name: string): Promise<FolderResult>;
  moveFolder(id: string, parentId: string): Promise<FolderResult>;
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

type MembershipRow = { entry_id: string; folder_id: string };

const ENTRY_COLUMNS = 'e.id, e.url, e.author, e.created_at, e.updated_at';

const toFolder = (row: FolderRow): Folder => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
});

function requestedFolderIds(folderIds: readonly string[] | undefined): string[] {
  const unique = [...new Set(folderIds ?? [])].filter((id) => id !== '');
  return unique.length > 0 ? unique : [HOME_FOLDER_ID];
}

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

    async createFolder(name, parentId) {
      const trimmed = name.trim();
      if (trimmed === '') return { ok: false, error: 'NAME_REQUIRED' };

      const [parent] = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders WHERE id = ?',
        [parentId],
      );
      if (parent === undefined) return { ok: false, error: 'FOLDER_NOT_FOUND' };

      const folder: Folder = { id: createId(), name: trimmed, parentId };
      await driver.execute(
        'INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)',
        [folder.id, folder.name, folder.parentId, new Date().toISOString()],
      );

      return { ok: true, folder };
    },

    async renameFolder(id, name) {
      const trimmed = name.trim();
      if (trimmed === '') return { ok: false, error: 'NAME_REQUIRED' };

      await driver.execute('UPDATE folders SET name = ? WHERE id = ?', [trimmed, id]);
      const [row] = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders WHERE id = ?',
        [id],
      );
      if (row === undefined) return { ok: false, error: 'FOLDER_NOT_FOUND' };

      return { ok: true, folder: { id: row.id, name: row.name, parentId: row.parent_id } };
    },

    async moveFolder(id, parentId) {
      const rows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      const folders = rows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
      }));
      const folder = folders.find((candidate) => candidate.id === id);
      const parent = folders.find((candidate) => candidate.id === parentId);
      if (folder === undefined || parent === undefined) {
        return { ok: false, error: 'FOLDER_NOT_FOUND' };
      }

      if (id === HOME_FOLDER_ID || collectFolderSubtree(folders, [id]).has(parentId)) {
        return { ok: false, error: 'INVALID_MOVE' };
      }

      await driver.execute('UPDATE folders SET parent_id = ? WHERE id = ?', [parentId, id]);
      return { ok: true, folder: { ...folder, parentId } };
    },

    async listEntries(query = {}) {
      const folderRows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      const folders = folderRows.map(toFolder);
      const rowEntries = await driver.select<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM entries e ORDER BY e.created_at DESC, e.rowid DESC`,
      );
      const memberships = await driver.select<MembershipRow>(
        'SELECT entry_id, folder_id FROM entry_folders',
      );
      const folderIdsByEntry = new Map<string, string[]>();
      for (const membership of memberships) {
        const folderIds = folderIdsByEntry.get(membership.entry_id) ?? [];
        folderIds.push(membership.folder_id);
        folderIdsByEntry.set(membership.entry_id, folderIds);
      }

      const included =
        query.folderIds === undefined ? null : collectFolderSubtree(folders, query.folderIds);
      const entries = rowEntries.map<Entry>((row) => ({
        id: row.id,
        url: row.url,
        author: row.author,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        folderIds: folderIdsByEntry.get(row.id) ?? [],
      }));

      const pathsByFolder = new Map(
        folders.map((folder) => [folder.id, folderPath(folders, folder.id).toLowerCase()]),
      );
      const term = query.search?.trim().toLowerCase() ?? '';

      return entries.filter((entry) => {
        if (included !== null && !entry.folderIds.some((id) => included.has(id))) return false;
        if (term === '') return true;

        const texts = [
          entry.url ?? '',
          entry.author ?? '',
          ...entry.folderIds.map((id) => pathsByFolder.get(id) ?? ''),
        ];
        return texts.some((text) => text.toLowerCase().includes(term));
      });
    },

    async createEntry(draft) {
      const url = normalizeOptional(draft.url);
      const author = normalizeOptional(draft.author);
      if (url === null && author === null) {
        return { ok: false, error: 'URL_OR_AUTHOR_REQUIRED' };
      }

      const id = createId();
      const now = new Date().toISOString();
      const entry: Entry = {
        id,
        url,
        author,
        createdAt: now,
        updatedAt: now,
        folderIds: requestedFolderIds(draft.folderIds),
      };

      await driver.execute(
        'INSERT INTO entries (id, url, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [entry.id, entry.url, entry.author, entry.createdAt, entry.updatedAt],
      );
      for (const folderId of entry.folderIds) {
        await driver.execute(
          'INSERT OR IGNORE INTO entry_folders (entry_id, folder_id) VALUES (?, ?)',
          [entry.id, folderId],
        );
      }

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
      if (draft.folderIds !== undefined) {
        await driver.execute('DELETE FROM entry_folders WHERE entry_id = ?', [id]);
        for (const folderId of requestedFolderIds(draft.folderIds)) {
          await driver.execute(
            'INSERT OR IGNORE INTO entry_folders (entry_id, folder_id) VALUES (?, ?)',
            [id, folderId],
          );
        }
      }

      const [row] = await driver.select<EntryRow>(
        `SELECT ${ENTRY_COLUMNS} FROM entries e WHERE e.id = ?`,
        [id],
      );
      if (row === undefined) return { ok: false, error: 'ENTRY_NOT_FOUND' };

      const memberships = await driver.select<MembershipRow>(
        'SELECT entry_id, folder_id FROM entry_folders WHERE entry_id = ?',
        [id],
      );

      return {
        ok: true,
        entry: {
          id: row.id,
          url: row.url,
          author: row.author,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          folderIds: memberships.map((membership) => membership.folder_id),
        },
      };
    },
  };
}
