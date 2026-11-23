import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createCollectionRepository } from '../../data/collectionRepository';
import type { CollectionRepository } from '../../data/collectionRepository';
import { NodeSqliteDriver } from './nodeSqliteDriver';

export type TestRepository = {
  repository: CollectionRepository;
  databasePath: string;
  directory: string;
  /** Releases the database file so it can be reopened, as after an app restart. */
  close: () => void;
  /** Releases the database file and removes the temporary directory. */
  dispose: () => void;
};

export type OpenTestRepositoryOptions = {
  databasePath?: string;
  directory?: string;
};

/**
 * A real SQLite database in a temporary directory, wired to the collection repository.
 * Pass the previous `databasePath` and `directory` to reopen it, simulating a restart.
 */
export function openTestRepository(options: OpenTestRepositoryOptions = {}): TestRepository {
  const directory = options.directory ?? mkdtempSync(join(tmpdir(), 'star-everything-'));
  const databasePath = options.databasePath ?? join(directory, 'star-everything.db');
  const driver = new NodeSqliteDriver(databasePath);
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    driver.close();
  };

  return {
    repository: createCollectionRepository(driver),
    databasePath,
    directory,
    close,
    dispose: () => {
      close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
