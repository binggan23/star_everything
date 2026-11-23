export type SqlParam = string | number | null;

/**
 * The only database capability the collection store needs. Adapters: the Tauri SQL
 * plugin in the desktop app, `node:sqlite` in tests.
 */
export interface SqlDriver {
  execute(sql: string, params?: readonly SqlParam[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
}
