import { collectFolderSubtree, HOME_FOLDER_ID, normalizeOptional } from '../domain/collection';
import { createId } from '../domain/id';
import { parseContentLabels } from '../domain/labels';
import { migrations } from './migrations';
import type { SqlDriver } from './sqlDriver';

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

export type PlatformLabel = {
  id: string;
  name: string;
};

export type ContentLabel = {
  id: string;
  name: string;
};

export type Entry = {
  id: string;
  title: string | null;
  url: string | null;
  author: string | null;
  platformLabelId: string | null;
  platformLabelName: string | null;
  contentLabels: string[];
  createdAt: string;
  updatedAt: string;
  folderIds: string[];
};

export type EntryQuery = {
  /** Selected collections; entries in any of their descendants also match. */
  folderIds?: readonly string[];
};

export type EntryDraft = {
  title: string;
  url: string;
  author: string;
  platformLabelId: string;
  contentLabels: string;
  /** Omit to keep the saved memberships (or default to Home for a new entry). */
  folderIds?: readonly string[];
};

export type SaveErrorCode = 'URL_OR_AUTHOR_REQUIRED' | 'ENTRY_NOT_FOUND';

export type LabelErrorCode = 'LABEL_NAME_REQUIRED' | 'LABEL_NAME_TAKEN' | 'LABEL_NOT_FOUND';

export type SaveResult = { ok: true; entry: Entry } | { ok: false; error: SaveErrorCode };

export type FolderErrorCode = 'NAME_REQUIRED' | 'FOLDER_NOT_FOUND' | 'INVALID_MOVE';

export type FolderResult = { ok: true; folder: Folder } | { ok: false; error: FolderErrorCode };

export type LabelResult = { ok: true; label: PlatformLabel } | { ok: false; error: LabelErrorCode };

export interface CollectionRepository {
  /** Applies pending schema migrations. Safe to call more than once. */
  init(): Promise<void>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string, parentId: string): Promise<FolderResult>;
  renameFolder(id: string, name: string): Promise<FolderResult>;
  moveFolder(id: string, parentId: string): Promise<FolderResult>;
  listPlatformLabels(): Promise<PlatformLabel[]>;
  listContentLabels(): Promise<ContentLabel[]>;
  createPlatformLabel(name: string): Promise<LabelResult>;
  renamePlatformLabel(id: string, name: string): Promise<LabelResult>;
  deletePlatformLabel(id: string): Promise<void>;
  listEntries(query?: EntryQuery): Promise<Entry[]>;
  createEntry(draft: EntryDraft): Promise<SaveResult>;
  updateEntry(id: string, draft: EntryDraft): Promise<SaveResult>;
}

type FolderRow = { id: string; name: string; parent_id: string | null };
type EntryRow = {
  id: string;
  title: string | null;
  url: string | null;
  author: string | null;
  platform_label_id: string | null;
  platform_label_name: string | null;
  created_at: string;
  updated_at: string;
};

type MembershipRow = { entry_id: string; folder_id: string };

const ENTRY_SELECT = `
  SELECT e.id, e.title, e.url, e.author, e.platform_label_id,
         p.name AS platform_label_name, e.created_at, e.updated_at
  FROM entries e
  LEFT JOIN platform_labels p ON p.id = e.platform_label_id`;

const toFolder = (row: FolderRow): Folder => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
});

