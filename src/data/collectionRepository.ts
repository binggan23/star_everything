import { HOME_FOLDER_ID, normalizeOptional } from '../domain/collection';
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
};

export type EntryQuery = {
  folderId?: string;
};

export type EntryDraft = {
  title: string;
  url: string;
  author: string;
  platformLabelId: string;
  contentLabels: string;
};

export type SaveErrorCode = 'URL_OR_AUTHOR_REQUIRED' | 'ENTRY_NOT_FOUND';

export type LabelErrorCode = 'LABEL_NAME_REQUIRED' | 'LABEL_NAME_TAKEN' | 'LABEL_NOT_FOUND';

export type SaveResult = { ok: true; entry: Entry } | { ok: false; error: SaveErrorCode };

export type LabelResult = { ok: true; label: PlatformLabel } | { ok: false; error: LabelErrorCode };

export interface CollectionRepository {
  /** Applies pending schema migrations. Safe to call more than once. */
  init(): Promise<void>;
  listFolders(): Promise<Folder[]>;
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

const ENTRY_SELECT = `
  SELECT e.id, e.title, e.url, e.author, e.platform_label_id,
         p.name AS platform_label_name, e.created_at, e.updated_at
  FROM entries e
  LEFT JOIN platform_labels p ON p.id = e.platform_label_id`;

const toEntry = (row: EntryRow, contentLabels: string[]): Entry => ({
  id: row.id,
  title: row.title,
  url: row.url,
  author: row.author,
  platformLabelId: row.platform_label_id,
  platformLabelName: row.platform_label_name,
  contentLabels,
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

  return {
    init: migrate,

    async listFolders() {
      const rows = await driver.select<FolderRow>(
        'SELECT id, name, parent_id FROM folders ORDER BY created_at, rowid',
      );
      return rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id }));
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
      const rows =
        query.folderId === undefined
          ? await driver.select<EntryRow>(
              `${ENTRY_SELECT} ORDER BY e.created_at DESC, e.rowid DESC`,
            )
          : await driver.select<EntryRow>(
              `${ENTRY_SELECT}
               JOIN entry_folders ef ON ef.entry_id = e.id
               WHERE ef.folder_id = ?
               ORDER BY e.created_at DESC, e.rowid DESC`,
              [query.folderId],
            );

      const contentLabels = await contentLabelsFor(rows.map((row) => row.id));
      return rows.map((row) => toEntry(row, contentLabels.get(row.id) ?? []));
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
      await driver.execute(
        'INSERT OR IGNORE INTO entry_folders (entry_id, folder_id) VALUES (?, ?)',
        [id, HOME_FOLDER_ID],
      );
      await syncContentLabels(id, draft.contentLabels);

      return {
        ok: true,
        entry: {
          id,
          title,
          url,
          author,
          platformLabelId: platformLabel?.id ?? null,
          platformLabelName: platformLabel?.name ?? null,
          contentLabels: parseContentLabels(draft.contentLabels),
          createdAt: now,
          updatedAt: now,
        },
      };
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
      const [row] = await driver.select<EntryRow>(`${ENTRY_SELECT} WHERE e.id = ?`, [id]);
      if (!row) return { ok: false, error: 'ENTRY_NOT_FOUND' };

      await syncContentLabels(id, draft.contentLabels);
      const contentLabels = await contentLabelsFor([id]);

      return { ok: true, entry: toEntry(row, contentLabels.get(id) ?? []) };
    },
  };
}
