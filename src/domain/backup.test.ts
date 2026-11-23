import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupDigest,
  BackupError,
  hasIntegrity,
  mergeBackup,
  readBackup,
} from './backup';
import type { BackupData } from './backup';

const createdAt = '2025-01-02T03:04:05.000Z';

function makeBackupData(entryId = 'entry-1'): BackupData {
  return {
    settings: { theme: 'dark', recognizeMetadata: true },
    platform_labels: [{ id: 'platform-1', name: 'Bilibili', created_at: createdAt }],
    content_labels: [{ id: 'label-1', name: 'music', created_at: createdAt }],
    trash_groups: [{ id: 'trash-1', kind: 'entry', label: 'Author', deleted_at: createdAt }],
    folders: [
      { id: 'home', name: 'Home', created_at: createdAt, parent_id: null, trash_group_id: null },
      {
        id: 'folder-1',
        name: 'Videos',
        created_at: createdAt,
        parent_id: 'home',
        trash_group_id: null,
      },
    ],
    entries: [
      {
        id: entryId,
        title: 'Title',
        url: null,
        author: 'Author',
        platform_label_id: 'platform-1',
        created_at: createdAt,
        updated_at: createdAt,
        trash_group_id: 'trash-1',
      },
    ],
    entry_folders: [{ entry_id: entryId, folder_id: 'folder-1' }],
    entry_content_labels: [{ entry_id: entryId, label_id: 'label-1' }],
  };
}

async function serializedBackup(data: unknown): Promise<string> {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    sha256: await backupDigest(data),
    data,
  });
}

describe('backup validation', () => {
  it('computes a stable SHA-256 digest that changes with the data', async () => {
    const data = makeBackupData();
    const digest = await backupDigest(data);

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    await expect(backupDigest(data)).resolves.toBe(digest);
    await expect(
      backupDigest({ ...data, settings: { ...data.settings, theme: 'light' } }),
    ).resolves.not.toBe(digest);
  });

  it('reads a valid versioned backup', async () => {
    const data = makeBackupData();

    await expect(readBackup(await serializedBackup(data))).resolves.toEqual(data);
  });

  it.each([
    ['malformed JSON', '{', 'format'],
    ['an unknown format', JSON.stringify({ format: 'other', version: 1 }), 'format'],
    ['an unsupported version', JSON.stringify({ format: BACKUP_FORMAT, version: 2 }), 'version'],
    [
      'an invalid data shape',
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, sha256: '', data: { settings: {} } }),
      'format',
    ],
  ] as const)('rejects %s', async (_case, source, code) => {
    await expect(readBackup(source)).rejects.toMatchObject<Partial<BackupError>>({ code });
  });

  it('rejects malformed fields and non-canonical timestamps', async () => {
    const cases: Array<(data: BackupData) => void> = [
      (data) => {
        data.entries[0]!.author = '';
      },
      (data) => {
        data.entries[0]!.url = 'bad\0url';
      },
      (data) => {
        data.entries[0]!.created_at = '2025-01-02';
      },
      (data) => {
        data.settings.theme = 'sepia' as BackupData['settings']['theme'];
      },
    ];
    for (const mutate of cases) {
      const data = makeBackupData();
      mutate(data);
      await expect(readBackup(await serializedBackup(data))).rejects.toMatchObject({
        code: 'format',
      });
    }
  });

  it('rejects valid data with incorrect envelope metadata', async () => {
    const data = makeBackupData();
    const source = JSON.parse(await serializedBackup(data)) as {
      format: string;
      version: number;
      sha256: string;
      data: BackupData;
    };

    source.format = 'other';
    await expect(readBackup(JSON.stringify(source))).rejects.toMatchObject({ code: 'format' });

    source.format = BACKUP_FORMAT;
    source.version = 2;
    await expect(readBackup(JSON.stringify(source))).rejects.toMatchObject({ code: 'version' });

    source.version = BACKUP_VERSION;
    source.sha256 = '0'.repeat(64);
    await expect(readBackup(JSON.stringify(source))).rejects.toMatchObject({ code: 'integrity' });
  });

  it('rejects a changed payload when its digest no longer matches', async () => {
    const data = makeBackupData();
    const source = JSON.parse(await serializedBackup(data)) as {
      format: string;
      version: number;
      sha256: string;
      data: BackupData;
    };
    source.data.settings.theme = 'light';

    await expect(readBackup(JSON.stringify(source))).rejects.toMatchObject({ code: 'integrity' });
  });

  it('rejects structurally valid data with broken references even when re-signed', async () => {
    const data = makeBackupData();
    data.entry_folders[0]!.folder_id = 'missing-folder';

    await expect(readBackup(await serializedBackup(data))).rejects.toMatchObject({
      code: 'integrity',
    });
  });
});

