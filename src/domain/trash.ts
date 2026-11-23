/** Trashed entries and collection groups stay recoverable for this many days. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a trashed item stops being recoverable. */
export function trashExpiresAt(deletedAt: string): Date {
  return new Date(Date.parse(deletedAt) + TRASH_RETENTION_DAYS * DAY_MS);
}

/** Whole days left before purge; `0` means the item is due for permanent cleanup. */
export function retentionDaysLeft(deletedAt: string, now: Date): number {
  const remaining = trashExpiresAt(deletedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

/** The retention window has elapsed, so the item may be purged. */
export function isTrashExpired(deletedAt: string, now: Date): boolean {
  return trashExpiresAt(deletedAt).getTime() <= now.getTime();
}
