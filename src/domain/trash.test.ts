import { describe, expect, it } from 'vitest';

import { isTrashExpired, retentionDaysLeft, trashExpiresAt, TRASH_RETENTION_DAYS } from './trash';

const deletedAt = '2025-01-01T12:00:00.000Z';
const expiresAt = new Date('2025-01-31T12:00:00.000Z');

describe('trash retention', () => {
  it('expires exactly thirty days after deletion', () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(trashExpiresAt(deletedAt)).toEqual(expiresAt);
  });

  it('rounds remaining retention up to whole days and floors at zero', () => {
    expect(retentionDaysLeft(deletedAt, new Date('2025-01-01T12:00:00.000Z'))).toBe(30);
    expect(retentionDaysLeft(deletedAt, new Date('2025-01-30T12:00:00.001Z'))).toBe(1);
    expect(retentionDaysLeft(deletedAt, new Date('2025-01-30T12:00:00.000Z'))).toBe(1);
    expect(retentionDaysLeft(deletedAt, expiresAt)).toBe(0);
    expect(retentionDaysLeft(deletedAt, new Date('2025-02-01T12:00:00.000Z'))).toBe(0);
  });

  it('marks the exact expiry instant as expired, but not the preceding instant', () => {
    expect(isTrashExpired(deletedAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isTrashExpired(deletedAt, expiresAt)).toBe(true);
    expect(isTrashExpired(deletedAt, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});