describe('backup integrity', () => {
  it('accepts a complete Home-rooted snapshot', () => {
    expect(hasIntegrity(makeBackupData())).toBe(true);
  });

  it.each([
    ['a missing Home folder', (data: BackupData) => (data.folders = data.folders.slice(1))],
    ['a non-root Home folder', (data: BackupData) => (data.folders[0]!.parent_id = 'folder-1')],
    ['an orphan collection', (data: BackupData) => (data.folders[1]!.parent_id = 'missing')],
    [
      'a disconnected folder cycle',
      (data: BackupData) => {
        data.folders[1]!.parent_id = 'folder-1';
      },
    ],
    [
      'an entry without URL or author',
      (data: BackupData) => {
        data.entries[0]!.author = null;
      },
    ],
    [
      'an unknown platform label',
      (data: BackupData) => {
        data.entries[0]!.platform_label_id = 'missing';
      },
    ],
    [
      'a missing membership target',
      (data: BackupData) => {
        data.entry_content_labels[0]!.label_id = 'missing';
      },
    ],
    [
      'an entry with an unknown trash group',
      (data: BackupData) => {
        data.trash_groups = [];
        data.entries[0]!.trash_group_id = 'missing';
      },
    ],
    [
      'a trash group without exactly one entry',
      (data: BackupData) => {
        data.entries[0]!.trash_group_id = null;
      },
    ],
    [
      'a folder attached to the wrong trash group kind',
      (data: BackupData) => {
        data.folders[1]!.trash_group_id = 'trash-1';
      },
    ],
    [
      'a trashed child outside its parent group',
      (data: BackupData) => {
        data.trash_groups.push({
          id: 'collection-trash',
          kind: 'collection',
          label: 'Videos',
          deleted_at: createdAt,
        });
        data.folders[1]!.trash_group_id = 'collection-trash';
        data.folders.push({
          id: 'nested',
          name: 'Nested',
          created_at: createdAt,
          parent_id: 'folder-1',
          trash_group_id: null,
        });
      },
    ],
    [
      'multiple roots for a collection trash group',
      (data: BackupData) => {
        data.trash_groups.push({
          id: 'collection-trash',
          kind: 'collection',
          label: 'Videos',
          deleted_at: createdAt,
        });
        data.folders[1]!.trash_group_id = 'collection-trash';
        data.folders.push({
          id: 'other-root',
          name: 'Other',
          created_at: createdAt,
          parent_id: 'home',
          trash_group_id: 'collection-trash',
        });
      },
    ],
    [
      'duplicate folder IDs',
      (data: BackupData) => {
        data.folders.push({ ...data.folders[1]! });
      },
    ],
    [
      'duplicate trash group IDs',
      (data: BackupData) => {
        data.trash_groups.push({ ...data.trash_groups[0]! });
      },
    ],
    [
      'duplicate platform label IDs',
      (data: BackupData) => {
        data.platform_labels.push({ ...data.platform_labels[0]! });
      },
    ],
    [
      'duplicate content label IDs',
      (data: BackupData) => {
        data.content_labels.push({ ...data.content_labels[0]! });
      },
    ],
    [
      'duplicate entry IDs',
      (data: BackupData) => {
        data.entries[0]!.trash_group_id = null;
        data.entries.push({ ...data.entries[0]! });
      },
    ],
    [
      'a mixed valid and invalid folder membership',
      (data: BackupData) => {
        data.entry_folders.push({ entry_id: 'missing-entry', folder_id: 'folder-1' });
      },
    ],
    [
      'a mixed valid and invalid content membership',
      (data: BackupData) => {
        data.entry_content_labels.push({ entry_id: 'missing-entry', label_id: 'label-1' });
      },
    ],
    [
      'duplicate content membership rows',
      (data: BackupData) => {
        data.entry_content_labels.push({ ...data.entry_content_labels[0]! });
      },
    ],
  ])('rejects %s', (_case, mutate) => {
    const data = makeBackupData();
    mutate(data);

    expect(hasIntegrity(data)).toBe(false);
  });
});

