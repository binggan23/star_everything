/** Stable-enough identifiers for locally created records. */
export function createId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
