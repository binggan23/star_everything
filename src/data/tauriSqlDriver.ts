import Database from '@tauri-apps/plugin-sql';

import type { SqlDriver, SqlParam } from './sqlDriver';

/**
 * `SqlDriver` backed by the Tauri SQL plugin. The database file lives in the app's
 * local data directory; the plugin creates it on first load.
 */
export function createTauriSqlDriver(): SqlDriver {
  let database: Promise<Database> | null = null;

  function load(): Promise<Database> {
    database ??= Database.load('sqlite:star_everything.db');
    return database;
  }

  return {
    async execute(sql: string, params: readonly SqlParam[] = []) {
      const db = await load();
      const result = await db.execute(sql, [...params]);
      return { rowsAffected: result.rowsAffected };
    },

    async select<T>(sql: string, params: readonly SqlParam[] = []) {
      const db = await load();
      return db.select<T[]>(sql, [...params]);
    },
  };
}
