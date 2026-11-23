/** Stable identifiers for values the schema seeds once. */
export const HOME_FOLDER_ID = 'home';
export const HOME_FOLDER_NAME = 'Home';

/** A URL or an author is trimmed; an empty value means "not provided". */
export function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
