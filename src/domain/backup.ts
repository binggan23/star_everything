import {
  collectFolderSubtree,
  HOME_FOLDER_ID,
  HOME_FOLDER_NAME,
  normalizeOptional,
} from './collection';
import { themes } from './settings';
import type { Settings } from './settings';

export const BACKUP_FORMAT = 'star-everything-backup';
export const BACKUP_VERSION = 1;

const text = (value: unknown): value is string =>
  typeof value === 'string' && normalizeOptional(value) !== null && !value.includes('\0');

const timestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

type Guard<T> = (value: unknown) => value is T;
type Fields = Record<string, Guard<unknown>>;
type Row<T extends Fields> = { [K in keyof T]: T[K] extends Guard<infer V> ? V : never };

const nullable =
  <T>(guard: Guard<T>): Guard<T | null> =>
  (value): value is T | null =>
    value === null || guard(value);
const choice =
  <T extends string>(choices: readonly T[]): Guard<T> =>
  (value): value is T =>
    choices.some((choice) => value === choice);

const labelFields = { id: text, name: text, created_at: timestamp };

// The V1 file schema is independent of SQLite schema migrations.
export const backupTables = {
  platform_labels: labelFields,
  content_labels: labelFields,
  trash_groups: {
    id: text,
    kind: choice(['entry', 'collection']),
    label: text,
    deleted_at: timestamp,
  },
  folders: { ...labelFields, parent_id: nullable(text), trash_group_id: nullable(text) },
  entries: {
    id: text,
    title: nullable(text),
    url: nullable(text),
    author: nullable(text),
    platform_label_id: nullable(text),
    created_at: timestamp,
    updated_at: timestamp,
    trash_group_id: nullable(text),
  },
  entry_folders: { entry_id: text, folder_id: text },
  entry_content_labels: { entry_id: text, label_id: text },
};

export type BackupData = { [K in keyof typeof backupTables]: Row<(typeof backupTables)[K]>[] } & {
  settings: Settings;
};

export type ImportMode = 'merge' | 'replace';

