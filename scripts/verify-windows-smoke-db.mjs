import { DatabaseSync } from 'node:sqlite';

const databasePath = process.argv[2];
if (!databasePath) {
  console.error('Usage: node verify-windows-smoke-db.mjs <database-path>');
  process.exit(2);
}

let database;
try {
  database = new DatabaseSync(databasePath, { readOnly: true });
  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  const requiredTables = ['entries', 'folders', 'settings', 'trash_groups'];
  const missingTables = requiredTables.filter((table) => !tables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Missing migrated tables: ${missingTables.join(', ')}`);
  }

  const home = database.prepare("SELECT name FROM folders WHERE id = 'home'").get();
  if (home?.name !== 'Home') {
    throw new Error('The Home collection was not initialized');
  }

  const settings = database.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!settings) {
    throw new Error('Default settings were not initialized');
  }

  console.log('Required schema, Home collection, and default settings are present.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  database?.close();
}