const toEntry = (row: EntryRow, contentLabels: string[], folderIds: string[]): Entry => ({
  id: row.id,
  title: row.title,
  url: row.url,
  author: row.author,
  platformLabelId: row.platform_label_id,
  platformLabelName: row.platform_label_name,
  contentLabels,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  folderIds,
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
      for (const column of migration.columns ?? []) {
        const columns = await driver.select<{ name: string }>(`PRAGMA table_info(${column.table})`);
        if (!columns.some((existing) => existing.name === column.column)) {
          await driver.execute(
            `ALTER TABLE ${column.table} ADD COLUMN ${column.column} ${column.definition}`,
          );
        }
      }
      await driver.execute(`PRAGMA user_version = ${migration.version}`);
    }
  }

  async function contentLabelsFor(entryIds: readonly string[]): Promise<Map<string, string[]>> {
    const labels = new Map<string, string[]>();
    if (entryIds.length === 0) return labels;

    const placeholders = entryIds.map(() => '?').join(', ');
    const rows = await driver.select<{ entry_id: string; name: string }>(
      `SELECT ecl.entry_id, c.name
       FROM entry_content_labels ecl
       JOIN content_labels c ON c.id = ecl.label_id
       WHERE ecl.entry_id IN (${placeholders})
       ORDER BY c.created_at, c.rowid`,
      entryIds,
    );

    for (const row of rows) {
      const names = labels.get(row.entry_id);
      if (names) names.push(row.name);
      else labels.set(row.entry_id, [row.name]);
    }
    return labels;
  }

  async function resolvePlatformLabel(value: string): Promise<PlatformLabel | null> {
    const id = normalizeOptional(value);
    if (id === null) return null;
    const [existing] = await driver.select<{ id: string; name: string }>(
      'SELECT id, name FROM platform_labels WHERE id = ?',
      [id],
    );
    return existing ? { id: existing.id, name: existing.name } : null;
  }

  async function syncContentLabels(entryId: string, raw: string): Promise<void> {
    const names = parseContentLabels(raw);
    await driver.execute('DELETE FROM entry_content_labels WHERE entry_id = ?', [entryId]);

    for (const name of names) {
      const [existing] = await driver.select<{ id: string }>(
        'SELECT id FROM content_labels WHERE name = ? COLLATE NOCASE',
        [name],
      );
      let labelId = existing?.id;
      if (labelId === undefined) {
        labelId = createId();
        await driver.execute('INSERT INTO content_labels (id, name, created_at) VALUES (?, ?, ?)', [
          labelId,
          name,
          new Date().toISOString(),
        ]);
      }
      await driver.execute(
        'INSERT OR IGNORE INTO entry_content_labels (entry_id, label_id) VALUES (?, ?)',
        [entryId, labelId],
      );
    }

    await driver.execute(
      `DELETE FROM content_labels
       WHERE id NOT IN (SELECT label_id FROM entry_content_labels)`,
    );
  }

  async function membershipsFor(entryIds: readonly string[]): Promise<Map<string, string[]>> {
    const memberships = new Map<string, string[]>();
    if (entryIds.length === 0) return memberships;

    const placeholders = entryIds.map(() => '?').join(', ');
    const rows = await driver.select<MembershipRow>(
      `SELECT entry_id, folder_id FROM entry_folders WHERE entry_id IN (${placeholders})`,
      entryIds,
    );

    for (const row of rows) {
      const folderIds = memberships.get(row.entry_id);
      if (folderIds) folderIds.push(row.folder_id);
      else memberships.set(row.entry_id, [row.folder_id]);
    }
    return memberships;
  }

  async function replaceMemberships(entryId: string, folderIds: readonly string[]): Promise<void> {
    await driver.execute('DELETE FROM entry_folders WHERE entry_id = ?', [entryId]);
    for (const folderId of requestedFolderIds(folderIds)) {
      await driver.execute(
        'INSERT OR IGNORE INTO entry_folders (entry_id, folder_id) VALUES (?, ?)',
        [entryId, folderId],
      );
    }
  }

  async function loadEntries(folderIds: readonly string[]): Promise<Entry[]> {
    const rows = await driver.select<EntryRow>(
      `${ENTRY_SELECT} WHERE e.id IN (${folderIds.map(() => '?').join(', ')})`,
      folderIds,
    );
    const [contentLabels, memberships] = await Promise.all([
      contentLabelsFor(rows.map((row) => row.id)),
      membershipsFor(rows.map((row) => row.id)),
    ]);

    return rows.map((row) =>
      toEntry(row, contentLabels.get(row.id) ?? [], memberships.get(row.id) ?? []),
    );
  }

  return {
    init: migrate,

    async listFolders() {
      const rows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      return rows.map(toFolder);
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

      return { ok: true, folder: toFolder(row) };
    },

    async moveFolder(id, parentId) {
      const rows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      const folders = rows.map(toFolder);
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

    async listPlatformLabels() {
      const rows = await driver.select<{ id: string; name: string }>(
        'SELECT id, name FROM platform_labels ORDER BY created_at, rowid',
      );
      return rows.map((row) => ({ id: row.id, name: row.name }));
    },

    async listContentLabels() {
      const rows = await driver.select<{ id: string; name: string }>(
        'SELECT id, name FROM content_labels ORDER BY name COLLATE NOCASE, rowid',
      );
      return rows.map((row) => ({ id: row.id, name: row.name }));
    },

    async createPlatformLabel(name) {
      const trimmed = name.trim();
      if (trimmed === '') return { ok: false, error: 'LABEL_NAME_REQUIRED' };

      const [existing] = await driver.select<{ id: string }>(
        'SELECT id FROM platform_labels WHERE name = ? COLLATE NOCASE',
        [trimmed],
      );
      if (existing) return { ok: false, error: 'LABEL_NAME_TAKEN' };

      const label: PlatformLabel = { id: createId(), name: trimmed };
      await driver.execute('INSERT INTO platform_labels (id, name, created_at) VALUES (?, ?, ?)', [
        label.id,
        label.name,
        new Date().toISOString(),
      ]);
      return { ok: true, label };
    },

    async renamePlatformLabel(id, name) {
      const trimmed = name.trim();
      if (trimmed === '') return { ok: false, error: 'LABEL_NAME_REQUIRED' };

      const [current] = await driver.select<{ id: string }>(
        'SELECT id FROM platform_labels WHERE id = ?',
        [id],
      );
      if (!current) return { ok: false, error: 'LABEL_NOT_FOUND' };

      const [existing] = await driver.select<{ id: string }>(
        'SELECT id FROM platform_labels WHERE name = ? COLLATE NOCASE',
        [trimmed],
      );
      if (existing && existing.id !== id) return { ok: false, error: 'LABEL_NAME_TAKEN' };

      await driver.execute('UPDATE platform_labels SET name = ? WHERE id = ?', [trimmed, id]);
      return { ok: true, label: { id, name: trimmed } };
    },

    async deletePlatformLabel(id) {
      await driver.execute('DELETE FROM platform_labels WHERE id = ?', [id]);
    },

    async listEntries(query = {}) {
      const folderRows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      const rows = await driver.select<EntryRow>(
        `${ENTRY_SELECT} ORDER BY e.created_at DESC, e.rowid DESC`,
      );
      const [contentLabels, memberships] = await Promise.all([
        contentLabelsFor(rows.map((row) => row.id)),
        membershipsFor(rows.map((row) => row.id)),
      ]);

      const entries = rows.map((row) =>
        toEntry(row, contentLabels.get(row.id) ?? [], memberships.get(row.id) ?? []),
      );
      if (query.folderIds === undefined) return entries;

      const included = collectFolderSubtree(folderRows.map(toFolder), query.folderIds);
      return entries.filter((entry) => entry.folderIds.some((id) => included.has(id)));
    },

    async createEntry(draft) {
      const url = normalizeOptional(draft.url);
      const author = normalizeOptional(draft.author);
      if (url === null && author === null) {
        return { ok: false, error: 'URL_OR_AUTHOR_REQUIRED' };
      }

      const id = createId();
      const now = new Date().toISOString();
      const title = normalizeOptional(draft.title);
      const platformLabel = await resolvePlatformLabel(draft.platformLabelId);

      await driver.execute(
        `INSERT INTO entries (id, title, url, author, platform_label_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, title, url, author, platformLabel?.id ?? null, now, now],
      );
      await replaceMemberships(id, draft.folderIds ?? [HOME_FOLDER_ID]);
      await syncContentLabels(id, draft.contentLabels);

      const [entry] = await loadEntries([id]);
      if (entry === undefined) return { ok: false, error: 'ENTRY_NOT_FOUND' };

      return { ok: true, entry };
    },

    async updateEntry(id, draft) {
      const url = normalizeOptional(draft.url);
      const author = normalizeOptional(draft.author);
      if (url === null && author === null) {
        return { ok: false, error: 'URL_OR_AUTHOR_REQUIRED' };
      }

      const title = normalizeOptional(draft.title);
      const platformLabel = await resolvePlatformLabel(draft.platformLabelId);

      await driver.execute(
        `UPDATE entries
         SET title = ?, url = ?, author = ?, platform_label_id = ?, updated_at = ?
         WHERE id = ?`,
        [title, url, author, platformLabel?.id ?? null, new Date().toISOString(), id],
      );

      if (draft.folderIds !== undefined) await replaceMemberships(id, draft.folderIds);
      await syncContentLabels(id, draft.contentLabels);

      const [entry] = await loadEntries([id]);
      if (entry === undefined) return { ok: false, error: 'ENTRY_NOT_FOUND' };

      return { ok: true, entry };
    },
  };
}