export class BackupError extends Error {
  constructor(readonly code: 'format' | 'version' | 'integrity' | 'conflict') {
    super(code);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matches(value: unknown, fields: Fields): boolean {
  return (
    record(value) &&
    Object.keys(value).length === Object.keys(fields).length &&
    Object.entries(fields).every(([key, guard]) => guard(value[key]))
  );
}

function isBackupData(value: unknown): value is BackupData {
  return (
    record(value) &&
    Object.keys(value).length === Object.keys(backupTables).length + 1 &&
    matches(value.settings, {
      theme: choice(themes),
      recognizeMetadata: (value): value is boolean => typeof value === 'boolean',
    }) &&
    Object.entries(backupTables).every(([table, fields]) => {
      const rows = value[table];
      return Array.isArray(rows) && rows.every((row: unknown) => matches(row, fields));
    })
  );
}

export async function backupDigest(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function readBackup(source: string): Promise<BackupData> {
  let backup: unknown;
  try {
    backup = JSON.parse(source);
  } catch {
    throw new BackupError('format');
  }
  if (!record(backup) || backup.format !== BACKUP_FORMAT || typeof backup.version !== 'number') {
    throw new BackupError('format');
  }
  if (backup.version !== BACKUP_VERSION) throw new BackupError('version');
  if (!isBackupData(backup.data) || typeof backup.sha256 !== 'string') {
    throw new BackupError('format');
  }
  if ((await backupDigest(backup.data)) !== backup.sha256 || !hasIntegrity(backup.data)) {
    throw new BackupError('integrity');
  }
  return backup.data;
}

function additions<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  const ids = new Set(local.map((row) => row.id));
  return incoming.filter((row) => !ids.has(row.id));
}

// SQLite's NOCASE label indexes fold ASCII only.
function labelKey(name: string): string {
  return name.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

function unique<T>(rows: T[], key: (row: T) => string): boolean {
  return new Set(rows.map(key)).size === rows.length;
}

export function hasIntegrity(data: BackupData): boolean {
  const folders = new Map(data.folders.map((folder) => [folder.id, folder]));
  const groups = new Map(data.trash_groups.map((group) => [group.id, group]));
  const entries = new Set(data.entries.map((entry) => entry.id));
  const platforms = new Set(data.platform_labels.map((label) => label.id));
  const labels = new Set(data.content_labels.map((label) => label.id));
  const home = folders.get(HOME_FOLDER_ID);
  if (
    home?.name !== HOME_FOLDER_NAME ||
    home.parent_id !== null ||
    home.trash_group_id !== null ||
    folders.size !== data.folders.length ||
    groups.size !== data.trash_groups.length ||
    entries.size !== data.entries.length ||
    platforms.size !== data.platform_labels.length ||
    labels.size !== data.content_labels.length ||
    !unique(data.platform_labels, (label) => labelKey(label.name)) ||
    !unique(data.content_labels, (label) => labelKey(label.name))
  )
    return false;

  const collectionRoots = new Map<string, number>();
  for (const folder of data.folders) {
    if (folder.id === HOME_FOLDER_ID) continue;
    const parent = folder.parent_id === null ? undefined : folders.get(folder.parent_id);
    if (
      !parent ||
      (parent.trash_group_id !== null && parent.trash_group_id !== folder.trash_group_id)
    ) {
      return false;
    }
    if (folder.trash_group_id !== null) {
      if (groups.get(folder.trash_group_id)?.kind !== 'collection') return false;
      if (parent.trash_group_id === null) {
        const id = folder.trash_group_id;
        collectionRoots.set(id, (collectionRoots.get(id) ?? 0) + 1);
      }
    }
  }
  // With one parent per folder, any disconnected cycle is unreachable from Home.
  if (
    collectFolderSubtree(
      data.folders.map(({ id, name, parent_id }) => ({ id, name, parentId: parent_id })),
      [HOME_FOLDER_ID],
    ).size !== folders.size
  ) {
    return false;
  }

  const entryCounts = new Map<string, number>();
  for (const entry of data.entries) {
    if (
      (entry.url === null && entry.author === null) ||
      (entry.platform_label_id !== null && !platforms.has(entry.platform_label_id))
    )
      return false;
    if (entry.trash_group_id !== null) {
      const id = entry.trash_group_id;
      if (!groups.has(id)) return false;
      entryCounts.set(id, (entryCounts.get(id) ?? 0) + 1);
    }
  }
  if (
    !data.trash_groups.every(({ id, kind }) =>
      kind === 'entry' ? entryCounts.get(id) === 1 : collectionRoots.get(id) === 1,
    )
  )
    return false;

  return (
    unique(data.entry_folders, ({ entry_id, folder_id }) =>
      JSON.stringify([entry_id, folder_id]),
    ) &&
    data.entry_folders.every(
      ({ entry_id, folder_id }) => entries.has(entry_id) && folders.has(folder_id),
    ) &&
    unique(data.entry_content_labels, ({ entry_id, label_id }) =>
      JSON.stringify([entry_id, label_id]),
    ) &&
    data.entry_content_labels.every(
      ({ entry_id, label_id }) => entries.has(entry_id) && labels.has(label_id),
    )
  );
}

function mergeLabels(
  local: BackupData['platform_labels'],
  incoming: BackupData['platform_labels'],
) {
  const ids = new Set(local.map((label) => label.id));
  const byName = new Map(local.map((label) => [labelKey(label.name), label.id]));
  const aliases = new Map<string, string>();
  const labels = [...local];
  for (const label of incoming) {
    if (ids.has(label.id)) continue;
    const existingId = byName.get(labelKey(label.name));
    if (existingId !== undefined) aliases.set(label.id, existingId);
    else labels.push(label);
  }
  return { labels, aliases };
}

export function mergeBackup(local: BackupData, incoming: BackupData): BackupData {
  const platforms = mergeLabels(local.platform_labels, incoming.platform_labels);
  const content = mergeLabels(local.content_labels, incoming.content_labels);
  const newEntries = additions(local.entries, incoming.entries);
  const newEntryIds = new Set(newEntries.map((entry) => entry.id));
  const newFolders = additions(local.folders, incoming.folders);
  const newGroupIds = new Set([...newEntries, ...newFolders].map((row) => row.trash_group_id));

  return {
    settings: local.settings,
    platform_labels: platforms.labels,
    content_labels: content.labels,
    folders: [...local.folders, ...newFolders],
    trash_groups: [
      ...local.trash_groups,
      ...additions(local.trash_groups, incoming.trash_groups).filter((group) =>
        newGroupIds.has(group.id),
      ),
    ],
    entries: [
      ...local.entries,
      ...newEntries.map((entry) => ({
        ...entry,
        platform_label_id:
          entry.platform_label_id === null
            ? null
            : (platforms.aliases.get(entry.platform_label_id) ?? entry.platform_label_id),
      })),
    ],
    entry_folders: [
      ...local.entry_folders,
      ...incoming.entry_folders.filter((membership) => newEntryIds.has(membership.entry_id)),
    ],
    entry_content_labels: [
      ...local.entry_content_labels,
      ...incoming.entry_content_labels
        .filter((membership) => newEntryIds.has(membership.entry_id))
        .map((membership) => ({
          ...membership,
          label_id: content.aliases.get(membership.label_id) ?? membership.label_id,
        })),
    ],
  };
}
