import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupDigest,
  backupTables,
  BackupError,
  hasIntegrity,
  mergeBackup,
} from '../domain/backup';
import type { BackupData, ImportMode } from '../domain/backup';
import type { SqlDriver } from './sqlDriver';

const tables = Object.entries(backupTables);

const snapshotFields = tables.map(([table, fields]) => {
  const columns = Object.keys(fields)
    .map((column) => `'${column}', ${column}`)
    .join(', ');
  return `'${table}', (SELECT json_group_array(json_object(${columns})) FROM (SELECT * FROM ${table} ORDER BY rowid))`;
});

const snapshotSql = `SELECT json_object(${snapshotFields.join(',\n')}, 'settings',
  (SELECT json_object('theme', theme, 'recognizeMetadata',
     json(CASE recognize_metadata WHEN 1 THEN 'true' ELSE 'false' END)) FROM settings WHERE id = 1)
) AS data`;

// The Tauri SQL plugin uses a pool. A single statement keeps the whole import atomic on one connection.
export const backupStatements = [
  'CREATE VIEW IF NOT EXISTS backup_restore AS SELECT NULL AS payload, NULL AS expected',
  `CREATE TRIGGER IF NOT EXISTS apply_backup INSTEAD OF INSERT ON backup_restore BEGIN
    SELECT CASE WHEN NEW.expected IS NOT NULL AND NEW.expected <> (${snapshotSql})
      THEN RAISE(ABORT, 'Local collection changed during import') END;
    UPDATE folders SET parent_id = NULL;
    ${[...tables]
      .reverse()
      .map(([table]) => `DELETE FROM ${table};`)
      .join('\n')}
    ${tables
      .map(([table, fields]) => {
        const columns = Object.keys(fields);
        return `INSERT INTO ${table} (${columns.join(', ')})
        SELECT ${columns.map((column) => `value ->> '$.${column}'`).join(', ')}
        FROM json_each(NEW.payload, '$.${table}');`;
      })
      .join('\n')}
    UPDATE settings SET theme = NEW.payload ->> '$.settings.theme',
      recognize_metadata = NEW.payload ->> '$.settings.recognizeMetadata' WHERE id = 1;
  END`,
];

async function readSnapshot(driver: SqlDriver): Promise<string> {
  const [snapshot] = await driver.select<{ data: string }>(snapshotSql);
  if (snapshot === undefined) throw new Error('Missing collection snapshot');
  return snapshot.data;
}

export async function exportBackup(driver: SqlDriver): Promise<string> {
  const data: unknown = JSON.parse(await readSnapshot(driver));
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, sha256: await backupDigest(data), data },
    null,
    2,
  );
}

export async function importBackup(
  driver: SqlDriver,
  incoming: BackupData,
  mode: ImportMode,
): Promise<void> {
  let expected: string | null = null;
  let next = incoming;
  if (mode === 'merge') {
    expected = await readSnapshot(driver);
    const local: BackupData = JSON.parse(expected);
    next = mergeBackup(local, incoming);
    if (!hasIntegrity(next)) throw new BackupError('conflict');
  }
  await driver.execute('INSERT INTO backup_restore (payload, expected) VALUES (?, ?)', [
    JSON.stringify(next),
    expected,
  ]);
}