describe('backup integrity', () => {
  it('accepts a nested collection trash group', () => {
    const data = makeBackupData();
    data.trash_groups.push({
      id: 'collection-trash',
      kind: 'collection',
      label: 'Videos',
      deleted_at: createdAt,
    });
    data.folders[1]!.trash_group_id = 'collection-trash';
    data.folders.push({
      id: 'nested',
      name: 'Nested',
      created_at: createdAt,
      parent_id: 'folder-1',
      trash_group_id: 'collection-trash',
    });

    expect(hasIntegrity(data)).toBe(true);
  });

  it('accepts an entry with a URL and no author', () => {
    const data = makeBackupData();
    data.entries[0]!.url = 'https://example.com/video';
    data.entries[0]!.author = null;

    expect(hasIntegrity(data)).toBe(true);
  });

  it('accepts an entry with an author and no URL', () => {
    const data = makeBackupData();
    data.entries[0]!.url = null;
    data.entries[0]!.author = 'Author';

    expect(hasIntegrity(data)).toBe(true);
  });
});

describe('backup merge', () => {
  it('keeps local settings and records, adds new records once, and merges only new-entry relations', () => {
    const local = makeBackupData('shared-entry');
    local.settings.theme = 'light';
    local.trash_groups = [];
    local.entries[0]!.trash_group_id = null;
    const incoming = makeBackupData('shared-entry');
    incoming.entries[0]!.title = 'Incoming duplicate';
    incoming.entries[0]!.trash_group_id = 'unrelated-trash';
    incoming.entry_folders = [{ entry_id: 'shared-entry', folder_id: 'folder-1' }];
    incoming.entry_content_labels = [{ entry_id: 'shared-entry', label_id: 'label-1' }];
    incoming.entries.push({ ...incoming.entries[0]!, id: 'new-entry', title: 'New' });
    incoming.trash_groups = [
      { id: 'trash-1', kind: 'entry', label: 'Author', deleted_at: createdAt },
      { id: 'unrelated-trash', kind: 'entry', label: 'Author', deleted_at: createdAt },
    ];
    incoming.entries[1]!.trash_group_id = 'trash-1';
    incoming.entry_folders.push({ entry_id: 'new-entry', folder_id: 'folder-1' });
    incoming.entry_content_labels.push({ entry_id: 'new-entry', label_id: 'label-1' });

    const merged = mergeBackup(local, incoming);

    expect(merged.settings).toEqual(local.settings);
    expect(merged.entries.map(({ id }) => id)).toEqual(['shared-entry', 'new-entry']);
    expect(merged.entries[0]?.title).toBe('Title');
    expect(merged.entry_folders).toEqual([
      { entry_id: 'shared-entry', folder_id: 'folder-1' },
      { entry_id: 'new-entry', folder_id: 'folder-1' },
    ]);
    expect(merged.entry_content_labels).toEqual([
      { entry_id: 'shared-entry', label_id: 'label-1' },
      { entry_id: 'new-entry', label_id: 'label-1' },
    ]);
    expect(merged.trash_groups).toEqual([incoming.trash_groups[0]]);
    expect(hasIntegrity(merged)).toBe(true);
    expect(mergeBackup(merged, incoming)).toEqual(merged);
  });
});
