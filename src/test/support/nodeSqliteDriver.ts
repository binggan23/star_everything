import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlParam } from '../../data/sqlDriver';

/** `SqlDriver` backed by the SQLite build that ships with Node, used by the tests. */
export class NodeSqliteDriver implements SqlDriver {
  readonly #db: DatabaseSync;

  constructor(databasePath: string) {
    this.#db = new DatabaseSync(databasePath);
    this.#db.exec('PRAGMA foreign_keys = ON');
  }

  async execute(sql: string, params: readonly SqlParam[] = []): Promise<{ rowsAffected: number }> {
    const result = this.#db.prepare(sql).run(...params);
    return { rowsAffected: Number(result.changes) };
  }

  async select<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    return this.#db.prepare(sql).all(...params) as T[];
  }

  close(): void {
    this.#db.close();
  }
}
